import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseTransitData, filterRoutes } from '../src/services/transit.ts'
import { getRouteStops, getGroupStops, getInitialRoute, groupRoutes } from '../src/features/routes/routeData.ts'
import { initialSelection, selectionReducer } from '../src/features/routes/selection.ts'

const read = (name: string): unknown => JSON.parse(readFileSync(new URL(`../public/data/pilot/${name}.geojson`, import.meta.url), 'utf8'))
const fixture = () => parseTransitData(read('routes'), read('stops'))

test('el piloto tiene una ruta, dos trazados y 31 registros, conservando la procedencia', () => {
  const data = fixture()
  const groups = groupRoutes(data.routes.features)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].variants.length, 2)
  assert.equal(getGroupStops(groups[0], data.stops.features).length, 31)
  for (const feature of [...data.routes.features, ...data.stops.features]) {
    assert.equal(feature.properties.verification_status, 'unverified')
    assert.equal(feature.properties.verified_at, null)
    assert.equal(feature.properties.source_snapshot, '20261029T224448147697Z')
    assert.equal(feature.properties.source_updated_at?.slice(0, 10), '2022-09-20')
  }
})

test('la asociación de demo muestra 14/17 paradas aunque las secuencias sigan vacías', () => {
  const { routes, stops } = fixture()
  for (const route of routes.features) {
    const isFirst = route.properties.recorrido_code === '01'
    const related = getRouteStops(route, stops.features)
    assert.deepEqual(route.properties.stop_ids, [])
    assert.equal(related.length, isFirst ? 14 : 17)
    assert(related.every((stop) => stop.properties.source_direction_code === (isFirst ? 'I' : 'R')))
    assert(related.every((stop) => stop.properties.shape_id === route.properties.id))
    assert.deepEqual(related.map((stop) => stop.properties.name), related.map((stop) => stop.properties.name).sort((a, b) => a.localeCompare(b, 'es')))
  }
  const second = routes.features.find((route) => route.properties.recorrido_code === '02')!
  assert(getRouteStops(second, stops.features).some((stop) => stop.properties.id.endsWith(':2942')), 'Conservar también las paradas alejadas')
})

test('8-A, 8A, 8 A y código original encuentran una sola ruta', () => {
  const routes = fixture().routes.features
  for (const query of ['8-A', '8A', ' 8 A ', 'AB008A0SS', 'ab008a0ss']) {
    const groups = groupRoutes(filterRoutes(routes, query))
    assert.equal(groups.length, 1)
    assert.equal(groups[0].variants.length, 2)
  }
  assert.equal(groupRoutes(filterRoutes(routes, 'inexistente')).length, 0)
})

test('el recorrido inicial es 01 aunque cambie el orden de los archivos', () => {
  const routes = fixture().routes.features.reverse()
  assert.equal(getInitialRoute(routes)?.properties.recorrido_code, '01')
  assert.equal(groupRoutes(routes)[0].variants[0].properties.recorrido_code, '01')
  assert.equal(getInitialRoute([]), undefined)
})

test('rechaza asociaciones a un trazado inexistente o sin referencia', () => {
  const data = fixture()
  data.stops.features[0].properties.shape_id = 'missing'
  assert.throws(() => parseTransitData(data.routes, data.stops), /recorrido inexistente/)
  delete data.stops.features[0].properties.shape_id
  assert.throws(() => parseTransitData(data.routes, data.stops), /necesita un recorrido/)
})

test('rechaza metadatos nuevos mal formados', () => {
  const badDate = fixture()
  badDate.routes.features[0].properties.source_updated_at = 'invalid'
  assert.throws(() => parseTransitData(badDate.routes, badDate.stops))
  const badCode = fixture()
  const properties = badCode.stops.features[0].properties as unknown as Record<string, unknown>
  properties.source_direction_code = 'X'
  assert.throws(() => parseTransitData(badCode.routes, badCode.stops))
})

test('seleccionar una parada del recorrido 02 conserva ese recorrido al volver', () => {
  const data = fixture()
  const second = data.routes.features.find((route) => route.properties.recorrido_code === '02')!
  const stop = getRouteStops(second, data.stops.features)[0]
  const routeSelection = selectionReducer(initialSelection, { type: 'route', id: second.properties.id })
  const stopSelection = selectionReducer(routeSelection, { type: 'stop', id: stop.properties.id })
  assert.deepEqual(selectionReducer(stopSelection, { type: 'back' }), routeSelection)
  const related = data.routes.features.filter((route) => getRouteStops(route, [stop]).length > 0)
  assert.deepEqual(related.map((route) => route.properties.id), [second.properties.id])
})
