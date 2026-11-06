"""Prepare classroom scenarios only; never modify the imported VMT GeoJSON."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRANSIT = ROOT / "public/data/transit"
ROUTES = json.loads((TRANSIT / "routes.geojson").read_text(encoding="utf-8"))["features"]
STOPS = json.loads((TRANSIT / "stops.geojson").read_text(encoding="utf-8"))["features"]


def distance(a, b):
    return 6371000 * math.hypot(math.radians(a[0] - b[0]) * math.cos(math.radians((a[1] + b[1]) / 2)), math.radians(a[1] - b[1]))


def shape(code, direction, index=0):
    return [r for r in ROUTES if r["properties"]["source_route_code"] == code and r["properties"]["recorrido_code"] == direction][index]


def parts(g):
    return [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]


def length(g):
    return round(sum(distance(a, b) for p in parts(g) for a, b in zip(p, p[1:])))


def endpoint(g, end=False):
    return parts(g)[-1][-1] if end else parts(g)[0][0]


def bus(route, a, b, multipart=False):
    original = route["geometry"]
    if multipart:
        p = original["coordinates"]
        last = min(range(len(p[2])), key=lambda i: distance(p[2][i], b))
        geometry = {"type": "MultiLineString", "coordinates": [list(reversed(p[0])), p[1], p[2][:max(1, last) + 1]]}
    else:
        points = original["coordinates"]
        start = min(range(len(points)), key=lambda i: distance(points[i], a))
        end = min(range(len(points)), key=lambda i: distance(points[i], b))
        selected = points[min(start, end):max(start, end) + 1]
        assert len(selected) > 1
        geometry = {"type": "LineString", "coordinates": selected if start < end else list(reversed(selected))}
    points = [point for part in parts(geometry) for point in part]
    available = [s for s in STOPS if route["properties"]["id"] in s["properties"].get("shape_ids", [s["properties"].get("shape_id")])]
    selected = []
    for fraction in (0, .5, 1):
        target = points[round((len(points) - 1) * fraction)]
        candidate = min(available, key=lambda s: distance(s["geometry"]["coordinates"], target))
        if candidate not in selected:
            selected.append(candidate)
    return {"mode": "bus", "label": f'Ruta {route["properties"]["short_name"]} · recorrido {route["properties"]["recorrido_code"]}',
            "minutes": max(6, math.ceil(length(geometry) / 240) + 3), "distanceM": length(geometry), "geometry": geometry,
            "shapeId": route["properties"]["id"], "routeName": route["properties"]["short_name"],
            "stopIds": [s["properties"]["id"] for s in selected], "stopNames": [s["properties"]["name"] for s in selected]}


PLACES = [{"id": "south", "name": "Casa sur", "coordinates": [-89.217, 13.691]},
          {"id": "center", "name": "Centro", "coordinates": [-89.1908, 13.699]},
          {"id": "east", "name": "Casa oriente", "coordinates": [-89.118, 13.709]},
          {"id": "university", "name": "Universidad", "coordinates": [-89.203, 13.717]}]
P = {p["id"]: p["coordinates"] for p in PLACES}


def itinerary(identifier, origin, destination, name, buses):
    legs, previous = [], P[origin]
    for i, ride in enumerate(buses):
        geometry = {"type": "LineString", "coordinates": [previous, endpoint(ride["geometry"])]}
        metres = length(geometry)
        legs.append({"mode": "walk", "label": "Camina al abordaje de ejemplo" if i == 0 else "Camina para transbordar", "minutes": max(1, math.ceil(metres / 75)), "distanceM": metres, "geometry": geometry, "stopIds": [], "stopNames": []})
        legs.append(ride)
        previous = endpoint(ride["geometry"], True)
    geometry = {"type": "LineString", "coordinates": [previous, P[destination]]}
    metres = length(geometry)
    legs.append({"mode": "walk", "label": "Camina al destino de ejemplo", "minutes": max(1, math.ceil(metres / 75)), "distanceM": metres, "geometry": geometry, "stopIds": [], "stopNames": []})
    for i, leg in enumerate(legs):
        leg["id"] = f"{identifier}-{i}"
    return {"id": identifier, "originId": origin, "destinationId": destination, "name": name, "simulated": True, "legs": legs}


def build():
    s, c, e, u = (P[k] for k in ("south", "center", "east", "university"))
    t = [-89.204, 13.705]
    trips = [
        itinerary("south-transfer", "south", "university", "8-A + 30A", [bus(shape("AB008A0SS", "01"), s, t), bus(shape("MB030A0", "02"), t, u)]),
        itinerary("south-2c", "south", "university", "8-A + 2-C", [bus(shape("AB008A0SS", "01"), s, c), bus(shape("AB002C0", "02"), c, u)]),
        itinerary("south-walk", "south", "university", "8-A y más caminata", [bus(shape("AB008A0SS", "01"), s, t)]),
        itinerary("center-30a", "center", "university", "30A directo", [bus(shape("MB030A0", "02"), c, u)]),
        itinerary("center-2c", "center", "university", "2-C directo", [bus(shape("AB002C0", "02", 1), c, u)]),
        itinerary("center-multipart", "center", "university", "30A · variante multipartita", [bus(shape("MB030A0", "01"), c, u, True)]),
        itinerary("east-29g", "east", "center", "29G · opción cercana", [bus(shape("AB029G0", "01"), e, c)]),
        itinerary("east-walk", "east", "center", "29G · más caminata final", [bus(shape("AB029G0", "02"), e, [-89.199, 13.705])]),
    ]
    return {"version": 1, "notice": "Lugares de ejemplo. Caminatas rectas, secuencias, orientación de clips, tiempos e incidentes SIMULADOS; no son instrucciones operativas. Procedencia VMT en transit/.", "places": PLACES, "itineraries": trips, "incidents": [
        {"id": "traffic", "title": "Tráfico intenso simulado", "description": "Demora de 15 min en ejemplos con 8-A o 30A.", "delayMinutes": 15, "affectedRouteNames": ["8-A", "30A"], "blockedItineraryIds": []},
        {"id": "closure", "title": "Cierre simulado", "description": "Un enlace de cada viaje preparado está bloqueado; consulta otra alternativa.", "delayMinutes": 0, "affectedRouteNames": ["8-A", "30A", "29G", "2-C"], "blockedItineraryIds": ["south-walk", "center-2c", "east-29g"]},
        {"id": "route-change", "title": "Cambio de recorrido simulado", "description": "El primer abordaje se mueve 150 m en el ejemplo; camina al nuevo punto señalado.", "delayMinutes": 3, "affectedRouteNames": ["8-A", "30A", "29G", "2-C"], "blockedItineraryIds": []}]}


if __name__ == "__main__":
    target = ROOT / "public/data/demo/scenarios.json"
    target.write_text(json.dumps(build(), ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("Prepared 3 example trips / 8 alternatives")
