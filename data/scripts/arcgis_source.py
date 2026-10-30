"""Captura de solo lectura: respuestas originales, inventario de IDs y hashes."""
from __future__ import annotations

import hashlib
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from xml.etree import ElementTree

SERVICE = (
    "https://services9.arcgis.com/4ZwMO9wShTnUDuWy/ArcGIS/rest/services/"
    "Recorridos_y_paradas_de_rutas_de_El_Salvador_WFL1/FeatureServer"
)
ITEM_ID = "177dfb4b9a7940808fe7791098b02315"
ITEM = f"https://www.arcgis.com/sharing/rest/content/items/{ITEM_ID}"
VERSION = "1.0.0"
PILOT = "AB008A0SS"


class ImportFailure(ValueError):
    """Fallo comprobable; no debe convertirse en un conjunto vacío silencioso."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n").encode("utf-8")


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as handle:
        handle.write(json_bytes(value))


def read_json(payload: bytes) -> dict:
    def reject_constant(value: str):
        raise ValueError(f"Constante JSON no finita: {value}")
    try:
        result = json.loads(payload.decode("utf-8-sig"), parse_constant=reject_constant)
    except (ValueError, UnicodeError) as error:
        raise ImportFailure("Respuesta JSON inválida") from error
    if not isinstance(result, dict):
        raise ImportFailure("Se esperaba un objeto JSON")
    if result.get("error"):
        raise ImportFailure(f"Error ArcGIS: {result['error']}")
    return result


class HttpClient:
    def __init__(self, timeout: float = 30, retries: int = 3, opener=urlopen, sleep=time.sleep):
        self.timeout, self.retries = timeout, retries
        self.opener, self.sleep = opener, sleep

    def get(self, url: str) -> tuple[bytes, dict]:
        for attempt in range(self.retries + 1):
            try:
                request = Request(url, headers={"User-Agent": f"RutaSV-data-pilot/{VERSION}"})
                with self.opener(request, timeout=self.timeout) as response:
                    payload = response.read()
                    headers = {key.lower(): value for key, value in response.headers.items()
                               if key.lower() in {"date", "last-modified", "etag", "content-type"}}
                    return payload, headers
            except HTTPError as error:
                if error.code not in {408, 429, 500, 502, 503, 504} or attempt == self.retries:
                    raise ImportFailure(f"HTTP {error.code}: {url}") from error
            except (URLError, TimeoutError, OSError) as error:
                if attempt == self.retries:
                    raise ImportFailure(f"No se pudo consultar {url}: {error}") from error
            self.sleep(2 ** attempt)
        raise ImportFailure("Se agotaron los reintentos")


class Capture:
    def __init__(self, root: Path, client: HttpClient):
        self.root, self.client = root, client
        self.entries: list[dict] = []

    def get(self, filename: str, url: str, params: dict | None = None, xml: bool = False):
        query = {key: str(value) for key, value in (params or {}).items()}
        request_url = url + ("?" + urlencode(query) if query else "")
        payload, headers = self.client.get(request_url)
        # Preservar incluso la respuesta que luego resulte inválida.
        path = self.root / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("xb") as handle:
            handle.write(payload)
        self.entries.append({"path": filename, "url": url, "parameters": query,
                             "request_url": request_url, "captured_at": utc_now(),
                             "sha256": sha256(payload), "bytes": len(payload), "headers": headers})
        if xml:
            try:
                return ElementTree.fromstring(payload)
            except ElementTree.ParseError as error:
                raise ImportFailure("Los metadatos XML no son válidos") from error
        return read_json(payload)


def valid_snapshot_id(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,100}", value):
        raise ImportFailure("Identificador de instantánea inválido")
    return value


def parse_ids(reply: dict) -> list[int]:
    ids = reply.get("objectIds")
    if not isinstance(ids, list) or any(type(value) is not int or value < 0 for value in ids):
        raise ImportFailure("Lista de OBJECTID ausente o inválida")
    if len(ids) != len(set(ids)):
        raise ImportFailure("ArcGIS devolvió OBJECTID duplicados")
    if reply.get("exceededTransferLimit"):
        raise ImportFailure("La lista de OBJECTID está truncada")
    return sorted(ids)


def download_layer(capture: Capture, layer: int, where: str, metadata: dict) -> dict:
    endpoint = f"{SERVICE}/{layer}/query"
    prefix = f"responses/layer-{layer}"
    count = capture.get(f"{prefix}/count.json", endpoint,
                        {"f": "json", "where": where, "returnCountOnly": "true"}).get("count")
    ids = parse_ids(capture.get(f"{prefix}/ids.json", endpoint,
                               {"f": "json", "where": where, "returnIdsOnly": "true"}))
    if type(count) is not int or count != len(ids):
        raise ImportFailure(f"Capa {layer}: conteo e inventario de IDs no coinciden")
    limit = metadata.get("maxRecordCount", 2000)
    if type(limit) is not int or limit < 1:
        raise ImportFailure("maxRecordCount inválido")
    batch_size = min(500, limit)
    batches, received = [], set()
    for offset in range(0, len(ids), batch_size):
        batch = ids[offset:offset + batch_size]
        filename = f"{prefix}/batch-{offset // batch_size:04}.json"
        reply = capture.get(filename, endpoint, {
            "f": "json", "objectIds": ",".join(map(str, batch)), "outFields": "*",
            "returnGeometry": "true", "returnZ": "true", "returnM": "true",
            "returnTrueCurves": "true", "orderByFields": "OBJECTID ASC",
        })
        sr = reply.get("spatialReference", {})
        if sr.get("latestWkid", sr.get("wkid")) not in {3857, 102100}:
            raise ImportFailure(f"Capa {layer}: referencia espacial inesperada")
        features = reply.get("features")
        if not isinstance(features, list) or reply.get("exceededTransferLimit"):
            raise ImportFailure(f"Capa {layer}: lote truncado o sin features")
        actual = []
        for feature in features:
            oid = feature.get("attributes", {}).get("OBJECTID") if isinstance(feature, dict) else None
            if type(oid) is not int or oid in received:
                raise ImportFailure(f"Capa {layer}: OBJECTID ausente o duplicado")
            actual.append(oid)
            received.add(oid)
        if sorted(actual) != batch:
            raise ImportFailure(f"Capa {layer}: faltan registros o llegaron IDs no solicitados")
        batches.append(filename)
    final_ids = parse_ids(capture.get(f"{prefix}/ids-after.json", endpoint,
                                     {"f": "json", "where": where, "returnIdsOnly": "true"}))
    if final_ids != ids:
        raise ImportFailure(f"Capa {layer}: el inventario cambió durante la captura")
    return {"where": where, "expected": count, "received": len(received), "object_ids": ids,
            "batches": batches, "source_sr": 3857, "batch_size": batch_size}


def fetch_snapshot(data_root: Path, route_code: str = PILOT, snapshot_id: str | None = None,
                   client: HttpClient | None = None) -> Path:
    route_code = route_code.strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,50}", route_code):
        raise ImportFailure("Código de ruta inválido; no se permiten expresiones SQL")
    snapshot_id = valid_snapshot_id(snapshot_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ"))
    root = data_root / "raw" / "arcgis-vmt" / snapshot_id
    root.mkdir(parents=True, exist_ok=False)
    capture = Capture(root, client or HttpClient())
    manifest = {"schema_version": 1, "importer_version": VERSION, "snapshot_id": snapshot_id,
                "capture_code_sha256": sha256(Path(__file__).read_bytes()),
                "started_at": utc_now(), "service_url": SERVICE, "service_item_id": ITEM_ID,
                "route_code": route_code, "status": "incomplete", "layers": {}}
    try:
        service = capture.get("service.json", SERVICE, {"f": "json"})
        if service.get("serviceItemId") != ITEM_ID:
            raise ImportFailure("El servicio ya no corresponde al elemento esperado")
        item = capture.get("item.json", ITEM, {"f": "json"})
        capture.get("item-data.json", f"{ITEM}/data", {"f": "json"})
        capture.get("owner.json", f"https://www.arcgis.com/sharing/rest/community/users/{item['owner']}", {"f": "json"})
        capture.get("organization.json", f"https://www.arcgis.com/sharing/rest/portals/{item['orgId']}", {"f": "json"})
        capture.get("metadata.xml", f"{ITEM}/info/metadata/metadata.xml", xml=True)
        manifest["license_status"] = "unspecified" if not str(item.get("licenseInfo") or "").strip() else "requires_review"
        manifest["declared_dates"] = {key: item.get(key) for key in ("created", "modified")}
        metadata = {layer: capture.get(f"layers/{layer}.json", f"{SERVICE}/{layer}", {"f": "json"}) for layer in (0, 1)}
        for layer, field in ((0, "Ruta"), (1, "CODIGO_RUTA")):
            meta = metadata[layer]
            field_names = {entry["name"] for entry in meta.get("fields", [])}
            if not {field, "OBJECTID"}.issubset(field_names):
                raise ImportFailure(f"Capa {layer}: cambió el esquema")
            result = download_layer(capture, layer, f"{field}='{route_code}'", meta)
            result["editing_info"] = meta.get("editingInfo")
            manifest["layers"][str(layer)] = result
        for layer in (0, 1):
            after = capture.get(f"layers/{layer}-after.json", f"{SERVICE}/{layer}", {"f": "json"})
            meta = metadata[layer]
            if meta.get("editingInfo") != after.get("editingInfo") or meta.get("fields") != after.get("fields"):
                raise ImportFailure(f"Capa {layer}: datos o esquema cambiaron durante la captura")
        if not manifest["layers"]["1"]["expected"]:
            raise ImportFailure("El piloto solicitado no tiene recorridos")
        manifest["status"] = "complete"
    except Exception as error:
        manifest["failure"] = str(error)
        raise
    finally:
        manifest["finished_at"] = utc_now()
        manifest["files"] = capture.entries
        write_json(root / "manifest.json", manifest)
    return root


def safe_file(root: Path, relative: str) -> Path:
    if not isinstance(relative, str):
        raise ImportFailure("Ruta de archivo inválida")
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()) or path == root.resolve():
        raise ImportFailure("Archivo fuera de la instantánea")
    return path


def load_snapshot(root: Path) -> tuple[dict, dict[int, list[dict]]]:
    manifest = read_json((root / "manifest.json").read_bytes())
    if manifest.get("status") != "complete" or manifest.get("schema_version") != 1:
        raise ImportFailure("La instantánea no está completa o su versión no es compatible")
    if manifest.get("service_item_id") != ITEM_ID or manifest.get("service_url") != SERVICE:
        raise ImportFailure("Procedencia de la instantánea inesperada")
    files = {}
    for entry in manifest["files"]:
        relative = entry["path"]
        if relative in files:
            raise ImportFailure("Archivo repetido en el manifiesto")
        payload = safe_file(root, relative).read_bytes()
        if sha256(payload) != entry["sha256"]:
            raise ImportFailure(f"Hash incorrecto: {relative}")
        files[relative] = payload
    layers = {}
    for layer in (0, 1):
        info = manifest["layers"][str(layer)]
        features = []
        for filename in info["batches"]:
            if filename not in files:
                raise ImportFailure("Un lote no está registrado en el manifiesto")
            features.extend(read_json(files[filename])["features"])
        ids = [feature.get("attributes", {}).get("OBJECTID") for feature in features]
        if (any(type(oid) is not int for oid in ids) or len(ids) != len(set(ids)) or
                sorted(ids) != info["object_ids"] or len(ids) != info["expected"] or len(ids) != info["received"]):
            raise ImportFailure(f"Capa {layer}: inventario alterado o incompleto")
        layers[layer] = sorted(features, key=lambda feature: feature["attributes"]["OBJECTID"])
    return manifest, layers
