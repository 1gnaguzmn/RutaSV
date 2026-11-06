import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseTransitData } from '../src/services/transit.ts'
import { parseDemoData } from '../src/services/journeyDemo.ts'
import { estimateJourney, journeySteps, planAlternatives, preferredAlternative, recommendDeparture, scenarioItinerary, validateContinuity, validPlanRequest } from '../src/features/journeys/planning.ts'
import { geometryParts, journeyGeoJSON, legEnd, legStart } from '../src/features/journeys/geometry.ts'
import { advanceClock, INITIAL_CLOCK, timeText, weekday } from '../src/features/journeys/time.ts'
import { initialStorage, parseStorage, readStorage, writeStorage } from '../src/features/habits/storage.ts'
import { appendHistory, habitSuggestion } from '../src/features/habits/habits.ts'
import { evaluateAlerts } from '../src/features/alerts/alerts.ts'
import type { DemoData, HabitualTrip, ScenarioId } from '../src/types/journey.ts'

const read = (path: string) => JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url), 'utf8')) as unknown
const transit = parseTransitData(read('transit/routes.geojson'), read('transit/stops.geojson'))
const data = parseDemoData(read('demo/scenarios.json'), transit)
const request = { originId: 'south', destinationId: 'university', arriveBy: 420, margin: 10 }
const routine: HabitualTrip = { ...request, id: 'routine-1', name: 'Universidad', days: [0, 1, 2, 3, 4], leadMinutes: 15, paused: false }

test('los campos incompletos o fuera de rango no llegan al cálculo', () => {
  assert(validPlanRequest(request, data))
  assert(!validPlanRequest({ ...request, arriveBy: NaN }, data))
  assert(!validPlanRequest({ ...request, margin: 1.5 }, data))
  assert(!validPlanRequest({ ...request, margin: 61 }, data))
  assert(!validPlanRequest({ ...request, originId: 'missing' }, data))
})

test('tres viajes preparados con 2–3 alternativas, referencias concretas y continuidad', () => {
  assert.equal(data.itineraries.length, 8)
  for (const pair of [['south', 'university'], ['center', 'university'], ['east', 'center']]) {
    const trips = data.itineraries.filter((trip) => trip.originId === pair[0] && trip.destinationId === pair[1])
    assert(trips.length >= 2 && trips.length <= 3)
    assert(trips.every(validateContinuity))
  }
  assert(data.itineraries.some((trip) => trip.legs.filter((leg) => leg.mode === 'bus').length === 2))
  const shapeIds = data.itineraries.flatMap((trip) => trip.legs.filter((leg) => leg.routeName === '2-C').map((leg) => leg.shapeId))
  assert.equal(new Set(shapeIds).size, 2)
  assert.equal(planAlternatives(data, 'normal', { ...request, destinationId: 'east' }, 0, 345).length, 0)
})

test('la validación rechaza referencias rotas, tiempos incoherentes y conexiones separadas', () => {
  const edit = (fn: (value: DemoData) => void) => { const value = structuredClone(data); fn(value); assert.throws(() => parseDemoData(value, transit)) }
  edit((d) => { d.itineraries[0].legs[1].shapeId = 'missing' })
  edit((d) => { d.itineraries[0].legs[1].stopIds[0] = 'missing' })
  edit((d) => { d.itineraries[0].legs[0].minutes = -2 })
  edit((d) => { d.itineraries[0].legs[1].minutes = 1 })
  edit((d) => { d.itineraries[0].legs[0].distanceM = 50000 })
  edit((d) => { d.itineraries[0].legs[0].geometry.coordinates[0] = [13.7, -89.1] as never })
  edit((d) => { d.itineraries[0].legs[0].geometry = { type: 'LineString', coordinates: [[-89, 13], [-89, 13]] } })
  assert.throws(() => parseDemoData(null, transit))
})

