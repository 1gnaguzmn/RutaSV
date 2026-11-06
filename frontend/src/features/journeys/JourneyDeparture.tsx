import { useState } from 'react'
import type { DepartureRecommendation, PlanRequest } from '../../types/journey'
import { parseTime, timeText } from './time'
import { JourneyFlowActions } from './JourneyFlowActions'

interface Props {
  selected: DepartureRecommendation; request: PlanRequest; favorite: boolean
  onTiming: (arriveBy: number, margin: number) => boolean; onFavorite: () => void
  onStart: () => void; onSave: () => void; onBack: () => void; onCancel: () => void
}

export function JourneyDeparture({ selected, request, favorite, onTiming, onFavorite, onStart, onSave, onBack, onCancel }: Props) {
  const [arrival, setArrival] = useState(timeText(request.arriveBy))
  const [margin, setMargin] = useState(String(request.margin))
  const dirty = arrival !== timeText(request.arriveBy) || margin !== String(request.margin)
  return <section className="journey-phase journey-departure" aria-label="Plan de salida">
    <p className="selected-journey"><strong>{selected.estimate.itinerary.name}</strong><span>{selected.estimate.duration} min · simulados</span></p>
    <form className="journey-form timing-form" onSubmit={(event) => { event.preventDefault(); if (onTiming(parseTime(arrival), Number(margin))) setMargin(String(Number(margin))) }}>
      <div className="form-row"><label>Llegar a las<input type="time" required value={arrival} onChange={(event) => setArrival(event.target.value)} /></label><label>Margen (min)<input type="number" min="0" max="60" step="1" required value={margin} onChange={(event) => setMargin(event.target.value)} /></label></div>
      {dirty && <button type="submit" className="secondary-button">Actualizar horario</button>}
    </form>
    {dirty ? <p role="status" className="demo-note">Actualiza el horario para ver el plan de salida y continuar.</p> : <div className="recommendation" role="status">
      <p className="eyebrow">Salida recomendada · simulada</p>
      <p className="departure-time">{selected.departure !== null ? timeText(selected.departure) : 'Sin salida que cumpla el objetivo'}</p>
      {selected.arrival !== null && <p>Llegada {timeText(selected.arrival)} + {request.margin} min de margen → {timeText(request.arriveBy)}.</p>}
      {selected.missed && <p>La hora recomendada ya pasó.</p>}
      {(selected.missed || selected.departure === null) && selected.nextDeparture !== null && <p>Siguiente salida: <strong>{timeText(selected.nextDeparture)}</strong>, llegada {timeText(selected.nextArrival!)}. Puede superar el objetivo.</p>}
    </div>}
    {!dirty && <div className="journey-supporting-details">
      <details><summary>Ver pasos del viaje</summary><ol className="itinerary-legs">{selected.estimate.itinerary.legs.map((leg, index) => <li key={leg.id}><strong>{leg.label}</strong><span>{selected.estimate.legMinutes[index]} min{leg.mode === 'walk' ? ` · ${leg.distanceM} m` : ` · ${leg.stopIds.length} referencias de parada del ejemplo`}</span></li>)}</ol></details>
      <details><summary>Desglose y comparación de horarios</summary>
        <p>{selected.estimate.walkMinutes} min caminando + {selected.estimate.duration - selected.estimate.walkMinutes} min en bus y espera = {selected.estimate.duration} min. Incidencia incluida: +{selected.estimate.delay} min.</p>
        <p className="muted">Patrón simulado: bus +20 % en días laborables, 06:00–08:30 y 16:00–18:30. Salidas cada 5 min, hasta 3 h antes.</p>
        <div className="table-scroll"><table><caption>Tiempos simulados</caption><thead><tr><th>Salida</th><th>Llegada</th><th>Duración</th></tr></thead><tbody>{selected.comparisons.map((item) => <tr key={item.departure}><td>{timeText(item.departure)}</td><td>{timeText(item.arrival)}</td><td>{item.duration} min</td></tr>)}</tbody></table></div>
        <p className="muted">Caminatas rectas y secuencias de prueba. Referencias VMT / ArcGIS (2022), sin verificación de campo.</p>
        <button type="button" className="text-button" aria-pressed={favorite} onClick={onFavorite}>{favorite ? '★ Quitar destino favorito' : '☆ Guardar destino favorito'}</button>
      </details>
    </div>}
    <p className="simulation-label">La simulación empieza con la hora del reloj virtual actual y calcula sus tiempos para esa salida.</p>
    <JourneyFlowActions onBack={onBack} onCancel={onCancel}>
      <button type="button" className="primary-button" disabled={dirty} onClick={onStart}>Simular viaje ahora</button>
      <button type="button" className="secondary-button" disabled={dirty} onClick={onSave}>Guardar como habitual</button>
    </JourneyFlowActions>
  </section>
}
