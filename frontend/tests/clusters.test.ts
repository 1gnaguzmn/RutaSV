import test from 'node:test'
import assert from 'node:assert/strict'
import { ClusterInteraction } from '../src/components/map/clusterInteraction.ts'
import type { Feature } from 'geojson'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const leaf = (id: string): Feature => ({ type: 'Feature', properties: { id }, geometry: { type: 'Point', coordinates: [-89.19, 13.70] } })
function request() {
  const calls = { zooms: [] as number[], groups: [] as string[][], errors: 0, leaves: 0 }
  const config = {
    source: { getClusterExpansionZoom: async (_id: number) => 15,
      getClusterLeaves: async (_id: number, _limit: number, _offset: number): Promise<Feature[]> => { calls.leaves++; return [leaf('a'), leaf('b')] } },
    clusterId: 1, pointCount: 2, knownStopIds: new Set(['a', 'b']),
    onExpand: (zoom: number) => { calls.zooms.push(zoom) }, onGroup: (ids: string[]) => { calls.groups.push(ids) },
    onError: () => { calls.errors++ },
  }
  return { config, calls }
}

test('un grupo separable acerca el mapa sin cargar ni abrir su listado', async () => {
  const { config, calls } = request()
  config.source.getClusterExpansionZoom = async () => 13
  await new ClusterInteraction().open(config)
  assert.deepEqual(calls, { zooms: [13], groups: [], errors: 0, leaves: 0 })
})

test('un grupo terminal resuelve sus registros, no guarda el cluster_id como navegación', async () => {
  const { config, calls } = request()
  await new ClusterInteraction().open(config)
  assert.deepEqual(calls, { zooms: [], groups: [['a', 'b']], errors: 0, leaves: 1 })
})

test('cambiar selección o destruir la capa descarta una expansión tardía', async () => {
  const { config, calls } = request()
  const pending = deferred<number>()
  config.source.getClusterExpansionZoom = () => pending.promise
  const controller = new ClusterInteraction()
  const operation = controller.open(config)
  controller.invalidate()
  pending.resolve(13)
  await operation
  assert.deepEqual(calls, { zooms: [], groups: [], errors: 0, leaves: 0 })
})

test('cambiar datos mientras llegan miembros del grupo descarta sus IDs', async () => {
  const { config, calls } = request()
  const pending = deferred<Feature[]>()
  config.source.getClusterLeaves = () => pending.promise
  const controller = new ClusterInteraction()
  const operation = controller.open(config)
  await Promise.resolve()
  controller.invalidate()
  pending.resolve([leaf('a'), leaf('b')])
  await operation
  assert.deepEqual(calls.groups, [])
  assert.equal(calls.errors, 0)
})

test('un nuevo clic invalida el anterior y los errores tardíos no interrumpen la exploración', async () => {
  const first = request(), second = request(), pending = deferred<number>()
  first.config.source.getClusterExpansionZoom = () => pending.promise
  const controller = new ClusterInteraction()
  const operation = controller.open(first.config)
  await controller.open(second.config)
  pending.reject(new Error('Respuesta obsoleta'))
  await operation
  assert.equal(first.calls.errors, 0)
  assert.deepEqual(second.calls.groups, [['a', 'b']])
})

test('un fallo actual permite volver a solicitar el grupo sin bloquear otras acciones', async () => {
  const { config, calls } = request()
  config.source.getClusterExpansionZoom = async () => { throw new Error('Fallo simulado') }
  const controller = new ClusterInteraction()
  await controller.open(config)
  assert.equal(calls.errors, 1)
  config.source.getClusterExpansionZoom = async () => 15
  await controller.open(config)
  assert.deepEqual(calls.groups, [['a', 'b']])
})

test('registros incompletos, repetidos o desconocidos no se presentan como un grupo válido', async () => {
  for (const leaves of [[leaf('a')], [leaf('a'), leaf('a')], [leaf('a'), leaf('missing')]]) {
    const { config, calls } = request()
    config.source.getClusterLeaves = async () => leaves
    await new ClusterInteraction().open(config)
    assert.equal(calls.errors, 1)
    assert.deepEqual(calls.groups, [])
  }
})
