import type { DemoData, PlanRequest } from '../../types/journey'
import { JourneyLocationLabel } from './JourneyLocationLabel'
import { JourneyFlowActions } from './JourneyFlowActions'

interface Props {
  data: DemoData; draft: PlanRequest; mode: 'manual' | 'examples'; favorites: string[]
  onMode: (mode: 'manual' | 'examples') => void; onChange: (request: PlanRequest) => void
  onPlan: (request: PlanRequest) => void; onBack: () => void; onCancel: () => void
}

export function JourneyPlanner({ data, draft, mode, favorites, onMode, onChange, onPlan, onBack, onCancel }: Props) {
  return <section className="journey-phase journey-places" aria-label="Elegir lugares">
    <div className="places-mode" role="group" aria-label="Cómo elegir el viaje">
      <button type="button" aria-pressed={mode === 'manual'} onClick={() => onMode('manual')}>Elegir lugares</button>
      <button type="button" aria-pressed={mode === 'examples'} onClick={() => onMode('examples')}>Viajes de ejemplo</button>
    </div>
    {mode === 'manual' ? <form id="journey-places-form" className="journey-form" onSubmit={(event) => { event.preventDefault(); onPlan(draft) }}>
      <label><JourneyLocationLabel kind="origin" /><select value={draft.originId} onChange={(event) => onChange({ ...draft, originId: event.target.value })}>{data.places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
      <label><JourneyLocationLabel kind="destination" /><select value={draft.destinationId} onChange={(event) => onChange({ ...draft, destinationId: event.target.value })}>{data.places.map((place) => <option key={place.id} value={place.id}>{favorites.includes(place.id) ? '★ ' : ''}{place.name}</option>)}</select></label>
    </form> : <div className="stack example-trips" aria-label="Viajes preparados disponibles">
      {[['south', 'university'], ['center', 'university'], ['east', 'center']].map(([originId, destinationId]) => <button key={originId} type="button" className="example-trip-button" onClick={() => onPlan({ ...draft, originId, destinationId })}>
        <strong>{data.places.find((p) => p.id === originId)?.name} → {data.places.find((p) => p.id === destinationId)?.name}</strong><span>Ver opciones →</span>
      </button>)}
    </div>}
    <JourneyFlowActions onBack={onBack} onCancel={onCancel}>
      {mode === 'manual' && <button type="submit" form="journey-places-form" className="primary-button">Ver opciones</button>}
    </JourneyFlowActions>
  </section>
}
