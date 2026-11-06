import type { DemoData, DepartureRecommendation, Itinerary, JourneyEstimate, JourneyStep, PlanRequest, ScenarioId } from '../../types/journey.ts'
import { geometryParts, legEnd, legStart, metres } from './geometry.ts'
import { weekday } from './time.ts'

export function validPlanRequest(request: PlanRequest, data: DemoData): boolean {
  return Number.isInteger(request.arriveBy) && request.arriveBy >= 0 && request.arriveBy < 1440 && Number.isInteger(request.margin) && request.margin >= 0 && request.margin <= 60 && [request.originId, request.destinationId].every((id) => data.places.some((place) => place.id === id))
}

export function scenarioItinerary(original: Itinerary, scenario: ScenarioId): Itinerary {
  if (scenario !== 'route-change') return original
  const itinerary = structuredClone(original)
  const index = itinerary.legs.findIndex((leg) => leg.mode === 'bus')
  const ride = itinerary.legs[index]
  const walk = itinerary.legs[index - 1]
  const originalStart = legStart(ride)
  const shifted = [originalStart[0] + .00139, originalStart[1]]
  const part = geometryParts(ride.geometry)[0]
  // This explicitly fictitious connector belongs only to the scenario copy.
  part.unshift(shifted)
  ride.distanceM += Math.round(metres(shifted, originalStart))
  const path = geometryParts(walk.geometry)[0]
  path[path.length - 1] = shifted
  walk.distanceM = Math.round(metres(legStart(walk), shifted))
  walk.minutes = Math.max(1, Math.ceil(walk.distanceM / 75))
  walk.label = 'Camina al nuevo abordaje de ejemplo · cambio simulado'
  ride.label += ' · nuevo abordaje de ejemplo'
  ride.stopNames[0] = 'Nuevo abordaje simulado (150 m del punto anterior)'
  return itinerary
}

export function estimateJourney(original: Itinerary, data: DemoData, scenario: ScenarioId, departure: number, day: number): JourneyEstimate {
  const itinerary = scenarioItinerary(original, scenario)
  const incident = data.incidents.find((item) => item.id === scenario)
  const buses = itinerary.legs.filter((leg) => leg.mode === 'bus')
  const affected = buses.some((leg) => incident?.affectedRouteNames.includes(leg.routeName!))
  const firstAffected = itinerary.legs.findIndex((leg) => leg.mode === 'bus' && incident?.affectedRouteNames.includes(leg.routeName!))
  const minute = ((departure % 1440) + 1440) % 1440
  const peak = weekday(day + Math.floor(departure / 1440)) < 5 && ((minute >= 360 && minute < 510) || (minute >= 960 && minute < 1110))
  const delay = affected ? incident!.delayMinutes : 0
  const legMinutes = itinerary.legs.map((leg, index) => leg.mode === 'walk' ? leg.minutes : Math.ceil(leg.minutes * (peak ? 1.2 : 1)) + (index === firstAffected ? delay : 0))
  return { itinerary, duration: legMinutes.reduce((a, b) => a + b, 0), walkMinutes: itinerary.legs.reduce((total, leg, i) => total + (leg.mode === 'walk' ? legMinutes[i] : 0), 0), walkingM: itinerary.legs.reduce((total, leg) => total + (leg.mode === 'walk' ? leg.distanceM : 0), 0), transfers: Math.max(0, buses.length - 1), legMinutes, delay, blocked: incident?.blockedItineraryIds.includes(original.id) ?? false }
}

export function recommendDeparture(itinerary: Itinerary, data: DemoData, scenario: ScenarioId, request: PlanRequest, day: number, now: number): DepartureRecommendation {
  let chosen: { departure: number; estimate: JourneyEstimate } | null = null
  const comparisons: DepartureRecommendation['comparisons'] = []
  for (let departure = Math.ceil((request.arriveBy - 180) / 5) * 5; departure <= request.arriveBy; departure += 5) {
    const estimate = estimateJourney(itinerary, data, scenario, departure, day)
    if (estimate.blocked) continue
    if (departure + estimate.duration + request.margin <= request.arriveBy) chosen = { departure, estimate }
    comparisons.push({ departure, arrival: departure + estimate.duration, duration: estimate.duration })
  }
  const nextDeparture = Math.ceil(now / 5) * 5
  const next = estimateJourney(itinerary, data, scenario, nextDeparture, day)
  const missed = chosen !== null && chosen.departure < now
  const centre = chosen?.departure ?? nextDeparture
  return { departure: chosen?.departure ?? null, arrival: chosen ? chosen.departure + chosen.estimate.duration : null,
    estimate: chosen?.estimate ?? next, missed, nextDeparture: next.blocked ? null : nextDeparture, nextArrival: next.blocked ? null : nextDeparture + next.duration,
    comparisons: comparisons.filter((item) => [centre - 10, centre, centre + 10].includes(item.departure)) }
}

export function planAlternatives(data: DemoData, scenario: ScenarioId, request: PlanRequest, day: number, now: number) {
  return data.itineraries.filter((item) => item.originId === request.originId && item.destinationId === request.destinationId).map((itinerary) => recommendDeparture(itinerary, data, scenario, request, day, now))
}

export function preferredAlternative(alternatives: DepartureRecommendation[]) {
  return alternatives.filter((item) => !item.estimate.blocked).sort((a, b) => Number(a.departure === null) - Number(b.departure === null) || b.departure! - a.departure! || a.estimate.duration - b.estimate.duration)[0]
}

export function journeySteps(estimate: JourneyEstimate): JourneyStep[] {
  return estimate.itinerary.legs.flatMap((leg, legIndex) => {
    const duration = estimate.legMinutes[legIndex]
    if (leg.mode === 'walk') return [{ id: leg.id, legIndex, instruction: `${leg.label} · ${leg.distanceM} m`, minutes: duration, nextStop: false }]
    const count = Math.max(2, leg.stopNames.length)
    const boarding = Math.min(2, duration - count)
    const remaining = duration - boarding
    const stops = Array.from({ length: count }, (_, index) => ({ id: `${leg.id}-stop-${index}`, legIndex,
      instruction: index === count - 1 ? `Baja: ${leg.stopNames.at(-1) ?? 'parada del ejemplo'}` : index === count - 2 ? 'Baja en la próxima · secuencia de ejemplo' : `Avanza: ${leg.stopNames[index] ?? 'parada del ejemplo'}`,
      minutes: Math.floor(remaining / count) + (index < remaining % count ? 1 : 0), nextStop: index === count - 2 }))
    return [{ id: `${leg.id}-board`, legIndex, instruction: `Aborda ${leg.label} · espera simulada incluida`, minutes: boarding, nextStop: false }, ...stops]
  })
}

export function validateContinuity(itinerary: Itinerary): boolean {
  return itinerary.legs.every((leg, index) => index === 0 || metres(legEnd(itinerary.legs[index - 1]), legStart(leg)) < 2)
}
