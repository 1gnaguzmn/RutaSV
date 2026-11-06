import type { DemoAlert, DemoClock, DemoData, DemoStorage, ScenarioId } from '../../types/journey.ts'
import { planAlternatives, preferredAlternative } from '../journeys/planning.ts'
import { timeText, weekday } from '../journeys/time.ts'

export function evaluateAlerts(data: DemoData, state: DemoStorage, clock: DemoClock, scenario: ScenarioId): DemoAlert[] {
  if (scenario === 'normal') return []
  const incident = data.incidents.find((item) => item.id === scenario)!
  return state.routines.flatMap((routine) => {
    const id = `${routine.id}:${scenario}:${clock.day}`
    if (routine.paused || !routine.days.includes(weekday(clock.day)) || state.alerts.some((a) => a.id === id) || clock.minute > routine.arriveBy) return []
    const baseline = preferredAlternative(planAlternatives(data, 'normal', routine, clock.day, clock.minute))
    const current = preferredAlternative(planAlternatives(data, scenario, routine, clock.day, clock.minute))
    if (!baseline || !current || baseline.departure === null || current.departure === null) return []
    const affected = baseline.estimate.itinerary.legs.some((leg) => incident.affectedRouteNames.includes(leg.routeName!))
    const changed = current.departure !== baseline.departure || current.estimate.itinerary.id !== baseline.estimate.itinerary.id || scenario === 'route-change'
    if (!affected || !changed || clock.minute < Math.min(baseline.departure, current.departure) - routine.leadMinutes) return []
    const message = scenario === 'traffic' ? `Salida recomendada ${timeText(current.departure)} (antes ${timeText(baseline.departure)}). ${current.estimate.itinerary.name}; llegada ${timeText(current.arrival!)} y margen ${routine.margin} min.`
      : scenario === 'closure' ? `Usa ${current.estimate.itinerary.name}: el cierre bloquea la opción habitual. Sal ${timeText(current.departure)}.`
      : `Nuevo abordaje de ejemplo a 150 m del anterior. Consulta el primer paso actualizado; sal ${timeText(current.departure)}.`
    return [{ id, routineId: routine.id, incidentId: scenario, day: clock.day, title: `${routine.name} · ${incident.title}`, message, itineraryId: current.estimate.itinerary.id, departure: current.departure, read: false }]
  })
}
