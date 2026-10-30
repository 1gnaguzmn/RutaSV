"""Piloto ArcGIS VMT. Nunca publica archivos en el frontend ni escribe una BD."""
from __future__ import annotations

import argparse
import csv
import io
import math
import platform
import sys
import uuid
from collections import Counter, defaultdict
from pathlib import Path

import pyproj
import shapely
from pyproj import Transformer
from shapely.geometry import LineString, Point

from arcgis_source import (
    ITEM_ID, PILOT, SERVICE, VERSION, ImportFailure, fetch_snapshot,
    load_snapshot, read_json, safe_file, sha256, utc_now, valid_snapshot_id, write_json,
)

DATA_ROOT = Path(__file__).resolve().parents[1]
PREFIX = f"arcgis-vmt:{ITEM_ID}"
WGS84 = Transformer.from_crs(3857, 4326, always_xy=True)
METRIC = Transformer.from_crs(3857, 32616, always_xy=True)
FROM_WGS84 = Transformer.from_crs(4326, 32616, always_xy=True)
REVIEW_METERS = 50.0
EXCLUDE_METERS = 100.0
CSV_FIELDS = [
    "snapshot_id", "shape_id", "source_route_objectid", "source_recorrido", "route_code",
    "stop_id", "source_stop_objectid", "source_stop_cod", "stop_name", "distance_m",
    "position_m", "inferred_sequence", "direction_hypothesis", "spatial_status",
    "direction_status", "sequence_status", "reviewed", "sequence", "direction",
    "orientation", "reviewed_by", "reviewed_at", "override_reason",
]
REQUIRED_OUTPUTS = {"routes.geojson", "stops.geojson", "candidate_route_stops.csv",
                    "quality_report.json", "rejected_records.json"}


def text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def finite(value: object) -> bool:
    return type(value) in {int, float} and math.isfinite(value)


def wgs_position(value: object) -> bool:
    # Este importador se limita a El Salvador. También detecta ejes/SR intercambiados.
    return (isinstance(value, (list, tuple)) and len(value) == 2 and all(finite(v) for v in value)
            and -90.3 <= value[0] <= -87.5 and 13.0 <= value[1] <= 14.7)


def convert_position(position: object) -> tuple[list[float], tuple[float, float]]:
    if not isinstance(position, (list, tuple)) or len(position) < 2 or not all(finite(v) for v in position[:2]):
        raise ImportFailure("invalid_coordinates")
    x, y = position[:2]
    lng, lat = WGS84.transform(x, y, errcheck=True)
    if not wgs_position([lng, lat]):
        raise ImportFailure("outside_el_salvador_or_wrong_axes")
    metric = METRIC.transform(x, y, errcheck=True)
    return [round(lng, 7), round(lat, 7)], metric


def provenance(snapshot_id: str, layer: int, attributes: dict) -> dict:
    return {"source": f"{SERVICE}/{layer} · snapshot {snapshot_id}",
            "verification_status": "unverified", "verified_at": None,
            "source_objectid": attributes["OBJECTID"], "source_attributes": attributes,
            "source_snapshot": snapshot_id}


