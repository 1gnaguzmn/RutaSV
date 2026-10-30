"""Catálogo sintético: descarga reutilizable, multipartes y asociaciones ambiguas."""
import copy
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from arcgis_source import ImportFailure, fetch_snapshot, json_bytes, read_json, sha256
from import_arcgis_vmt import process_snapshot, validate_geojson
from import_demo_routes import capture_missing, load_config, prepare, replace_json
from test_import_arcgis_vmt import FakeClient, point


def synthetic_source(root, code, seed, *, duplicate=False, multipart=False, no_stops=False):
    client = FakeClient()
    for index, row in enumerate(client.layers[1]):
        row['attributes'].update(CODIGO_RUTA=code, OBJECTID=seed * 100 + index,
                                 GlobalID=str(uuid.UUID(int=seed * 100 + index)))
    if multipart:
        client.layers[1][0]['geometry']['paths'].append([point(-89.17, 13.70), point(-89.16, 13.70)])
    if duplicate:
        for row in copy.deepcopy(client.layers[1]):
            row['attributes']['OBJECTID'] += 10
            row['attributes']['GlobalID'] = str(uuid.UUID(int=row['attributes']['OBJECTID']))
            client.layers[1].append(row)
    for index, row in enumerate(client.layers[0]):
        row['attributes'].update(Ruta=code, OBJECTID=seed * 100 + index, Cod='I' if index == 0 else 'R')
    if no_stops:
        client.layers[0] = []
    raw = fetch_snapshot(root, code, f'synthetic-{seed}', client)
    return process_snapshot(raw, root, allow_multipart=True)


def setup_catalog(root):
    outputs = {}
    for seed, code, options in [(1, 'TEST_A', {'multipart': True}),
                                (2, 'TEST_B', {'duplicate': True}),
                                (3, 'TEST_C', {'no_stops': True})]:
        outputs[code] = synthetic_source(root, code, seed, **options).name
    config = {'schema_version': 1, 'direction_mapping': {'I': '01', 'R': '02'},
              'initial_route_code': 'TEST_A',
              'routes': [{'code': code, 'short_name': code} for code in outputs]}
    config_path, sources_path = root / 'config.json', root / 'sources.json'
    config_path.write_bytes(json_bytes(config))
    sources_path.write_bytes(json_bytes({'schema_version': 1, 'processed_outputs': outputs}))
    return config_path, sources_path


