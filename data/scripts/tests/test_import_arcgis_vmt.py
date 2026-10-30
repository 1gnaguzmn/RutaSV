"""Datos sintéticos: no representan rutas ni paradas reales de transporte."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse

from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from arcgis_source import (  # noqa: E402
    ITEM, ITEM_ID, SERVICE, HttpClient, ImportFailure, fetch_snapshot, load_snapshot,
    parse_ids, read_json, safe_file,
)
from import_arcgis_vmt import (  # noqa: E402
    apply_reviews, csv_bytes, generate_candidates, normalize_records, process_snapshot,
    validate_geojson, validate_output,
)

TO_NATIVE = Transformer.from_crs(4326, 3857, always_xy=True)


def point(lng, lat):
    return list(TO_NATIVE.transform(lng, lat))


def fixtures():
    route = {"attributes": {"OBJECTID": 1, "GlobalID": "11111111-1111-1111-1111-111111111111",
                            "CODIGO_RUTA": "TEST_ROUTE", "NAME": "Ruta ficticia de test",
                            "RECORRIDO": "01", "TIPO_RUTA": "Sintético"},
             "geometry": {"paths": [[point(-89.20, 13.70) + [99], point(-89.18, 13.70) + [99]]]}}
    reverse = copy.deepcopy(route)
    reverse["attributes"].update(OBJECTID=2, GlobalID="22222222-2222-2222-2222-222222222222", RECORRIDO="02")
    reverse["geometry"]["paths"][0].reverse()
    stops = []
    for oid, lng in ((20, -89.195), (10, -89.185)):
        x, y = point(lng, 13.7001)
        stops.append({"attributes": {"OBJECTID": oid, "Ruta": "TEST_ROUTE", "Cod": "I",
                                     "Parada_PGO": f"Parada ficticia {oid}", "Latitud": 13.7001, "Longitud": lng,
                                     "FID_L0Coordenadas_Paradas_AMSS_": 100 - oid}, "geometry": {"x": x, "y": y}})
    manifest = {"snapshot_id": "synthetic", "route_code": "TEST_ROUTE"}
    return manifest, {0: stops, 1: [route, reverse]}


class FakeClient:
    def __init__(self, *, truncated=False, duplicate=False, missing=False, changed=False, json_error=False):
        self.manifest, self.layers = fixtures()
        self.truncated, self.duplicate, self.missing = truncated, duplicate, missing
        self.changed, self.json_error = changed, json_error
        self.meta_calls = {}

    def get(self, url):
        parsed = urlparse(url)
        query = parse_qs(parsed.query)
        base = url.split("?")[0]
        if base == SERVICE:
            obj = {"serviceItemId": ITEM_ID}
        elif base == ITEM:
            obj = {"owner": "synthetic", "orgId": "synthetic", "created": 1, "modified": 2, "licenseInfo": ""}
        elif base.endswith("metadata.xml"):
            return b'<?xml version="1.0"?><metadata><idCredit/></metadata>', {}
        elif base == f"{ITEM}/data":
            obj = {"layers": []}
        elif "community/users/" in base or "portals/" in base:
            obj = {"name": "Synthetic fixture"}
        elif base.startswith(SERVICE + "/"):
            layer = int(parsed.path.split("/FeatureServer/")[1].split("/")[0])
            rows = self.layers[layer]
            if base.endswith("/query"):
                if "returnCountOnly" in query:
                    obj = {"count": len(rows)}
                elif "returnIdsOnly" in query:
                    obj = {"objectIds": [row["attributes"]["OBJECTID"] for row in rows]}
                    if self.duplicate:
                        obj["objectIds"] = [10, 10]
                else:
                    requested = {int(value) for value in query["objectIds"][0].split(",")}
                    selected = [row for row in rows if row["attributes"]["OBJECTID"] in requested]
                    obj = {"features": selected[:-1] if self.missing else selected,
                           "spatialReference": {"wkid": 102100, "latestWkid": 3857}}
                    if self.truncated:
                        obj["exceededTransferLimit"] = True
                    if self.json_error:
                        obj = {"error": {"code": 400, "message": "synthetic failure"}}
            else:
                self.meta_calls[layer] = self.meta_calls.get(layer, 0) + 1
                obj = {"maxRecordCount": 1, "fields": [{"name": "OBJECTID"}, {"name": "Ruta" if layer == 0 else "CODIGO_RUTA"}],
                       "editingInfo": {"dataLastEditDate": 2 if self.changed and self.meta_calls[layer] > 1 else 1}}
        else:
            raise AssertionError(url)
        return json.dumps(obj, ensure_ascii=False).encode("utf-8"), {"content-type": "application/json"}


class CaptureTests(unittest.TestCase):
    def test_capture_integrity_native_geometry_and_immutable_destination(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            raw = fetch_snapshot(root, "TEST_ROUTE", "synthetic", FakeClient())
            manifest, layers = load_snapshot(raw)
            self.assertEqual(manifest["license_status"], "unspecified")
            self.assertEqual(manifest["layers"]["0"]["received"], 2)
            self.assertEqual(len(manifest["layers"]["0"]["batches"]), 2)
            self.assertEqual(layers[1][0]["geometry"]["paths"][0][0][2], 99)
            self.assertLess(layers[1][0]["geometry"]["paths"][0][0][0], -9_000_000)
            with self.assertRaises(FileExistsError):
                fetch_snapshot(root, "TEST_ROUTE", "synthetic", FakeClient())
            batch = raw / manifest["layers"]["0"]["batches"][0]
            batch.write_bytes(batch.read_bytes() + b" ")
            with self.assertRaisesRegex(ImportFailure, "Hash incorrecto"):
                load_snapshot(raw)

    def test_failed_capture_is_preserved_but_cannot_be_processed(self):
        for option in ("truncated", "duplicate", "missing", "changed", "json_error"):
            with self.subTest(option=option), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                with self.assertRaises(ImportFailure):
                    fetch_snapshot(root, "TEST_ROUTE", "failed", FakeClient(**{option: True}))
                raw = root / "raw/arcgis-vmt/failed"
                manifest = read_json((raw / "manifest.json").read_bytes())
                self.assertEqual(manifest["status"], "incomplete")
                self.assertIn("failure", manifest)
                with self.assertRaises(ImportFailure):
                    load_snapshot(raw)

    def test_http_retry_limit_and_no_retry_on_404(self):
        calls = []
        def network_error(*args, **kwargs):
            calls.append(1)
            raise URLError("synthetic socket failure")
        with self.assertRaises(ImportFailure):
            HttpClient(retries=2, opener=network_error, sleep=lambda _: None).get("https://example.invalid")
        self.assertEqual(len(calls), 3)
        calls.clear()
        def not_found(*args, **kwargs):
            calls.append(1)
            raise HTTPError("https://example.invalid", 404, "not found", {}, None)
        with self.assertRaisesRegex(ImportFailure, "HTTP 404"):
            HttpClient(opener=not_found, sleep=lambda _: None).get("https://example.invalid")
        self.assertEqual(len(calls), 1)

    def test_json_errors_ids_and_path_traversal(self):
        for payload in (b'{"error":{"code":500}}', b'not json', b'[]', b'{"x":NaN}'):
            with self.assertRaises(ImportFailure):
                read_json(payload)
        for reply in ({}, {"objectIds": [1, 1]}, {"objectIds": [True]}, {"objectIds": [1], "exceededTransferLimit": True}):
            with self.assertRaises(ImportFailure):
                parse_ids(reply)
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ImportFailure):
                safe_file(Path(tmp), "../escape.json")
            with self.assertRaises(ImportFailure):
                fetch_snapshot(Path(tmp), "TEST_ROUTE", "../escape", FakeClient())
            with self.assertRaises(ImportFailure):
                fetch_snapshot(Path(tmp), "A' OR 1=1", "synthetic", FakeClient())


class GeometryTests(unittest.TestCase):
    def test_native_to_wgs84_is_2d_and_stops_remain_unverified_unordered(self):
        manifest, layers = fixtures()
        routes, stops, rejected, _ = normalize_records(manifest, layers)
        self.assertFalse(rejected)
        self.assertEqual(routes[0]["feature"]["geometry"]["coordinates"][0], [-89.2, 13.7])
        self.assertEqual(routes[0]["feature"]["properties"]["stop_ids"], [])
        self.assertEqual(stops[0]["feature"]["properties"]["verification_status"], "unverified")
        candidates = generate_candidates(routes, stops, manifest["snapshot_id"])
        self.assertEqual(len(candidates), 4)
        forward_i = [row for row in candidates if row["source_recorrido"] == "01"]
        self.assertEqual([row["source_stop_objectid"] for row in forward_i], [20, 10])
        self.assertTrue(all(row["sequence_status"] == "inferred" for row in candidates))
        self.assertTrue(all(10 < row["distance_m"] < 12 for row in candidates))

    def test_empty_multipart_curve_zero_and_inverted_geometries_are_preserved_as_rejections(self):
        invalid = [None, {"paths": []}, {"paths": [[], []]}, {"curvePaths": [[]]},
                   {"paths": [[[0, 0], [0, 0]]]}, {"paths": [[[13.7, -89.2], [13.71, -89.21]]]},
                   {"paths": [[point(-89.2, 13.7), point(-89.2, 13.7)]]}]
        for geometry in invalid:
            with self.subTest(geometry=geometry):
                manifest, layers = fixtures()
                layers[1][0]["geometry"] = geometry
                _, _, rejected, _ = normalize_records(manifest, layers)
                self.assertEqual(len(rejected), 1)
                self.assertEqual(rejected[0]["original"]["geometry"], geometry)

    def test_missing_codes_names_ids_and_coordinate_discrepancy(self):
        manifest, layers = fixtures()
        layers[1][0]["attributes"]["CODIGO_RUTA"] = None
        layers[1][1]["attributes"]["GlobalID"] = None
        layers[0][0]["attributes"]["Parada_PGO"] = " "
        layers[0][1]["attributes"]["Longitud"] += .001
        routes, stops, rejected, warnings = normalize_records(manifest, layers)
        self.assertFalse(routes)
        self.assertEqual(len(stops), 1)
        self.assertEqual(len(rejected), 3)
        self.assertTrue(any(warning["kind"] == "geometry_attribute_coordinates_differ" for warning in warnings))

    def test_duplicate_global_ids_do_not_silently_replace_a_route(self):
        manifest, layers = fixtures()
        layers[1][1]["attributes"]["GlobalID"] = layers[1][0]["attributes"]["GlobalID"]
        routes, _, rejected, _ = normalize_records(manifest, layers)
        self.assertFalse(routes)
        self.assertEqual(len(rejected), 2)

    def test_distances_above_50_and_100_are_flagged_not_attached(self):
        manifest, layers = fixtures()
        for stop, latitude in zip(layers[0], [13.7006, 13.702]):
            x, y = point(-89.19, latitude)
            stop["geometry"] = {"x": x, "y": y}
        routes, stops, _, _ = normalize_records(manifest, layers)
        rows = generate_candidates(routes, stops, manifest["snapshot_id"])
        self.assertEqual({row["spatial_status"] for row in rows}, {"review_50_100m", "excluded_over_100m"})
        self.assertTrue(all(route["feature"]["properties"]["stop_ids"] == [] for route in routes))

    def test_unknown_senses_stay_pending_and_are_reported(self):
        manifest, layers = fixtures()
        layers[1][0]["attributes"]["RECORRIDO"] = ""
        layers[0][0]["attributes"]["Cod"] = "X"
        routes, stops, _, warnings = normalize_records(manifest, layers)
        rows = generate_candidates(routes, stops, manifest["snapshot_id"])
        unknown = [row for row in rows if row["source_stop_cod"] == "X"]
        self.assertTrue(all(row["direction_hypothesis"] == "no" and row["direction_status"] == "pending" for row in unknown))
        self.assertTrue({"unknown_stop_direction", "unknown_route_direction"}.issubset({row["kind"] for row in warnings}))

    def test_stop_rows_at_the_same_position_are_not_merged(self):
        manifest, layers = fixtures()
        layers[0][1]["geometry"] = copy.deepcopy(layers[0][0]["geometry"])
        _, stops, _, _ = normalize_records(manifest, layers)
        self.assertEqual(len(stops), 2)
        self.assertNotEqual(stops[0]["feature"]["properties"]["id"], stops[1]["feature"]["properties"]["id"])


def reviewed_rows(rows):
    selected = copy.deepcopy([row for row in rows if row["source_recorrido"] == "01"])
    for sequence, row in enumerate(selected, 1):
        row.update(reviewed="yes", sequence=sequence, direction="Sentido ficticio revisado en test",
                   orientation="forward", reviewed_by="synthetic test", reviewed_at="2026-10-29T00:00:00Z")
    return selected


class ReviewTests(unittest.TestCase):
    def setUp(self):
        manifest, layers = fixtures()
        self.routes, self.stops, _, _ = normalize_records(manifest, layers)
        self.rows = generate_candidates(self.routes, self.stops, manifest["snapshot_id"])

    def test_only_explicit_review_sets_order_and_keeps_field_verification_null(self):
        review = reviewed_rows(self.rows)
        before = copy.deepcopy(self.routes[0]["feature"]["geometry"]["coordinates"])
        for row in review:
            row["orientation"] = "reverse"
        result = apply_reviews(self.routes, self.rows, csv_bytes(review))
        route = self.routes[0]["feature"]
        self.assertEqual(result["reviewed_associations"], 2)
        self.assertEqual(route["properties"]["stop_ids"], [row["stop_id"] for row in review])
        self.assertEqual(route["geometry"]["coordinates"], list(reversed(before)))
        self.assertEqual(route["properties"]["verification_status"], "unverified")
        self.assertIsNone(route["properties"]["verified_at"])
        self.assertFalse(route["properties"]["stop_sequence_complete"])

    def test_unreviewed_candidate_csv_does_not_promote_inferences(self):
        result = apply_reviews(self.routes, self.rows, csv_bytes(self.rows))
        self.assertEqual(result["reviewed_associations"], 0)
        self.assertEqual(self.routes[0]["feature"]["properties"]["stop_ids"], [])

    def test_invalid_review_sequences_references_and_missing_responsibility_fail(self):
        variants = []
        for key, value in (("stop_id", "missing"), ("snapshot_id", "other"), ("sequence", 9),
                           ("reviewed_by", ""), ("reviewed_at", "2026-10-29"),
                           ("orientation", "automatic"), ("reviewed", "maybe")):
            rows = reviewed_rows(self.rows)
            rows[0][key] = value
            variants.append(rows)
        rows = reviewed_rows(self.rows)
        rows.append(copy.deepcopy(rows[0]))
        variants.append(rows)
        for rows in variants:
            with self.subTest(rows=rows), self.assertRaises(ImportFailure):
                apply_reviews(copy.deepcopy(self.routes), copy.deepcopy(self.rows), csv_bytes(rows))

    def test_far_stop_requires_reason_even_with_manual_review(self):
        rows = reviewed_rows(self.rows)
        self.rows[0]["spatial_status"] = "excluded_over_100m"
        with self.assertRaises(ImportFailure):
            apply_reviews(self.routes, self.rows, csv_bytes(rows))
        rows[0]["override_reason"] = "Excepción ficticia revisada para comprobar el control"
        self.assertEqual(apply_reviews(self.routes, self.rows, csv_bytes(rows))["reviewed_associations"], 2)


class PipelineTests(unittest.TestCase):
    def test_offline_reprocessing_is_deterministic_and_does_not_modify_raw(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            raw = fetch_snapshot(root, "TEST_ROUTE", "synthetic", FakeClient())
            original = {str(path.relative_to(raw)): path.read_bytes() for path in raw.rglob("*") if path.is_file()}
            output_a = process_snapshot(raw, root)
            output_b = process_snapshot(raw, root, output_id="second-run")
            for filename in ("routes.geojson", "stops.geojson", "candidate_route_stops.csv", "quality_report.json"):
                self.assertEqual((output_a / filename).read_bytes(), (output_b / filename).read_bytes())
            self.assertEqual(original, {str(path.relative_to(raw)): path.read_bytes() for path in raw.rglob("*") if path.is_file()})
            quality = validate_output(output_a)
            self.assertFalse(quality["ready_for_publication"])
            self.assertEqual(quality["output"], {"routes": 2, "stops": 2, "candidate_pairs": 4, "rejected": 0})
            with self.assertRaises(FileExistsError):
                process_snapshot(raw, root)
            (output_a / "stops.geojson").write_bytes(b'{}')
            with self.assertRaises(ImportFailure):
                validate_output(output_a)

    def test_output_validation_also_checks_its_original_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            raw = fetch_snapshot(root, "TEST_ROUTE", "synthetic", FakeClient())
            output = process_snapshot(raw, root)
            (raw / "service.json").write_bytes(b'{}')
            with self.assertRaisesRegex(ImportFailure, "Hash incorrecto"):
                validate_output(output)

    def test_geojson_validator_rejects_dangling_references_inverted_axes_and_false_verification(self):
        manifest, layers = fixtures()
        normalized_routes, normalized_stops, _, _ = normalize_records(manifest, layers)
        for problem in ("reference", "axes", "verified", "inferred", "duplicate"):
            routes = {"type": "FeatureCollection", "features": [copy.deepcopy(item["feature"]) for item in normalized_routes]}
            stops = {"type": "FeatureCollection", "features": [copy.deepcopy(item["feature"]) for item in normalized_stops]}
            if problem == "reference":
                routes["features"][0]["properties"]["stop_ids"] = ["absent"]
            elif problem == "axes":
                stops["features"][0]["geometry"]["coordinates"].reverse()
            elif problem == "verified":
                routes["features"][0]["properties"]["verification_status"] = "verified"
            elif problem == "inferred":
                routes["features"][0]["properties"]["stop_ids"] = [stops["features"][0]["properties"]["id"]]
            else:
                stops["features"].append(copy.deepcopy(stops["features"][0]))
            with self.subTest(problem=problem), self.assertRaises(ImportFailure):
                validate_geojson(routes, stops)


if __name__ == "__main__":
    unittest.main()