def normalize_records(manifest: dict, layers: dict[int, list[dict]]) -> tuple[list, list, list, list]:
    routes, stops, rejected, warnings = [], [], [], []
    snapshot = manifest["snapshot_id"]
    code = manifest["route_code"]
    guids = Counter(text(row.get("attributes", {}).get("GlobalID")).strip("{}").lower() for row in layers[1])
    for row in layers[1]:
        attributes = row.get("attributes", {})
        try:
            if text(attributes.get("CODIGO_RUTA")) != code:
                raise ImportFailure("missing_or_unmatched_route_code")
            raw_guid = text(attributes.get("GlobalID")).strip("{}").lower()
            if guids[raw_guid] > 1:
                raise ImportFailure("duplicate_global_id")
            try:
                guid = str(uuid.UUID(raw_guid))
            except ValueError as error:
                raise ImportFailure("missing_or_invalid_global_id") from error
            geometry = row.get("geometry")
            if not isinstance(geometry, dict):
                raise ImportFailure("missing_geometry")
            if "curvePaths" in geometry:
                raise ImportFailure("unsupported_curved_geometry")
            paths = geometry.get("paths")
            if not isinstance(paths, list) or not paths:
                raise ImportFailure("empty_geometry")
            if len(paths) != 1:
                raise ImportFailure("unsupported_multipart_geometry")
            if not isinstance(paths[0], list) or len(paths[0]) < 2:
                raise ImportFailure("empty_or_short_linestring")
            pairs = [convert_position(vertex) for vertex in paths[0]]
            line = LineString([pair[1] for pair in pairs])
            if line.is_empty or not line.is_valid or line.length == 0:
                raise ImportFailure("invalid_or_zero_length_geometry")
            direction = text(attributes.get("RECORRIDO"))
            if direction.casefold() not in {"01", "02", "ida", "regreso"}:
                warnings.append({"kind": "unknown_route_direction", "objectid": attributes["OBJECTID"], "value": direction})
            name = text(attributes.get("NAME")) or code
            properties = {**provenance(snapshot, 1, attributes), "id": f"{PREFIX}:shape:{guid}",
                          "route_id": f"{PREFIX}:route:{code}", "short_name": name, "long_name": name,
                          "direction": f"Recorrido {direction or 'sin código'} · sentido pendiente de revisión",
                          "color_key": "a", "stop_ids": [], "stop_sequence_status": "pending",
                          "stop_sequence_complete": False}
            feature = {"type": "Feature", "properties": properties,
                       "geometry": {"type": "LineString", "coordinates": [pair[0] for pair in pairs]}}
            routes.append({"feature": feature, "metric": line, "code": code, "direction": direction})
            if not line.is_simple:
                warnings.append({"kind": "self_intersections_order_ambiguous", "shape_id": properties["id"]})
        except (ImportFailure, pyproj.exceptions.ProjError, shapely.errors.GEOSException) as error:
            rejected.append({"layer": 1, "objectid": attributes.get("OBJECTID"), "reason": str(error), "original": row})
    duplicate_keys = Counter((route["code"], route["direction"]) for route in routes)
    for key, count in sorted(duplicate_keys.items()):
        if count > 1:
            warnings.append({"kind": "duplicate_route_direction", "route_code": key[0], "recorrido": key[1], "count": count})
    for row in layers[0]:
        attributes = row.get("attributes", {})
        try:
            if text(attributes.get("Ruta")) != code:
                raise ImportFailure("missing_or_unmatched_route_code")
            name = text(attributes.get("Parada_PGO"))
            if not name:
                raise ImportFailure("missing_stop_name")
            geometry = row.get("geometry")
            if not isinstance(geometry, dict):
                raise ImportFailure("missing_geometry")
            coordinates, metric = convert_position([geometry.get("x"), geometry.get("y")])
            properties = {**provenance(snapshot, 0, attributes), "id": f"{PREFIX}:stop:0:{attributes['OBJECTID']}", "name": name}
            feature = {"type": "Feature", "properties": properties,
                       "geometry": {"type": "Point", "coordinates": coordinates}}
            point = Point(metric)
            lat, lng = attributes.get("Latitud"), attributes.get("Longitud")
            if finite(lat) and finite(lng) and wgs_position([lng, lat]):
                discrepancy = point.distance(Point(FROM_WGS84.transform(lng, lat, errcheck=True)))
                properties["coordinate_discrepancy_m"] = round(discrepancy, 3)
                if discrepancy > 5:
                    warnings.append({"kind": "geometry_attribute_coordinates_differ", "stop_id": properties["id"], "distance_m": round(discrepancy, 3)})
            cod = text(attributes.get("Cod"))
            if cod.upper() not in {"I", "R"}:
                warnings.append({"kind": "unknown_stop_direction", "stop_id": properties["id"], "value": cod})
            stops.append({"feature": feature, "metric": point, "code": code, "cod": cod})
        except (ImportFailure, pyproj.exceptions.ProjError, shapely.errors.GEOSException) as error:
            rejected.append({"layer": 0, "objectid": attributes.get("OBJECTID"), "reason": str(error), "original": row})
    return routes, stops, rejected, warnings


