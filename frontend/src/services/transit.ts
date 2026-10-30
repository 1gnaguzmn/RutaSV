import type { Route, TransitData } from '../types/transit.ts'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function position(value: unknown): boolean {
  return Array.isArray(value) && value.length >= 2 &&
    typeof value[0] === 'number' && Number.isFinite(value[0]) && Math.abs(value[0]) <= 180 &&
    typeof value[1] === 'number' && Number.isFinite(value[1]) && Math.abs(value[1]) <= 90
}

function provenance(value: Record<string, unknown>): boolean {
  return text(value.source) &&
    ['demonstration', 'verified', 'unverified'].includes(String(value.verification_status)) &&
    (value.verified_at === null || (text(value.verified_at) && Number.isFinite(Date.parse(value.verified_at)))) &&
    optionalText(value, 'source_label') && optionalText(value, 'source_snapshot') &&
    (value.source_updated_at === undefined || (text(value.source_updated_at) && Number.isFinite(Date.parse(value.source_updated_at))))
}

function optionalText(value: Record<string, unknown>, key: string): boolean {
  return value[key] === undefined || text(value[key])
}

function features(value: unknown): unknown[] {
  if (!record(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    throw new Error('El archivo no contiene una colección GeoJSON válida.')
  }
  return value.features
}

export function parseTransitData(routes: unknown, stops: unknown): TransitData {
  const routeFeatures = features(routes)
  const stopFeatures = features(stops)
  const stopIds = new Set<string>()
  const shapeIds = new Set<string>()
  for (const feature of stopFeatures) {
    if (!record(feature) || feature.type !== 'Feature' || !record(feature.geometry) ||
      feature.geometry.type !== 'Point' || !position(feature.geometry.coordinates) ||
      !record(feature.properties) || !text(feature.properties.id) ||
      !text(feature.properties.name) || !provenance(feature.properties) ||
      !optionalText(feature.properties, 'shape_id') || !optionalText(feature.properties, 'source_route_code') ||
      (feature.properties.source_direction_code !== undefined && !['I', 'R'].includes(String(feature.properties.source_direction_code))) ||
      (feature.properties.association_basis !== undefined && feature.properties.association_basis !== 'demo_direction_mapping') ||
      stopIds.has(feature.properties.id)) {
      throw new Error('Hay una parada con datos inválidos o un identificador repetido.')
    }
    stopIds.add(feature.properties.id)
  }
  for (const feature of routeFeatures) {
    if (!record(feature) || feature.type !== 'Feature' || !record(feature.geometry) ||
      feature.geometry.type !== 'LineString' || !Array.isArray(feature.geometry.coordinates) ||
      feature.geometry.coordinates.length < 2 || !feature.geometry.coordinates.every(position) ||
      !record(feature.properties) || !text(feature.properties.id) ||
      !text(feature.properties.route_id) || !text(feature.properties.short_name) ||
      !text(feature.properties.long_name) || !text(feature.properties.direction) ||
      !['a', 'b'].includes(String(feature.properties.color_key)) || !provenance(feature.properties) ||
      !optionalText(feature.properties, 'source_route_code') || !optionalText(feature.properties, 'recorrido_code') ||
      (feature.properties.stop_sequence_status !== undefined && !['pending', 'reviewed_subset'].includes(String(feature.properties.stop_sequence_status))) ||
      !Array.isArray(feature.properties.stop_ids) ||
      !feature.properties.stop_ids.every((id: unknown) => text(id) && stopIds.has(id)) ||
      shapeIds.has(feature.properties.id)) {
      throw new Error('Hay un recorrido inválido o una referencia a una parada inexistente.')
    }
    shapeIds.add(feature.properties.id)
  }
  for (const feature of stopFeatures) {
    const p = (feature as { properties: Record<string, unknown> }).properties
    if (p.shape_id !== undefined && !shapeIds.has(String(p.shape_id))) {
      throw new Error('Una parada está asociada a un recorrido inexistente.')
    }
    if (p.association_basis === 'demo_direction_mapping' && !p.shape_id) {
      throw new Error('La asociación de una parada necesita un recorrido.')
    }
  }
  // La estructura y las referencias se comprueban antes de cruzar el límite de datos.
  return { routes, stops } as TransitData
}

export function filterRoutes(routes: Route[], query: string): Route[] {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s-]/g, '').toLowerCase()
  const search = normalize(query.trim())
  return routes.filter(({ properties }) =>
    normalize(`${properties.short_name} ${properties.long_name} ${properties.source_route_code ?? ''}`).includes(search))
}

export async function loadTransitData(signal?: AbortSignal): Promise<TransitData> {
  const read = async (name: string): Promise<unknown> => {
    const response = await fetch(`${import.meta.env.BASE_URL}data/pilot/${name}.geojson`, { signal })
    if (!response.ok) throw new Error('No se pudieron cargar los datos de la ruta piloto.')
    return response.json()
  }
  const [routes, stops] = await Promise.all([read('routes'), read('stops')])
  return parseTransitData(routes, stops)
}
