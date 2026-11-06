import type { ActiveJourney } from '../../types/journey'
import { timeText } from './time'
import { JourneyFlowActions } from './JourneyFlowActions'

export function JourneyProgress({ active, onNext, onBack, onCancel }: { active: ActiveJourney; onNext: () => void; onBack: () => void; onCancel: () => void }) {
  const step = active.steps[active.stepIndex]
  const total = active.steps.reduce((sum, item) => sum + item.minutes, 0)
  const elapsed = active.steps.slice(0, active.stepIndex).reduce((sum, item) => sum + item.minutes, 0)
  return <section className="journey-progress" aria-label="Simulación paso a paso">
    <p className="badge">Simulación sin GPS</p>
    <h3 tabIndex={-1}>Paso {active.stepIndex + 1} de {active.steps.length}</h3>
    <progress aria-label="Progreso del viaje simulado" value={active.stepIndex} max={active.steps.length} />
    <div className={step.nextStop ? 'next-stop' : 'step-instruction'} role="status" aria-live="polite"><strong>{step.instruction}</strong><p>{step.minutes} min al completar este paso.</p></div>
    <p>{elapsed} de {total} min · salida {timeText(active.departedAt)} · llegada simulada {timeText(active.departedAt + total)}</p>
    <p className="muted">Avanza con los botones. El escenario y el reloj manual están bloqueados durante el viaje.</p>
    <JourneyFlowActions onBack={onBack} onCancel={onCancel}><button type="button" className="primary-button" onClick={onNext}>{active.stepIndex + 1 === active.steps.length ? 'Finalizar viaje' : 'Completar paso y avanzar'}</button></JourneyFlowActions>
  </section>
}