def generate_candidates(routes: list, stops: list, snapshot: str) -> list[dict]:
    rows = []
    for route in routes:
        for stop in stops:
            if route["code"] != stop["code"]:
                continue
            distance = route["metric"].distance(stop["metric"])
            position = route["metric"].project(stop["metric"])
            hypothesis = (route["direction"].casefold(), stop["cod"].upper()) in {
                ("01", "I"), ("02", "R"), ("ida", "I"), ("regreso", "R")}
            status = "excluded_over_100m" if distance > EXCLUDE_METERS else "review_50_100m" if distance > REVIEW_METERS else "within_50m"
            rows.append({**dict.fromkeys(CSV_FIELDS, ""), "snapshot_id": snapshot,
                         "shape_id": route["feature"]["properties"]["id"],
                         "source_route_objectid": route["feature"]["properties"]["source_objectid"],
                         "source_recorrido": route["direction"], "route_code": route["code"],
                         "stop_id": stop["feature"]["properties"]["id"],
                         "source_stop_objectid": stop["feature"]["properties"]["source_objectid"],
                         "source_stop_cod": stop["cod"], "stop_name": stop["feature"]["properties"]["name"],
                         "distance_m": round(distance, 3), "position_m": round(position, 3),
                         "direction_hypothesis": "yes" if hypothesis else "no", "spatial_status": status,
                         "direction_status": "pending", "sequence_status": "inferred"})
    # Rango candidato independiente por trazado y código I/R, nunca por OBJECTID o FID.
    rows.sort(key=lambda row: (row["shape_id"], row["source_stop_cod"], row["position_m"], row["stop_id"]))
    ranks = Counter()
    for row in rows:
        key = row["shape_id"], row["source_stop_cod"]
        ranks[key] += 1
        row["inferred_sequence"] = ranks[key]
    return rows