test('el visualizador conserva MultiLineString y no crea segmentos entre partes', () => {
  const trip = data.itineraries.find((item) => item.id === 'center-multipart')!
  const bus = trip.legs[1]
  const rendered = journeyGeoJSON(trip)
  assert.equal(bus.geometry.type, 'MultiLineString')
  assert.equal(geometryParts(bus.geometry).length, 3)
  assert.deepEqual(rendered.segments.features[1].geometry, bus.geometry)
  assert.equal(rendered.milestones.features.length, 3)
  assert.deepEqual(journeyGeoJSON(data.itineraries[0]).milestones.features.map((f) => f.properties!.kind), ['origin', 'boarding', 'transfer', 'destination'])
  for (const itinerary of data.itineraries) {
    const { milestones } = journeyGeoJSON(itinerary)
    assert.deepEqual(milestones.features[0].geometry.coordinates, legStart(itinerary.legs[0]))
    assert.deepEqual(milestones.features.at(-1)!.geometry.coordinates, legEnd(itinerary.legs.at(-1)!))
    assert.equal(milestones.features[0].properties!.label, 'A · Inicio')
    assert.equal(milestones.features.at(-1)!.properties!.label, 'B · Destino')
    assert.notDeepEqual(milestones.features[0].geometry.coordinates, milestones.features[1].geometry.coordinates, 'el inicio de la caminata no es el abordaje')
  }
})

test('cada escenario y horario conserva la suma exacta de pasos, espera y duración', () => {
  const original = JSON.stringify(data)
  for (const scenario of ['normal', 'traffic', 'closure', 'route-change'] as ScenarioId[]) {
    for (const trip of data.itineraries) for (const minute of [345, 400, 900]) {
      const estimate = estimateJourney(trip, data, scenario, minute, 0)
      const steps = journeySteps(estimate)
      assert(steps.every((step) => Number.isInteger(step.minutes) && step.minutes > 0))
      assert.equal(steps.reduce((sum, step) => sum + step.minutes, 0), estimate.duration)
      assert.equal(estimate.legMinutes.reduce((a, b) => a + b), estimate.duration)
      assert(steps.some((step) => step.nextStop))
      assert(validateContinuity(estimate.itinerary))
    }
  }
  assert.equal(JSON.stringify(data), original)
  assert.equal(estimateJourney(data.itineraries[0], data, 'traffic', 345, 0).delay, 15)
  assert(estimateJourney(data.itineraries[0], data, 'normal', 400, 0).duration > estimateJourney(data.itineraries[0], data, 'normal', 400, 5).duration)
})

test('el cambio de recorrido mueve solo la copia simulada y actualiza las instrucciones', () => {
  const original = data.itineraries[0]
  const changed = scenarioItinerary(original, 'route-change')
  assert.notDeepEqual(legStart(changed.legs[1]), legStart(original.legs[1]))
  assert.match(changed.legs[0].label, /nuevo abordaje/)
  assert.match(changed.legs[1].stopNames[0], /150 m/)
  assert.deepEqual(scenarioItinerary(original, 'normal'), original)
})

test('la recomendación elige la última salida viable en intervalos de 5 min', () => {
  for (const trip of data.itineraries) {
    const result = recommendDeparture(trip, data, 'normal', request, 0, 300)
    assert.notEqual(result.departure, null)
    assert.equal(result.departure! % 5, 0)
    assert(result.arrival! + request.margin <= request.arriveBy)
    for (let next = result.departure! + 5; next <= request.arriveBy; next += 5) assert(next + estimateJourney(trip, data, 'normal', next, 0).duration + request.margin > request.arriveBy)
    const missed = recommendDeparture(trip, data, 'normal', request, 0, 430)
    assert(missed.missed)
    assert.equal(missed.nextDeparture, 430)
    assert.equal(missed.nextArrival, 430 + estimateJourney(trip, data, 'normal', 430, 0).duration)
  }
  const impossible = recommendDeparture(data.itineraries[0], data, 'normal', { ...request, margin: 180 }, 0, 345)
  assert.equal(impossible.departure, null)
})

