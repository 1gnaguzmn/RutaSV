import type { DemoData } from '../types/journey.ts'
import type { TransitData } from '../types/transit.ts'
import { geometryParts, legEnd, legStart, metres } from '../features/journeys/geometry.ts'
import { validateContinuity } from '../features/journeys/planning.ts'

export function parseDemoData(value: unknown, transit: TransitData): DemoData {
  const fail = (): never => { throw new Error('Los escenarios de demostración no son válidos. Reintenta la carga.') }
  if (!value || typeof value !== 'object') return fail()
  const data = value as DemoData
  if (data.version !== 1 || !Array.isArray(data.places) || !Array.isArray(data.itineraries) || !Array.isArray(data.incidents)) return fail()
  const validPoint = (p: unknown): boolean => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90
  const unique = (items: { id: string }[]) => items.every((item) => item && typeof item.id === 'string' && item.id.length > 0) && new Set(items.map((item) => item.id)).size === items.length
  if (!unique(data.places) || !unique(data.itineraries) || !unique(data.incidents) || !data.places.every((place) => typeof place.name === 'string' && validPoint(place.coordinates))) return fail()
  for (const trip of data.itineraries) {
    const origin = data.places.find((p) => p.id === trip.originId)
    const destination = data.places.find((p) => p.id === trip.destinationId)
    if (!origin || !destination || trip.simulated !== true || !Array.isArray(trip.legs) || trip.legs.length < 3 || !unique(trip.legs)) return fail()
    for (const leg of trip.legs) {
      if (!leg.geometry || !['LineString', 'MultiLineString'].includes(leg.geometry.type) || !Array.isArray(leg.geometry.coordinates) || !['bus', 'walk'].includes(leg.mode) || !Number.isInteger(leg.minutes) || leg.minutes < 1 || !Number.isFinite(leg.distanceM) || leg.distanceM < 0 || typeof leg.label !== 'string' || !Array.isArray(leg.stopIds) || !Array.isArray(leg.stopNames) || leg.stopIds.length !== leg.stopNames.length) return fail()
      if (!geometryParts(leg.geometry).every((part) => Array.isArray(part) && part.length >= 2 && part.every(validPoint))) return fail()
      const parts = geometryParts(leg.geometry)
      if (parts.some((part, i) => i > 0 && metres(parts[i - 1].at(-1)!, part[0]) > 2)) return fail()
      const distance = Math.round(parts.reduce((total, part) => total + part.slice(1).reduce((sum, point, i) => sum + metres(part[i], point), 0), 0))
      if (Math.abs(distance - leg.distanceM) > 2 || !leg.stopNames.every((name) => typeof name === 'string' && name.length > 0) || new Set(leg.stopIds).size !== leg.stopIds.length) return fail()
      if (leg.mode === 'bus') {
        const shape = transit.routes.features.find((r) => r.properties.id === leg.shapeId)
        if (!shape || shape.properties.short_name !== leg.routeName || leg.stopIds.length < 2 || leg.minutes < leg.stopIds.length + 1) return fail()
        for (const id of leg.stopIds) {
          const stop = transit.stops.features.find((s) => s.properties.id === id)
          if (!stop || !(stop.properties.shape_ids ?? [stop.properties.shape_id]).includes(leg.shapeId)) return fail()
        }
      }
    }
    if (!validateContinuity(trip) || metres(legStart(trip.legs[0]), origin.coordinates) > 2 || metres(legEnd(trip.legs.at(-1)!), destination.coordinates) > 2) return fail()
  }
  if (data.incidents.length !== 3 || !['traffic', 'closure', 'route-change'].every((id) => data.incidents.some((incident) => incident.id === id))) return fail()
  for (const incident of data.incidents) {
    if (typeof incident.title !== 'string' || typeof incident.description !== 'string' || !Number.isInteger(incident.delayMinutes) || incident.delayMinutes < 0 || !Array.isArray(incident.affectedRouteNames) || !incident.affectedRouteNames.every((name) => typeof name === 'string') || !Array.isArray(incident.blockedItineraryIds) || incident.blockedItineraryIds.some((id) => !data.itineraries.some((trip) => trip.id === id))) return fail()
  }
  return data
}