class CatalogTests(unittest.TestCase):
    def test_unchanged_files_are_not_replaced_and_temporary_windows_lock_is_retried(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'derived.json'
            replace_json(path, {'value': 1})
            with patch.object(Path, 'replace', side_effect=AssertionError('No debe reemplazar archivos idénticos')):
                replace_json(path, {'value': 1})
            original_replace = Path.replace
            attempts = []
            def locked_once(temporary, target):
                attempts.append(1)
                if len(attempts) == 1:
                    raise PermissionError('Bloqueo simulado de Windows')
                return original_replace(temporary, target)
            with patch.object(Path, 'replace', locked_once), patch('import_demo_routes.time.sleep'):
                replace_json(path, {'value': 2})
            self.assertEqual(len(attempts), 2)
            self.assertEqual(read_json(path.read_bytes()), {'value': 2})
            self.assertEqual(list(Path(tmp).glob('*.tmp')), [])

    def test_full_catalog_preserves_geometry_provenance_and_ambiguous_stops_without_double_counting(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            config, sources = setup_catalog(root)
            before = {str(p): sha256(p.read_bytes()) for name in ('raw', 'processed')
                      for p in (root / name).rglob('*') if p.is_file()}
            output = root / 'frontend/data/transit'
            catalog = prepare(config, sources, root, output)
            self.assertEqual(catalog['counts'], {'routes': 3, 'shapes': 8, 'stops': 4})
            routes = read_json((output / 'routes.geojson').read_bytes())
            stops = read_json((output / 'stops.geojson').read_bytes())
            b_stops = [s['properties'] for s in stops['features'] if s['properties']['source_route_code'] == 'TEST_B']
            self.assertEqual([len(s['shape_ids']) for s in b_stops], [2, 2])
            self.assertTrue(all('shape_id' not in s for s in b_stops))
            self.assertTrue(catalog['routes'][2]['missing_stops'])
            self.assertEqual(catalog['routes'][1]['ambiguous_stop_associations'], 2)
            b_variants = [r['properties']['direction'] for r in routes['features'] if r['properties']['source_route_code'] == 'TEST_B']
            self.assertEqual(len(set(b_variants)), 4)
            for summary in catalog['routes']:
                original = root / 'processed/arcgis-vmt' / summary['processed_output']
                expected = read_json((original / 'routes.geojson').read_bytes())['features']
                actual = [r for r in routes['features'] if r['properties']['source_route_code'] == summary['code']]
                self.assertEqual([f['geometry'] for f in expected], [f['geometry'] for f in actual])
                self.assertTrue(all(not f['properties']['stop_ids'] and f['properties']['verified_at'] is None for f in actual))
            hashes = {p.name: sha256(p.read_bytes()) for p in output.iterdir()}
            prepare(config, sources, root, output)
            self.assertEqual(hashes, {p.name: sha256(p.read_bytes()) for p in output.iterdir()})
            self.assertEqual(before, {str(p): sha256(p.read_bytes()) for name in ('raw', 'processed')
                                    for p in (root / name).rglob('*') if p.is_file()})

    def test_missing_or_wrong_snapshot_fails_before_replacing_public_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            config, sources = setup_catalog(root)
            target = root / 'public'
            prepare(config, sources, root, target)
            before = {p.name: p.read_bytes() for p in target.iterdir()}
            index = read_json(sources.read_bytes())
            for problem in ('missing', 'wrong'):
                changed = copy.deepcopy(index)
                if problem == 'missing':
                    changed['processed_outputs'].pop('TEST_B')
                else:
                    changed['processed_outputs']['TEST_B'] = changed['processed_outputs']['TEST_A']
                sources.write_bytes(json_bytes(changed))
                with self.assertRaises(ImportFailure):
                    prepare(config, sources, root, target)
                self.assertEqual(before, {p.name: p.read_bytes() for p in target.iterdir()})
            with self.assertRaises(ImportFailure):
                prepare(config, sources, root, root / 'raw')

    def test_capture_reuses_validated_snapshots_without_network(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            config, sources = setup_catalog(root)
            before = sources.read_bytes()
            with patch('import_demo_routes.fetch_snapshot', side_effect=AssertionError('No debe descargar')):
                capture_missing(load_config(config), sources, root)
            self.assertEqual(before, sources.read_bytes())

    def test_config_rejects_duplicates_sql_and_unknown_initial_route(self):
        config = {'schema_version': 1, 'direction_mapping': {'I': '01', 'R': '02'},
                  'initial_route_code': 'TEST', 'routes': [{'code': 'TEST', 'short_name': 'Test'}]}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'config.json'
            for problem in ('duplicate', 'sql', 'initial', 'structure'):
                changed = copy.deepcopy(config)
                if problem == 'duplicate':
                    changed['routes'].append(changed['routes'][0])
                elif problem == 'sql':
                    changed['routes'][0]['code'] = "A' OR 1=1"
                elif problem == 'structure':
                    changed['routes'][0] = 'TEST'
                else:
                    changed['initial_route_code'] = 'MISSING'
                path.write_bytes(json_bytes(changed))
                with self.assertRaises(ImportFailure):
                    load_config(path)

    def test_failed_batch_preserves_completed_captures_in_resume_index(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            config, sources = setup_catalog(root)
            outputs = read_json(sources.read_bytes())['processed_outputs']
            sources.write_bytes(json_bytes({'schema_version': 1, 'processed_outputs': {'TEST_A': outputs['TEST_A']}}))
            with patch('import_demo_routes.fetch_snapshot', side_effect=[root / 'raw/arcgis-vmt/synthetic-2', ImportFailure('fallo simulado')]), \
                    patch('import_demo_routes.process_snapshot', return_value=root / 'processed/arcgis-vmt' / outputs['TEST_B']):
                with self.assertRaisesRegex(ImportFailure, 'fallo simulado'):
                    capture_missing(load_config(config), sources, root)
            self.assertEqual(read_json(sources.read_bytes())['processed_outputs'],
                             {'TEST_A': outputs['TEST_A'], 'TEST_B': outputs['TEST_B']})

    def test_multipart_keeps_separate_parts_and_rejects_invalid_vertices(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = synthetic_source(Path(tmp), 'TEST_A', 1, multipart=True)
            routes = read_json((source / 'routes.geojson').read_bytes())
            stops = read_json((source / 'stops.geojson').read_bytes())
            first = routes['features'][0]
            self.assertEqual(first['geometry']['type'], 'MultiLineString')
            self.assertEqual(len(first['geometry']['coordinates']), 2)
            validate_geojson(routes, stops)
            first['geometry']['coordinates'][1][0].reverse()
            with self.assertRaises(ImportFailure):
                validate_geojson(routes, stops)


if __name__ == '__main__':
    unittest.main()