def apply_reviews(routes: list, candidates: list[dict], payload: bytes | None) -> dict:
    if payload is None:
        return {"reviewed_shapes": 0, "reviewed_associations": 0}
    from datetime import datetime

    reader = csv.DictReader(io.StringIO(payload.decode("utf-8-sig")))
    required = {"snapshot_id", "shape_id", "stop_id", "reviewed", "sequence", "direction", "orientation", "reviewed_by", "reviewed_at", "override_reason"}
    if not required.issubset(reader.fieldnames or []):
        raise ImportFailure("La tabla de revisión no tiene las columnas requeridas")
    lookup = {(row["shape_id"], row["stop_id"]): row for row in candidates}
    groups = defaultdict(list)
    seen = set()
    for row in reader:
        flag = text(row.get("reviewed")).lower()
        if flag in {"", "no", "false", "0"}:
            continue
        if flag not in {"yes", "true", "1"}:
            raise ImportFailure("Valor reviewed inválido; usar yes o dejar vacío")
        key = row["shape_id"], row["stop_id"]
        if key not in lookup or key in seen or row["snapshot_id"] != lookup[key]["snapshot_id"]:
            raise ImportFailure("Revisión duplicada, de otra instantánea o con referencias inexistentes")
        seen.add(key)
        if not text(row["sequence"]).isdigit() or int(row["sequence"]) < 1:
            raise ImportFailure("La secuencia revisada debe ser un entero positivo")
        if row["orientation"] not in {"forward", "reverse"} or not text(row["direction"]) or not text(row["reviewed_by"]):
            raise ImportFailure("La revisión necesita sentido, orientación y responsable explícitos")
        try:
            date = datetime.fromisoformat(row["reviewed_at"].replace("Z", "+00:00"))
            if date.utcoffset() is None:
                raise ValueError("missing_timezone")
        except (ValueError, TypeError) as error:
            raise ImportFailure("reviewed_at debe ser una fecha ISO con zona horaria") from error
        candidate = lookup[key]
        if candidate["spatial_status"] != "within_50m" and not text(row["override_reason"]):
            raise ImportFailure("Una parada a más de 50 m necesita una justificación explícita")
        groups[row["shape_id"]].append(row)
    for route in routes:
        feature = route["feature"]
        rows = groups.get(feature["properties"]["id"], [])
        if not rows:
            continue
        rows.sort(key=lambda row: int(row["sequence"]))
        if [int(row["sequence"]) for row in rows] != list(range(1, len(rows) + 1)):
            raise ImportFailure("La secuencia debe ser contigua desde 1, sin posiciones duplicadas")
        if len({(row["direction"], row["orientation"]) for row in rows}) != 1:
            raise ImportFailure("La revisión da sentidos u orientaciones contradictorios para un trazado")
        feature["properties"].update({"stop_ids": [row["stop_id"] for row in rows],
                                       "direction": rows[0]["direction"], "stop_sequence_status": "reviewed_subset"})
        if rows[0]["orientation"] == "reverse":
            feature["geometry"]["coordinates"].reverse()
        for row in rows:
            candidate = lookup[row["shape_id"], row["stop_id"]]
            candidate.update({key: row[key] for key in required - {"shape_id", "stop_id", "snapshot_id"}})
            candidate["direction_status"] = "reviewed"
            candidate["sequence_status"] = "reviewed"
    return {"reviewed_shapes": len(groups), "reviewed_associations": len(seen)}


def validate_geojson(routes: dict, stops: dict) -> None:
    def collection(value: dict) -> list:
        if not isinstance(value, dict) or value.get("type") != "FeatureCollection" or not isinstance(value.get("features"), list):
            raise ImportFailure("Colección GeoJSON inválida")
        return value["features"]

    ids = set()
    for feature in collection(stops):
        properties, geometry = feature.get("properties", {}), feature.get("geometry", {})
        identifier = properties.get("id")
        if feature.get("type") != "Feature" or not text(identifier) or identifier in ids or not text(properties.get("name")):
            raise ImportFailure("Parada con identificador/nombre inválido o repetido")
        if geometry.get("type") != "Point" or not wgs_position(geometry.get("coordinates")):
            raise ImportFailure("Parada con coordenadas inválidas/invertidas")
        ids.add(identifier)
        if properties.get("verification_status") != "unverified" or properties.get("verified_at") is not None or not text(properties.get("source")):
            raise ImportFailure("Procedencia o estado de verificación inválidos")
    shape_ids = set()
    for feature in collection(routes):
        properties, geometry = feature.get("properties", {}), feature.get("geometry", {})
        identifier, coordinates = properties.get("id"), geometry.get("coordinates")
        if feature.get("type") != "Feature" or not text(identifier) or identifier in shape_ids:
            raise ImportFailure("Recorrido con identificador inválido o repetido")
        shape_ids.add(identifier)
        if geometry.get("type") != "LineString" or not isinstance(coordinates, list) or len(coordinates) < 2 or not all(wgs_position(p) for p in coordinates):
            raise ImportFailure("LineString inválido o coordenadas invertidas")
        if not all(text(properties.get(key)) for key in ("route_id", "short_name", "long_name", "direction", "source")) or properties.get("color_key") != "a":
            raise ImportFailure("Propiedades del recorrido incompletas")
        stop_ids = properties.get("stop_ids")
        if not isinstance(stop_ids, list) or any(not isinstance(oid, str) or oid not in ids for oid in stop_ids) or len(set(stop_ids)) != len(stop_ids):
            raise ImportFailure("Referencias de paradas inválidas o repetidas")
        if properties.get("verification_status") != "unverified" or properties.get("verified_at") is not None:
            raise ImportFailure("La importación no puede atribuir verificación de campo")
        if stop_ids and properties.get("stop_sequence_status") != "reviewed_subset":
            raise ImportFailure("No se puede exportar una secuencia inferida como revisada")


