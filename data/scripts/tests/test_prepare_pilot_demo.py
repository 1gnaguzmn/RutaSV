"""Fixtures sintéticas de 31 puntos; nunca se escriben en el frontend real."""
import copy
import tempfile
import unittest
from pathlib import Path

from arcgis_source import ImportFailure, fetch_snapshot, read_json, sha256
from import_arcgis_vmt import process_snapshot
from prepare_pilot_demo import prepare, prepare_collections
from test_import_arcgis_vmt import FakeClient


def synthetic_source(root):
    client = FakeClient()
    for route in client.layers[1]:
        route['attributes']['CODIGO_RUTA'] = 'AB008A0SS'
    template = client.layers[0][0]
    client.layers[0] = []
    for index in range(31):
        stop = copy.deepcopy(template)
        stop['attributes'].update(OBJECTID=100 + index, Ruta='AB008A0SS', Cod='I' if index < 14 else 'R')
        client.layers[0].append(stop)
    raw = fetch_snapshot(root, 'AB008A0SS', 'synthetic-pilot', client)
    return process_snapshot(raw, root)


class PreparationTests(unittest.TestCase):
    def test_copies_geometry_and_ids_without_changing_captures_and_is_deterministic(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = synthetic_source(root)
            before = {str(path): sha256(path.read_bytes()) for folder in ('raw', 'processed') for path in (root / folder).rglob('*') if path.is_file()}
            target = root / 'frontend/data/pilot'
            result = prepare(source, target)
            self.assertEqual((result['routes'], result['shapes'], result['stops']), (1, 2, 31))
            counts = {}
            for filename in ('routes.geojson', 'stops.geojson'):
                original = read_json((source / filename).read_bytes())['features']
                copied = read_json((target / filename).read_bytes())['features']
                self.assertEqual([f['geometry'] for f in original], [f['geometry'] for f in copied])
                self.assertEqual([f['properties']['id'] for f in original], [f['properties']['id'] for f in copied])
                for feature in copied:
                    self.assertIsNone(feature['properties']['verified_at'])
                    self.assertEqual(feature['properties']['verification_status'], 'unverified')
                    if filename == 'stops.geojson':
                        code = feature['properties']['source_direction_code']
                        counts[code] = counts.get(code, 0) + 1
                    else:
                        self.assertEqual(feature['properties']['stop_ids'], [])
            self.assertEqual(counts, {'I': 14, 'R': 17})
            hashes = {path.name: sha256(path.read_bytes()) for path in target.iterdir()}
            prepare(source, target)
            self.assertEqual(hashes, {path.name: sha256(path.read_bytes()) for path in target.iterdir()})
            self.assertEqual(before, {str(path): sha256(path.read_bytes()) for folder in ('raw', 'processed') for path in (root / folder).rglob('*') if path.is_file()})
            with self.assertRaises(ImportFailure):
                prepare(source, source)

    def test_rejects_unexpected_directions_counts_and_false_verification(self):
        with tempfile.TemporaryDirectory() as directory:
            source = synthetic_source(Path(directory))
            routes = read_json((source / 'routes.geojson').read_bytes())
            stops = read_json((source / 'stops.geojson').read_bytes())
            provenance = read_json((source / 'provenance.json').read_bytes())
            for problem in ('direction', 'count', 'verification'):
                changed = copy.deepcopy(stops)
                if problem == 'direction':
                    changed['features'][0]['properties']['source_attributes']['Cod'] = 'X'
                elif problem == 'count':
                    changed['features'].pop()
                else:
                    changed['features'][0]['properties']['verified_at'] = '2026-10-29'
                with self.subTest(problem=problem), self.assertRaises(ImportFailure):
                    prepare_collections(routes, changed, provenance)


if __name__ == '__main__':
    unittest.main()
