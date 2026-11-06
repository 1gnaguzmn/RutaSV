import type { JourneyPhase } from '../../types/journey.ts'

type FlowEvent = 'planned' | 'continue' | 'start' | 'finish' | 'back' | 'open-plan' | 'reset'
export function journeyFlow(phase: JourneyPhase, event: FlowEvent): JourneyPhase {
  if (event === 'reset') return 'places'
  if (event === 'planned') return 'options'
  if (event === 'open-plan') return 'departure'
  if (event === 'continue' && phase === 'options') return 'departure'
  if (event === 'start' && phase === 'departure') return 'simulation'
  if (event === 'finish' && phase === 'simulation') return 'complete'
  if (event === 'back') return { places: 'places', options: 'places', departure: 'options', simulation: 'departure', complete: 'departure' }[phase] as JourneyPhase
  return phase
}

export const PHASE_LABELS: Record<JourneyPhase, { title: string; summary: string }> = {
  places: { title: 'Elige tu viaje', summary: 'Paso 1 de 3 · Lugares de ejemplo' },
  options: { title: 'Compara tus opciones', summary: 'Paso 2 de 3 · Tiempos simulados' },
  departure: { title: 'Plan de salida', summary: 'Paso 3 de 3 · Revisa y continúa' },
  simulation: { title: 'Tu viaje en curso', summary: 'Simulación paso a paso · sin GPS' },
  complete: { title: 'Llegaste al destino', summary: 'Viaje simulado finalizado' },
}
