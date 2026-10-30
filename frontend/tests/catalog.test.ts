import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { filterRoutes, parseTransitData } from '../src/services/transit.ts'
import { getGroupStops, getInitialRoute, getRouteStops, groupRoutes, routePositions } from '../src/features/routes/routeData.ts'

const read = (name: string, extension = 'geojson'): unknown => JSON.parse(readFileSync(new URL(`../public/data/transit/${name}.${extension}`, import.meta.url), 'utf8'))
const fixture = () => parseTransitData(read('routes'), read('stops'))

test('el catálogo contiene seis rutas, catorce trazados y 207 registros de paradas', () => {
  const data = fixture()
  const catalog = read('catalog', 'json') as { counts: { routes: number; shapes: number; stops: number } }
  assert.deepEqual(catalog.counts, { routes: 6, shapes: 14, stops: 207 })
  const groups = groupRoutes(data.routes.features)
  assert.equal(groups.length, 6)
  assert.equal(data.routes.features.length, 14)
  assert.equal(data.stops.features.length, 207)
  assert.equal(groups.reduce((sum, group) => sum + getGroupStops(group, data.stops.features).length, 0), 207)
  assert(data.routes.features.every((route) => route.properties.stop_ids.length === 0))
  for (const feature of [...data.routes.features, ...data.stops.features]) {
    assert.equal(feature.properties.verification_status, 'unverified')
    assert.equal(feature.properties.verified_at, null)
    assert(feature.properties.source_snapshot)
    assert.equal(feature.properties.source_updated_at?.slice(0, 10), '2022-09-20')
  }
})

test('las cinco rutas nuevas se encuentran por nombre normalizado y código exacto', () => {
  const routes = fixture().routes.features
  for (const [queries, code] of [
    [['30A', '30 A', 'MB030A0'], 'MB030A0'],
    [['29G', 'AB029G0'], 'AB029G0'],
    [['101A', 'AB101A2E'], 'AB101A2E'],
    [['44', 'MB044X0'], 'MB044X0'],
    [['2-C', '2C', '2 C', 'AB002C0'], 'AB002C0'],
  ] as const) {
    for (const query of queries) {
      const groups = groupRoutes(filterRoutes(routes, query))
      assert.equal(groups.length, 1, query)
      assert(groups[0].variants.every((route) => route.properties.source_route_code === code))
    }
  }
})

test('cada sentido muestra sus paradas sin mezclar rutas ni numerar viajes', () => {
  const { routes, stops } = fixture()
  const expected: Record<string, number[]> = { AB008A0SS: [14, 17], MB030A0: [34, 33], AB029G0: [34, 32], AB101A2E: [0, 0], MB044X0: [0, 0], AB002C0: [26, 17] }
  for (const route of routes.features) {
    const related = getRouteStops(route, stops.features)
    const p = route.properties
    assert.equal(related.length, expected[p.source_route_code!][p.recorrido_code === '01' ? 0 : 1])
    assert(related.every((stop) => stop.properties.source_route_code === p.source_route_code))
    assert.deepEqual(related.map((stop) => stop.properties.name), related.map((stop) => stop.properties.name).sort((a, b) => a.localeCompare(b, 'es')))
  }
})

test('2-C conserva cuatro trazados distinguibles sin duplicar sus 43 registros', () => {
  const { routes, stops } = fixture()
  const group = groupRoutes(routes.features).find((item) => item.variants[0].properties.source_route_code === 'AB002C0')!
  assert.equal(group.variants.length, 4)
  assert.equal(new Set(group.variants.map((route) => route.properties.direction)).size, 4)
  const related = getGroupStops(group, stops.features)
  assert.equal(related.length, 43)
  assert(related.every((stop) => stop.properties.shape_ids?.length === 2 && !stop.properties.shape_id))
})

test('multipartes se conservan y todos sus vértices participan en el encuadre', () => {
  const multipart = fixture().routes.features.filter((route) => route.geometry.type === 'MultiLineString')
  assert.equal(multipart.length, 4)
  for (const route of multipart) {
    assert.equal(route.geometry.type, 'MultiLineString')
    if (route.geometry.type !== 'MultiLineString') continue
    assert(route.geometry.coordinates.length > 1)
    assert.equal(routePositions(route).length, route.geometry.coordinates.reduce((sum, part) => sum + part.length, 0))
  }
  const data = fixture()
  const route = data.routes.features.find((item) => item.geometry.type === 'MultiLineString')!
  route.geometry.coordinates = [[]]
  assert.throws(() => parseTransitData(data.routes, data.stops), /recorrido inválido/)
})

test('rechaza asociaciones a otra ruta, otro sentido o IDs inexistentes y repetidos', () => {
  for (const problem of ['route', 'direction', 'missing', 'duplicate', 'contradictory']) {
    const data = fixture()
    const stop = data.stops.features[0].properties
    const other = data.routes.features.find((route) => problem === 'direction'
      ? route.properties.source_route_code === stop.source_route_code && route.properties.recorrido_code === (stop.source_direction_code === 'I' ? '02' : '01')
      : route.properties.source_route_code !== stop.source_route_code)!
    if (problem === 'route' || problem === 'direction') {
      delete stop.shape_id
      stop.shape_ids = [other.properties.id]
    } else if (problem === 'missing') stop.shape_ids = ['missing']
    else if (problem === 'duplicate') stop.shape_ids!.push(stop.shape_ids![0])
    else stop.shape_id = other.properties.id
    assert.throws(() => parseTransitData(data.routes, data.stops), undefined, problem)
  }
})

test('conserva 8-A recorrido 01 como selección inicial sin depender del orden de descarga', () => {
  const initial = getInitialRoute(fixture().routes.features.reverse())!
  assert.equal(initial.properties.source_route_code, 'AB008A0SS')
  assert.equal(initial.properties.recorrido_code, '01')
})
