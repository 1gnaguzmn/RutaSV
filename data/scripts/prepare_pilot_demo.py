"""Prepara una copia estática del piloto para la demo; no modifica la captura."""
from __future__ import annotations

import argparse
import copy
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from arcgis_source import ImportFailure, json_bytes, read_json
from import_arcgis_vmt import validate_output

ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = "20261029T224448147697Z"
SOURCE = ROOT / "data" / "processed" / "arcgis-vmt" / SNAPSHOT
OUTPUT = ROOT / "test-rutasv" / "public" / "data" / "pilot"
DIRECTION_MAPPING = {"I": "01", "R": "02"}


def prepare_collections(routes: dict, stops: dict, provenance: dict) -> tuple[dict, dict]:
    routes, stops = copy.deepcopy(routes), copy.deepcopy(stops)
    by_direction = {}
    for feature in routes["features"]:
        p = feature["properties"]
        attributes = p["source_attributes"]
        code, direction = attributes.get("CODIGO_RUTA"), attributes.get("RECORRIDO")
        if code != "AB008A0SS" or direction not in {"01", "02"} or direction in by_direction or p["stop_ids"]:
            raise ImportFailure("El conjunto no corresponde al piloto esperado con secuencias pendientes")
        by_direction[direction] = p["id"]
        p.update(source_route_code=code, recorrido_code=direction, direction=f"Recorrido {direction}")
    if set(by_direction) != {"01", "02"}:
        raise ImportFailure("El piloto debe contener los dos recorridos 01 y 02")
    counts = Counter()
    for feature in stops["features"]:
        p = feature["properties"]
        attributes = p["source_attributes"]
        cod = attributes.get("Cod")
        if attributes.get("Ruta") != "AB008A0SS" or cod not in DIRECTION_MAPPING:
            raise ImportFailure("Parada con ruta o código de sentido inesperado")
        counts[cod] += 1
        p.update(source_route_code=attributes["Ruta"], source_direction_code=cod,
                 shape_id=by_direction[DIRECTION_MAPPING[cod]], association_basis="demo_direction_mapping")
    if counts != {"I": 14, "R": 17}:
        raise ImportFailure(f"Conteos inesperados para la instantánea piloto: {dict(counts)}")
    for collection, layer in ((routes, "1"), (stops, "0")):
        epoch = provenance["layer_editing_info"][layer]["dataLastEditDate"]
        date = datetime.fromtimestamp(epoch / 1000, timezone.utc).isoformat(timespec="milliseconds")
        for feature in collection["features"]:
            p = feature["properties"]
            if p["verification_status"] != "unverified" or p["verified_at"] is not None:
                raise ImportFailure("El piloto no debe declarar verificación de campo")
            p.update(source_label="VMT / ArcGIS", source_updated_at=date)
    return routes, stops


def prepare(source: Path = SOURCE, output: Path = OUTPUT) -> dict:
    source, output = source.resolve(), output.resolve()
    data_root = source.parents[2]
    if any(output.is_relative_to(data_root / name) for name in ("raw", "processed")):
        raise ImportFailure("La preparación no puede escribir dentro de originales o procesados")
    validate_output(source)
    routes, stops = prepare_collections(
        read_json((source / "routes.geojson").read_bytes()),
        read_json((source / "stops.geojson").read_bytes()),
        read_json((source / "provenance.json").read_bytes()),
    )
    payloads = {"routes.geojson": json_bytes(routes), "stops.geojson": json_bytes(stops)}
    output.mkdir(parents=True, exist_ok=True)
    for filename, payload in payloads.items():
        (output / filename).write_bytes(payload)
    return {"routes": 1, "shapes": len(routes["features"]), "stops": len(stops["features"]),
            "mapping": DIRECTION_MAPPING, "output": str(output)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.source, args.output), ensure_ascii=False))
        return 0
    except (ImportFailure, OSError, KeyError, TypeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
