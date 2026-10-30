"""Importa el catálogo configurado y prepara GeoJSON estático sin alterar capturas."""
from __future__ import annotations

import argparse
import copy
import json
import re
import sys
import tempfile
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from arcgis_source import ImportFailure, SERVICE, fetch_snapshot, json_bytes, read_json, sha256
from import_arcgis_vmt import process_snapshot, validate_geojson, validate_output

ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = ROOT / "data"
CONFIG = DATA_ROOT / "demo_routes.json"
SOURCES = DATA_ROOT / "demo_sources.json"
OUTPUT = ROOT / "test-rutasv" / "public" / "data" / "transit"


def load_config(path: Path) -> dict:
    config = read_json(path.read_bytes())
    if config.get("schema_version") != 1 or config.get("direction_mapping") != {"I": "01", "R": "02"}:
        raise ImportFailure("Configuración o correspondencia de sentidos no compatible")
    routes = config.get("routes")
    if not isinstance(routes, list) or not routes:
        raise ImportFailure("El catálogo necesita rutas")
    codes = set()
    for route in routes:
        if not isinstance(route, dict):
            raise ImportFailure("Cada ruta del catálogo debe ser un objeto")
        code, name = route.get("code"), route.get("short_name")
        if not isinstance(code, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,50}", code) or code in codes:
            raise ImportFailure("Código de ruta inválido o repetido")
        if not isinstance(name, str) or not name.strip():
            raise ImportFailure("Nombre de presentación vacío")
        codes.add(code)
    if config.get("initial_route_code") not in codes:
        raise ImportFailure("La ruta inicial no está en el catálogo")
    return config


def read_sources(path: Path) -> dict:
    sources = read_json(path.read_bytes()) if path.exists() else {"schema_version": 1, "processed_outputs": {}}
    if sources.get("schema_version") != 1 or not isinstance(sources.get("processed_outputs"), dict):
        raise ImportFailure("Índice de instantáneas inválido")
    return sources


def replace_json(path: Path, value: dict) -> None:
    # Solo para índices/copia derivada; nunca para raw/ ni processed/.
    payload = json_bytes(value)
    if path.exists() and path.read_bytes() == payload:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}-", suffix=".tmp", delete=False) as handle:
        handle.write(payload)
        temporary = Path(handle.name)
    try:
        for attempt in range(5):
            try:
                temporary.replace(path)
                break
            except PermissionError:
                if attempt == 4:
                    raise
                time.sleep(0.05 * (attempt + 1))
    finally:
        temporary.unlink(missing_ok=True)


def processed_path(data_root: Path, output_id: str) -> Path:
    from arcgis_source import valid_snapshot_id
    return data_root / "processed" / "arcgis-vmt" / valid_snapshot_id(output_id)


def check_destination(path: Path, data_root: Path) -> None:
    if any(path.resolve().is_relative_to((data_root / name).resolve()) for name in ("raw", "processed")):
        raise ImportFailure("No se permite escribir la copia derivada dentro de originales o procesados")


def capture_missing(config: dict, sources_path: Path, data_root: Path) -> dict:
    check_destination(sources_path, data_root)
    sources = read_sources(sources_path)
    for spec in config["routes"]:
        code = spec["code"]
        existing = sources["processed_outputs"].get(code)
        if existing:
            quality = validate_output(processed_path(data_root, existing))
            if quality["route_code"] != code:
                raise ImportFailure(f"La instantánea registrada para {code} corresponde a otra ruta")
            continue
        raw = fetch_snapshot(data_root, code)
        output = process_snapshot(raw, data_root, allow_multipart=True)
        sources["processed_outputs"][code] = output.name
        # Guardar progreso para no volver a descargar rutas si falla una posterior.
        replace_json(sources_path, sources)
        print(f"Capturada {code}: {output.name}", flush=True)
    return sources


