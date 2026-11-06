import type { DepartureRecommendation, PlanRequest } from '../../types/journey'
import { timeText } from './time'

interface Props {
  alternatives: DepartureRecommendation[]; selected: DepartureRecommendation | undefined
  recommendedId?: string; request: PlanRequest; sort: string
  onSort: (value: string) => void; onSelect: (id: string) => void
}

export function JourneyResults({ alternatives, selected, recommendedId, request, sort, onSort, onSelect }: Props) {
  const ordered = [...alternatives].sort((a, b) => Number(a.estimate.blocked) - Number(b.estimate.blocked) || (sort === 'walk' ? a.estimate.walkMinutes - b.estimate.walkMinutes : sort === 'transfers' ? a.estimate.transfers - b.estimate.transfers : a.estimate.duration - b.estimate.duration))
  if (!alternatives.length) return <div className="empty-state" role="status"><h3>Combinación no preparada</h3><p>Vuelve a Lugares y elige Casa sur → Universidad, Centro → Universidad o Casa oriente → Centro.</p></div>
  return <section aria-label="Alternativas de viaje" className="journey-results">
    <p className="simulation-label">Tiempos simulados para llegar a las {timeText(request.arriveBy)}. Podrás ajustar el horario en el siguiente paso.</p>
    <label className="sort-label">Ordenar por<select value={sort} onChange={(event) => onSort(event.target.value)}><option value="time">Menos tiempo</option><option value="transfers">Menos transbordos</option><option value="walk">Menos caminata</option></select></label>
    <div className="stack">{ordered.map(({ estimate }) => {
      const chosen = selected?.estimate.itinerary.id === estimate.itinerary.id
      const recommended = recommendedId === estimate.itinerary.id
      return <button type="button" key={estimate.itinerary.id} className="journey-card" aria-pressed={chosen} disabled={estimate.blocked} onClick={() => onSelect(estimate.itinerary.id)}>
        <span className="journey-card-top"><strong>{estimate.itinerary.name}</strong><strong>{estimate.duration} min</strong></span>
        <span>{estimate.walkMinutes} min a pie · {estimate.walkingM} m · {estimate.transfers} {estimate.transfers === 1 ? 'transbordo' : 'transbordos'}</span>
        <span className="card-status">{estimate.blocked ? 'Bloqueada por cierre simulado' : chosen ? recommended ? 'Seleccionada · Recomendada' : 'Seleccionada' : recommended ? 'Recomendada' : 'Alternativa simulada'}</span>
      </button>
    })}</div>
    {!selected && <p role="status">No hay una alternativa disponible en esta situación.</p>}
  </section>
}
