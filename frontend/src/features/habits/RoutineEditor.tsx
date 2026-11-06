import { useState } from 'react'
import type { DemoData, HabitualTrip, PlanRequest } from '../../types/journey'
import { DAYS, parseTime, timeText } from '../journeys/time'

export function RoutineEditor({ data, initial, onSave, onCancel, newId }: { data: DemoData; initial: PlanRequest | HabitualTrip; onSave: (routine: HabitualTrip) => void; onCancel: () => void; newId: () => string }) {
  const existing = 'id' in initial ? initial : null
  const [name, setName] = useState(existing?.name ?? `${data.places.find((p) => p.id === initial.originId)?.name} → ${data.places.find((p) => p.id === initial.destinationId)?.name}`)
  const [origin, setOrigin] = useState(initial.originId)
  const [destination, setDestination] = useState(initial.destinationId)
  const [arrival, setArrival] = useState(timeText(initial.arriveBy))
  const [margin, setMargin] = useState(initial.margin)
  const [lead, setLead] = useState(existing?.leadMinutes ?? 15)
  const [days, setDays] = useState(existing?.days ?? [0, 1, 2, 3, 4])
  const supported = data.itineraries.some((trip) => trip.originId === origin && trip.destinationId === destination)
  return <form className="journey-form routine-editor" onSubmit={(event) => { event.preventDefault(); if (days.length && supported) onSave({ id: existing?.id ?? newId(), name: name.trim(), originId: origin, destinationId: destination, arriveBy: parseTime(arrival), margin, days, leadMinutes: lead, paused: existing?.paused ?? false }) }}>
    <h3>{existing ? 'Editar viaje habitual' : 'Guardar un viaje habitual'}</h3>
    <label>Nombre<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Origen<select value={origin} onChange={(event) => setOrigin(event.target.value)}>{data.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Destino<select value={destination} onChange={(event) => setDestination(event.target.value)}>{data.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    {!supported && <p role="status">Elige una combinación preparada para guardar esta rutina.</p>}
    <div className="form-row"><label>Llegada deseada<input type="time" required value={arrival} onChange={(event) => setArrival(event.target.value)} /></label><label>Margen (min)<input type="number" min="0" max="60" required value={margin} onChange={(event) => setMargin(Number(event.target.value))} /></label></div>
    <label>Anticipación del aviso (min)<input type="number" min="0" max="120" required value={lead} onChange={(event) => setLead(Number(event.target.value))} /></label>
    <fieldset className="day-picker"><legend>Días de viaje</legend>{DAYS.map((day, i) => <label key={day}><input type="checkbox" checked={days.includes(i)} onChange={() => setDays((value) => value.includes(i) ? value.filter((d) => d !== i) : [...value, i])} />{day}</label>)}</fieldset>
    {!days.length && <p role="status">Selecciona al menos un día.</p>}
    <p className="muted">Se guardará en este navegador con tu aceptación. Los avisos funcionan mientras la demo está abierta.</p>
    <div className="stack"><button type="submit" className="primary-button" disabled={!days.length || !supported || !name.trim()}>Aceptar y guardar rutina</button><button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button></div>
  </form>
}