def csv_bytes(rows: list[dict]) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=CSV_FIELDS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


def process_snapshot(raw: Path, data_root: Path, review: Path | None = None, output_id: str | None = None) -> Path:
    manifest, layers = load_snapshot(raw)
    routes, stops, rejected, warnings = normalize_records(manifest, layers)
    candidates = generate_candidates(routes, stops, manifest["snapshot_id"])
    review_payload = review.read_bytes() if review else None
    review_summary = apply_reviews(routes, candidates, review_payload)
    route_collection = {"type": "FeatureCollection", "features": [route["feature"] for route in routes]}
    stop_collection = {"type": "FeatureCollection", "features": [stop["feature"] for stop in stops]}
    validate_geojson(route_collection, stop_collection)
    duplicate_positions = defaultdict(list)
    for stop in stops:
        duplicate_positions[tuple(stop["feature"]["geometry"]["coordinates"])].append(stop["feature"]["properties"]["id"])
    hypothesis = [row for row in candidates if row["direction_hypothesis"] == "yes"]
    quality = {
        "snapshot_id": manifest["snapshot_id"], "route_code": manifest["route_code"],
        "input_records": {str(layer): len(features) for layer, features in layers.items()},
        "output": {"routes": len(routes), "stops": len(stops), "candidate_pairs": len(candidates), "rejected": len(rejected)},
        "spatial_status_all_code_matched_pairs": dict(sorted(Counter(row["spatial_status"] for row in candidates).items())),
        "unconfirmed_I_01_R_02_hypothesis": {"pairs": len(hypothesis), "over_50m": sum(row["spatial_status"] != "within_50m" for row in hypothesis),
                                            "over_100m": sum(row["spatial_status"] == "excluded_over_100m" for row in hypothesis),
                                            "maximum_distance_m": max((row["distance_m"] for row in hypothesis), default=None)},
        "duplicate_position_groups_not_merged": [group for _, group in sorted(duplicate_positions.items()) if len(group) > 1],
        "warnings": warnings, "reviews": review_summary,
        "pending_shapes": [route["feature"]["properties"]["id"] for route in routes if not route["feature"]["properties"]["stop_ids"]],
        "license_status": manifest.get("license_status", "unspecified"), "ready_for_publication": False,
        "notes": ["Los candidatos no son relaciones ni secuencias confirmadas.",
                  "Los umbrales de distancia son controles de calidad, no garantías de precisión.",
                  "La revisión de asociaciones no equivale a verificación de campo ni confirma vigencia operacional."],
    }
    output_id = valid_snapshot_id(output_id or manifest["snapshot_id"])
    output = data_root / "processed" / "arcgis-vmt" / output_id
    output.mkdir(parents=True, exist_ok=False)
    # Si una escritura falla, provenance.json queda ausente: validate rechazará el resultado incompleto.
    write_json(output / "routes.geojson", route_collection)
    write_json(output / "stops.geojson", stop_collection)
    (output / "candidate_route_stops.csv").write_bytes(csv_bytes(candidates))
    write_json(output / "quality_report.json", quality)
    write_json(output / "rejected_records.json", {"records": rejected})
    if review_payload is not None:
        (output / "reviewed_route_stops.csv").write_bytes(review_payload)
    files = {path.name: sha256(path.read_bytes()) for path in sorted(output.iterdir()) if path.is_file()}
    write_json(output / "provenance.json", {
        "schema_version": 1, "importer_version": VERSION, "processed_at": utc_now(),
        "source_snapshot": manifest["snapshot_id"], "service_url": SERVICE,
        "raw_manifest_sha256": sha256((raw / "manifest.json").read_bytes()),
        "license_status": manifest.get("license_status", "unspecified"), "ready_for_publication": False,
        "declared_dates": manifest.get("declared_dates"), "layer_editing_info": {key: value.get("editing_info") for key, value in manifest["layers"].items()},
        "transformations": {"source_crs": "EPSG:3857", "output_crs": "EPSG:4326", "metric_crs": "EPSG:32616", "always_xy": True, "dimensions": 2, "decimal_places": 7,
                            "review_threshold_m": REVIEW_METERS, "automatic_exclusion_threshold_m": EXCLUDE_METERS,
                            "geometry_preferred_over_coordinate_attributes": True, "physical_stops_merged": False},
        "versions": {"python": platform.python_version(), "shapely": shapely.__version__, "pyproj": pyproj.__version__, "proj": pyproj.proj_version_str},
        "implementation_sha256": {name: sha256((Path(__file__).parent / name).read_bytes())
                                  for name in ("import_arcgis_vmt.py", "arcgis_source.py", "requirements.lock.txt")},
        "review_sha256": sha256(review_payload) if review_payload is not None else None,
        "output_sha256": files,
    })
    validate_output(output)
    return output


