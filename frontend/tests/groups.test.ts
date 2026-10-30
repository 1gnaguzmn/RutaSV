import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initialSelection, selectionReducer } from '../src/features/routes/selection.ts'
import { contextStops, sortGroupStops, STOP_GROUP_PAGE_SIZE, stopRouteLabels } from '../src/features/stops/stopGroups.ts'
import { parseTransitData } from '../src/services/transit.ts'
import type { Stop } from '../src/types/transit.ts'

const read = (name: string): unknown => JSON.parse(readFileSync(new URL(`../public/data/transit/${name}.geojson`, import.meta.url), 'utf8'))
const fixture = () => parseTransitData(read('routes'), read('stops'))

test('grupo → página → parada → volver conserva IDs, página y contexto de ruta', () => {
  const route = selectionReducer(initialSelection, { type: 'route', id: 'route-test' })
  const ids = Array.from({ length: 101 }, (_, index) => `stop-${index}`)
  const group = selectionReducer(route, { type: 'group', ids })
  const second = selectionReducer(group, { type: 'group-page', page: 1 })
  const stop = selectionReducer(second, { type: 'stop', id: 'stop-60' })
  assert.equal(stop.routeId, 'route-test')
  assert.deepEqual(selectionReducer(stop, { type: 'back' }), second)
  assert.deepEqual(selectionReducer(second, { type: 'back' }), route)
  assert.deepEqual(selectionReducer(stop, { type: 'explore' }), initialSelection)
  assert.deepEqual(ids, Array.from({ length: 101 }, (_, index) => `stop-${index}`))
})

test('un grupo abierto al explorar no dibuja rutas y vuelve a explorar', () => {
  const group = selectionReducer(initialSelection, { type: 'group', ids: ['a', 'a', 'b'] })
  assert.equal(group.routeId, null)
  assert(group.view === 'group')
  assert.deepEqual(group.group.stopIds, ['a', 'b'])
  assert.deepEqual(selectionReducer(group, { type: 'back' }), initialSelection)
  assert.deepEqual(selectionReducer(initialSelection, { type: 'group', ids: [] }), initialSelection)
  const unrelated = selectionReducer(group, { type: 'stop', id: 'other' })
  assert.deepEqual(selectionReducer(unrelated, { type: 'back' }), initialSelection)
})

test('la paginación respeta bloques de 50 y limita índices sin afectar selección de ruta', () => {
  assert.equal(STOP_GROUP_PAGE_SIZE, 50)
  const group = selectionReducer(initialSelection, { type: 'group', ids: Array.from({ length: 101 }, (_, i) => String(i)) })
  const last = selectionReducer(group, { type: 'group-page', page: 99 })
  assert(last.view === 'group')
  assert.equal(last.group.page, 2)
  const first = selectionReducer(last, { type: 'group-page', page: -1 })
  assert(first.view === 'group')
  assert.equal(first.group.page, 0)
  assert.equal(selectionReducer(group, { type: 'group-page', page: 1.5 }), group)
  assert.equal(selectionReducer(initialSelection, { type: 'group-page', page: 1 }), initialSelection)
})

test('el contexto sin agrupar contiene únicamente las paradas del trazado o la ficha individual', () => {
  const { routes, stops } = fixture()
  const counts: Record<string, number[]> = { AB008A0SS: [14, 17], MB030A0: [34, 33], AB029G0: [34, 32], AB101A2E: [0, 0], MB044X0: [0, 0], AB002C0: [26, 17] }
  assert.deepEqual(contextStops(routes.features, stops.features, null, null), [])
  for (const route of routes.features) {
    const result = contextStops(routes.features, stops.features, route.properties.id, null)
    assert.equal(result.length, counts[route.properties.source_route_code!][route.properties.recorrido_code === '01' ? 0 : 1])
    assert(result.every((stop) => stop.properties.shape_ids?.includes(route.properties.id)))
  }
  assert.deepEqual(contextStops(routes.features, stops.features, null, stops.features[0].properties.id), [stops.features[0]])
  assert.deepEqual(contextStops(routes.features, stops.features, 'missing', null), [])
})

test('los grupos conservan registros en posiciones coincidentes y muestran sus rutas', () => {
  const { routes, stops } = fixture()
  const byPosition = new Map<string, Stop[]>()
  for (const stop of stops.features) {
    const key = JSON.stringify(stop.geometry.coordinates)
    byPosition.set(key, [...(byPosition.get(key) ?? []), stop])
  }
  const coincident = [...byPosition.values()].find((items) => items.length > 1)!
  const group = sortGroupStops(stops.features, coincident.map((stop) => stop.properties.id))
  assert.equal(group.length, coincident.length)
  assert.equal(new Set(group.map((stop) => stop.properties.id)).size, coincident.length)
  const labels = stopRouteLabels(routes.features, stops.features)
  assert(group.every((stop) => labels.get(stop.properties.id)?.length))
})

test('10.000 registros sintéticos mantienen orden alfabético sin fusionarse ni cambiar los datos', () => {
  const template = fixture().stops.features[0]
  const stops: Stop[] = Array.from({ length: 10_000 }, (_, index) => ({ ...template,
    properties: { ...template.properties, id: `synthetic-${index}`, name: `Parada sintética ${String(index).padStart(5, '0')}` } }))
  const ids = stops.map((stop) => stop.properties.id).reverse()
  const sorted = sortGroupStops(stops, ids)
  assert.equal(sorted.length, 10_000)
  assert.equal(sorted[0].properties.name, 'Parada sintética 00000')
  assert.equal(sorted.at(-1)?.properties.name, 'Parada sintética 09999')
  assert.equal(sorted.slice(50, 100).length, 50)
  assert.equal(ids[0], 'synthetic-9999')
})
