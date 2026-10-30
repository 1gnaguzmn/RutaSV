import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseTransitData, filterRoutes } from '../src/services/transit.ts'
import { initialSelection, selectionReducer } from '../src/features/routes/selection.ts'

const read = (name: string): unknown => JSON.parse(readFileSync(new URL(`../public/data/${name}.geojson`, import.meta.url), 'utf8'))
const fixtures = () => parseTransitData(read('routes'), read('stops'))

test('las dos rutas de demo comparten una parada y conservan su orden', () => {
  const data = fixtures()
  assert.equal(data.routes.features.length, 2)
  assert.equal(data.stops.features.length, 5)
  for (const route of data.routes.features) {
    assert.equal(route.properties.verification_status, 'demonstration')
    assert.equal(route.properties.verified_at, null)
    assert.equal(route.properties.stop_ids[1], 'demo-shared')
  }
})

test('la búsqueda ignora mayúsculas, acentos y espacios exteriores', () => {
  const routes = fixtures().routes.features
  assert.equal(filterRoutes(routes, ' DEMO A ')[0]?.properties.id, 'demo-a-ida')
  assert.equal(filterRoutes(routes, 'CONEXION')[0]?.properties.id, 'demo-b-ida')
  assert.equal(filterRoutes(routes, 'inexistente').length, 0)
  assert.equal(filterRoutes(routes, '').length, 2)
})

test('rechaza referencias a paradas ausentes, coordenadas inválidas e IDs repetidos', () => {
  const absent = fixtures()
  absent.routes.features[0].properties.stop_ids.push('missing')
  assert.throws(() => parseTransitData(absent.routes, absent.stops))
  const invalid = fixtures()
  invalid.stops.features[0].geometry.coordinates = [200, 13]
  assert.throws(() => parseTransitData(invalid.routes, invalid.stops))
  const duplicate = fixtures()
  duplicate.stops.features.push(duplicate.stops.features[0])
  assert.throws(() => parseTransitData(duplicate.routes, duplicate.stops))
  assert.throws(() => parseTransitData({ features: [] }, read('stops')))
})

test('acepta colecciones vacías para mostrar el estado sin datos', () => {
  const empty = { type: 'FeatureCollection', features: [] }
  assert.equal(parseTransitData(empty, empty).routes.features.length, 0)
})

test('parada → volver conserva la ruta; volver a explorar retira la selección', () => {
  const route = selectionReducer(initialSelection, { type: 'route', id: 'demo-a-ida' })
  const stop = selectionReducer(route, { type: 'stop', id: 'demo-shared' })
  assert.equal(stop.routeId, 'demo-a-ida')
  assert.deepEqual(selectionReducer(stop, { type: 'back' }), route)
  assert.deepEqual(selectionReducer(route, { type: 'back' }), initialSelection)
  assert.deepEqual(selectionReducer(stop, { type: 'explore' }), initialSelection)
})

test('una parada abierta desde explorar vuelve a explorar; cambiar ruta limpia la parada', () => {
  const stop = selectionReducer(initialSelection, { type: 'stop', id: 'demo-shared' })
  assert.deepEqual(selectionReducer(stop, { type: 'back' }), initialSelection)
  assert.deepEqual(selectionReducer(stop, { type: 'route', id: 'demo-b-ida' }), { view: 'route', routeId: 'demo-b-ida', stopId: null })
})