def prepare_route(routes: dict, stops: dict, provenance: dict, spec: dict, mapping: dict) -> tuple[dict, dict, dict]:
    routes, stops = copy.deepcopy(routes), copy.deepcopy(stops)
    code = spec["code"]
    by_direction = defaultdict(list)
    names = set()
    for feature in routes["features"]:
        p = feature["properties"]
        attributes = p["source_attributes"]
        direction = str(attributes.get("RECORRIDO") or "").strip()
        if str(attributes.get("CODIGO_RUTA") or "").strip() != code or direction not in mapping.values() or p["stop_ids"]:
            raise ImportFailure(f"{code}: ruta, recorrido o secuencia inesperados")
        names.add(p["short_name"])
        by_direction[direction].append(feature)
        p.update(source_route_code=code, recorrido_code=direction, short_name=spec["short_name"],
                 direction=f"Recorrido {direction}", is_initial_route=spec.get("initial", False))
    if not routes["features"]:
        raise ImportFailure(f"{code}: no hay trazados válidos")
    for direction, variants in by_direction.items():
        if len(variants) > 1:
            for feature in variants:
                p = feature["properties"]
                p["direction"] = f"Recorrido {direction} · registro {p['source_objectid']}"
    counts = Counter()
    ambiguous = 0
    for feature in stops["features"]:
        p = feature["properties"]
        attributes = p["source_attributes"]
        cod = str(attributes.get("Cod") or "").strip()
        if str(attributes.get("Ruta") or "").strip() != code or cod not in mapping:
            raise ImportFailure(f"{code}: parada con ruta o sentido inesperados")
        related = by_direction[mapping[cod]]
        if not related:
            raise ImportFailure(f"{code}: parada sin trazado compatible")
        shape_ids = sorted(route["properties"]["id"] for route in related)
        p.update(source_route_code=code, source_direction_code=cod, shape_ids=shape_ids,
                 association_basis="demo_direction_mapping")
        if len(shape_ids) == 1:
            p["shape_id"] = shape_ids[0]
        else:
            ambiguous += 1
        counts[cod] += 1
    for collection, layer in ((routes, "1"), (stops, "0")):
        epoch = provenance["layer_editing_info"][layer]["dataLastEditDate"]
        date = datetime.fromtimestamp(epoch / 1000, timezone.utc).isoformat(timespec="milliseconds")
        for feature in collection["features"]:
            p = feature["properties"]
            if p["verification_status"] != "unverified" or p["verified_at"] is not None:
                raise ImportFailure("La preparación no puede declarar verificación de campo")
            p.update(source_label="VMT / ArcGIS", source_updated_at=date)
    summary = {"code": code, "short_name": spec["short_name"], "source_names": sorted(names),
               "source_snapshot": provenance["source_snapshot"], "shapes": len(routes["features"]),
               "stops": len(stops["features"]), "stops_by_source_direction": dict(sorted(counts.items())),
               "multipart_shapes": sum(f["geometry"]["type"] == "MultiLineString" for f in routes["features"]),
               "ambiguous_stop_associations": ambiguous,
               "source_updated_at": routes["features"][0]["properties"]["source_updated_at"],
               "license_status": provenance["license_status"],
               "missing_stops": not stops["features"],
               "variants": [{"id": f["properties"]["id"], "recorrido_code": f["properties"]["recorrido_code"],
                             "source_objectid": f["properties"]["source_objectid"],
                             "geometry_type": f["geometry"]["type"]} for f in routes["features"]]}
    return routes, stops, summary


def prepare(config_path: Path = CONFIG, sources_path: Path = SOURCES,
            data_root: Path = DATA_ROOT, output: Path = OUTPUT) -> dict:
    check_destination(output, data_root)
    config, sources = load_config(config_path), read_sources(sources_path)
    routes = {"type": "FeatureCollection", "features": []}
    stops = {"type": "FeatureCollection", "features": []}
    summaries = []
    for spec in config["routes"]:
        code = spec["code"]
        output_id = sources["processed_outputs"].get(code)
        if not output_id:
            raise ImportFailure(f"Falta capturar {code}; ejecutar primero fetch o run")
        source = processed_path(data_root, output_id)
        quality = validate_output(source)
        if quality["route_code"] != code or quality["output"]["rejected"]:
            raise ImportFailure(f"{code}: captura incorrecta o registros rechazados; revisar quality_report.json")
        prepared_routes, prepared_stops, summary = prepare_route(
            read_json((source / "routes.geojson").read_bytes()),
            read_json((source / "stops.geojson").read_bytes()),
            read_json((source / "provenance.json").read_bytes()),
            {**spec, "initial": code == config["initial_route_code"]}, config["direction_mapping"])
        summary.update(processed_output=output_id, provenance_sha256=sha256((source / "provenance.json").read_bytes()))
        routes["features"].extend(prepared_routes["features"])
        stops["features"].extend(prepared_stops["features"])
        summaries.append(summary)
    validate_geojson(routes, stops)
    known_shapes = {f["properties"]["id"]: f["properties"]["source_route_code"] for f in routes["features"]}
    for stop in stops["features"]:
        p = stop["properties"]
        if any(known_shapes.get(shape) != p["source_route_code"] for shape in p["shape_ids"]):
            raise ImportFailure("Asociación de parada con una ruta inexistente o distinta")
    payloads = {"routes.geojson": routes, "stops.geojson": stops}
    catalog = {"schema_version": 1, "source": SERVICE, "source_label": "VMT / ArcGIS",
               "config_sha256": sha256(config_path.read_bytes()),
               "preparation_sha256": sha256(Path(__file__).read_bytes()),
               "direction_mapping": config["direction_mapping"], "routes": summaries,
               "counts": {"routes": len(summaries), "shapes": len(routes["features"]), "stops": len(stops["features"])},
               "output_sha256": {name: sha256(json_bytes(value)) for name, value in payloads.items()}}
    # Validar el conjunto entero antes de reemplazar la copia que consume Vite.
    for filename, value in {**payloads, "catalog.json": catalog}.items():
        replace_json(output / filename, value)
    return catalog


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("fetch", "prepare", "run"))
    parser.add_argument("--config", type=Path, default=CONFIG)
    parser.add_argument("--sources", type=Path, default=SOURCES)
    parser.add_argument("--data-root", type=Path, default=DATA_ROOT)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    try:
        config = load_config(args.config)
        if args.command in {"fetch", "run"}:
            capture_missing(config, args.sources, args.data_root)
        if args.command in {"prepare", "run"}:
            catalog = prepare(args.config, args.sources, args.data_root, args.output)
            print(json.dumps(catalog["counts"], ensure_ascii=False))
        return 0
    except (ImportFailure, OSError, KeyError, TypeError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
