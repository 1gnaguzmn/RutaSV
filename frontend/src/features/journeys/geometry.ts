import type { FeatureCollection, LineString, MultiLineString, Point, Position } from 'geojson'
import type { Itinerary, JourneyLeg } from '../../types/journey.ts'

export const geometryParts = (geometry: LineString | MultiLineString): Position[][] => geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates
export const legStart = (leg: JourneyLeg) => geometryParts(leg.geometry)[0][0]
export const legEnd = (leg: JourneyLeg) => geometryParts(leg.geometry).at(-1)!.at(-1)!
export function metres(a: Position, b: Position): number {
  const radians = Math.PI / 180
  return Math.hypot((a[0] - b[0]) * radians * Math.cos((a[1] + b[1]) / 2 * radians), (a[1] - b[1]) * radians) * 6371000
}
export function journeyGeoJSON(itinerary: Itinerary) {
  const segments: FeatureCollection<LineString | MultiLineString> = { type: 'FeatureCollection', features: itinerary.legs.map((leg, index) => ({ type: 'Feature', geometry: leg.geometry, properties: { mode: leg.mode, index, label: leg.label } })) }
  const milestones: FeatureCollection<Point> = { type: 'FeatureCollection', features: itinerary.legs.flatMap((leg, index) => leg.mode === 'bus' ? [{ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: legStart(leg) }, properties: { kind: index === 1 ? 'boarding' : 'transfer', label: index === 1 ? '↑ Abordaje' : '⇄ Transbordo' } }] : []) }
  milestones.features.unshift({ type: 'Feature', geometry: { type: 'Point', coordinates: legStart(itinerary.legs[0]) }, properties: { kind: 'origin', label: 'A · Inicio' } })
  milestones.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: legEnd(itinerary.legs.at(-1)!) }, properties: { kind: 'destination', label: 'B · Destino' } })
  return { segments, milestones }
}