def validate_output(output: Path) -> dict:
    provenance_info = read_json((output / "provenance.json").read_bytes())
    raw = output.parents[2] / "raw" / "arcgis-vmt" / valid_snapshot_id(provenance_info["source_snapshot"])
    if sha256((raw / "manifest.json").read_bytes()) != provenance_info.get("raw_manifest_sha256"):
        raise ImportFailure("El manifiesto original ya no coincide con la procedencia del resultado")
    load_snapshot(raw)
    files = provenance_info.get("output_sha256", {})
    if not REQUIRED_OUTPUTS.issubset(files) or provenance_info.get("ready_for_publication") is not False:
        raise ImportFailure("El resultado está incompleto o declara publicación sin revisión")
    for relative, expected in files.items():
        if sha256(safe_file(output, relative).read_bytes()) != expected:
            raise ImportFailure(f"Resultado modificado: {relative}")
    validate_geojson(read_json((output / "routes.geojson").read_bytes()), read_json((output / "stops.geojson").read_bytes()))
    return read_json((output / "quality_report.json").read_bytes())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", type=Path, default=DATA_ROOT)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "run"):
        command = commands.add_parser(name)
        command.add_argument("--route-code", default=PILOT)
        command.add_argument("--snapshot-id")
    process = commands.add_parser("process")
    process.add_argument("snapshot_id")
    process.add_argument("--review", type=Path)
    process.add_argument("--output-id")
    validate = commands.add_parser("validate")
    validate.add_argument("output_id")
    args = parser.parse_args(argv)
    try:
        data_root = args.data_root.resolve()
        if args.command in {"fetch", "run"}:
            raw = fetch_snapshot(data_root, args.route_code, args.snapshot_id)
            print(f"Originales: {raw}")
            if args.command == "fetch":
                return 0
            output = process_snapshot(raw, data_root)
        elif args.command == "process":
            snapshot_id = valid_snapshot_id(args.snapshot_id)
            output = process_snapshot(data_root / "raw" / "arcgis-vmt" / snapshot_id, data_root, args.review, args.output_id)
        else:
            output = data_root / "processed" / "arcgis-vmt" / valid_snapshot_id(args.output_id)
        quality = validate_output(output)
        print(f"Procesados: {output}")
        print(f"Resultado: {quality['output']}")
        print(f"Revisión: {quality['reviews']}; licencia: {quality['license_status']}; publicación: pendiente")
        return 0
    except (ImportFailure, OSError, KeyError, TypeError, UnicodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
