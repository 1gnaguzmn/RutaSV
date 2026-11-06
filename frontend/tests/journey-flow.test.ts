import test from 'node:test'
import assert from 'node:assert/strict'
import { journeyFlow, PHASE_LABELS } from '../src/features/journeys/flow.ts'
import type { JourneyPhase } from '../src/types/journey.ts'

test('el flujo recorre lugares, opciones, salida, simulación y finalización', () => {
  let phase: JourneyPhase = 'places'
  phase = journeyFlow(phase, 'planned'); assert.equal(phase, 'options')
  phase = journeyFlow(phase, 'continue'); assert.equal(phase, 'departure')
  phase = journeyFlow(phase, 'start'); assert.equal(phase, 'simulation')
  phase = journeyFlow(phase, 'finish'); assert.equal(phase, 'complete')
  assert.match(PHASE_LABELS.options.summary, /Paso 2 de 3/)
})

test('cada fase permite volver y cancelar; los accesos guardados abren el plan', () => {
  const previous: Record<JourneyPhase, JourneyPhase> = { places: 'places', options: 'places', departure: 'options', simulation: 'departure', complete: 'departure' }
  for (const phase of Object.keys(previous) as JourneyPhase[]) {
    assert.equal(journeyFlow(phase, 'back'), previous[phase])
    assert.equal(journeyFlow(phase, 'reset'), 'places')
    assert.equal(journeyFlow(phase, 'open-plan'), 'departure')
  }
})

test('continuar, iniciar y finalizar requieren su fase previa', () => {
  assert.equal(journeyFlow('places', 'start'), 'places')
  assert.equal(journeyFlow('places', 'continue'), 'places')
  assert.equal(journeyFlow('options', 'start'), 'options')
  assert.equal(journeyFlow('departure', 'finish'), 'departure')
  assert.equal(journeyFlow('complete', 'finish'), 'complete')
})