test('un cierre nunca se recomienda y conserva alternativas disponibles', () => {
  for (const [originId, destinationId] of [['south', 'university'], ['center', 'university'], ['east', 'center']]) {
    const alternatives = planAlternatives(data, 'closure', { ...request, originId, destinationId }, 0, 345)
    assert(alternatives.some((item) => item.estimate.blocked))
    assert(!preferredAlternative(alternatives)!.estimate.blocked)
    for (const item of alternatives.filter((a) => a.estimate.blocked)) { assert.equal(item.departure, null); assert.equal(item.nextDeparture, null) }
  }
})

test('historial inicial, tercer viaje, aceptación y ventana de habitualidad', () => {
  const seed = initialStorage()
  assert.equal(habitSuggestion(seed, 0), null)
  const third = appendHistory(seed, { id: 'third', originId: 'south', destinationId: 'university', day: 0, departedAt: 350, simulated: true })
  assert.deepEqual(habitSuggestion(third, 0), request)
  assert.equal(habitSuggestion({ ...third, routines: [routine] }, 0), null)
  assert.equal(habitSuggestion({ ...third, dismissedSuggestions: ['south:university'] }, 0), null)
  assert.equal(habitSuggestion(third, 15), null)
  assert.equal(habitSuggestion(appendHistory(seed, { ...third.history.at(-1)!, departedAt: 600 }), 0), null)
  assert.equal(seed.history.length, 2)
})

test('persistencia versionada, datos inválidos y respaldo sin almacenamiento', () => {
  const value = { ...initialStorage(), routines: [routine], favorites: ['university'] }
  assert.deepEqual(parseStorage(JSON.stringify(value), data), value)
  assert.deepEqual(parseStorage('{broken', data), initialStorage())
  assert.deepEqual(parseStorage('{"version":99}', data), initialStorage())
  assert.equal(parseStorage(JSON.stringify({ ...value, routines: [{ ...routine, originId: 'missing' }] }), data).routines.length, 0)
  const unavailable = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('quota') } }
  assert.equal(readStorage(unavailable, data).available, false)
  assert.equal(writeStorage(unavailable, value), false)
  assert.equal(writeStorage(null, value), false)
})

test('avisos: normal silencioso, ventana temporal, pausa, días y deduplicación', () => {
  const state = { ...initialStorage(), routines: [routine] }
  assert.deepEqual(evaluateAlerts(data, state, INITIAL_CLOCK, 'normal'), [])
  assert.deepEqual(evaluateAlerts(data, state, { day: 0, minute: 100 }, 'traffic'), [])
  for (const scenario of ['traffic', 'closure', 'route-change'] as ScenarioId[]) {
    const alerts = evaluateAlerts(data, state, { day: 0, minute: 380 }, scenario)
    assert.equal(alerts.length, 1)
    assert.equal(evaluateAlerts(data, { ...state, alerts }, { day: 0, minute: 385 }, scenario).length, 0)
    assert.equal(evaluateAlerts(data, state, { day: 1, minute: 380 }, scenario).length, 1)
  }
  assert.equal(evaluateAlerts(data, { ...state, routines: [{ ...routine, paused: true }] }, { day: 0, minute: 380 }, 'traffic').length, 0)
  assert.equal(evaluateAlerts(data, state, { day: 5, minute: 380 }, 'traffic').length, 0)
  assert.equal(evaluateAlerts(data, state, { day: 0, minute: 500 }, 'traffic').length, 0)
  const unaffected = { ...state, routines: [{ ...routine, originId: 'center' }] }
  assert.equal(evaluateAlerts(data, unaffected, { day: 0, minute: 380 }, 'traffic').length, 0)
})

test('el reloj virtual no depende de la zona del navegador y cruza días', () => {
  assert.deepEqual(advanceClock({ day: 0, minute: 1435 }, 15), { day: 1, minute: 10 })
  assert.equal(timeText(1445), '00:05 (+1 día)')
  assert.equal(timeText(-5), '23:55 (día anterior)')
  assert.equal(weekday(-1), 6)
})
