import { useState } from 'react'
import type { JourneyDemo } from '../../hooks/useJourneyDemo'
import type { AppSection, HabitualTrip, PlanRequest } from '../../types/journey'
import { JourneyPlanner } from './JourneyPlanner'
import { JourneyResults } from './JourneyResults'
import { JourneyProgress } from './JourneyProgress'
import { JourneyDeparture } from './JourneyDeparture'
import { JourneyFlowActions } from './JourneyFlowActions'
import { DemoControls } from './DemoControls'
import { RoutineEditor } from '../habits/RoutineEditor'
import { pairKey, placeName } from '../habits/habits'
import { DAYS, timeText, weekday } from './time'
import './journeys.css'

export function JourneyWorkspace({ demo, section, onNavigate, onFrame, onFocus, onBack, onCancel }: { demo: JourneyDemo; section: AppSection; onNavigate: (section: AppSection) => void; onFrame: () => void; onFocus: () => void; onBack: () => void; onCancel: () => void }) {
  const [editor, setEditor] = useState<PlanRequest | HabitualTrip | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [editorReturn, setEditorReturn] = useState<'planner' | 'trips'>('trips')
  const [sort, setSort] = useState('time')
  const edit = (initial: PlanRequest | HabitualTrip) => { setEditorReturn(section === 'planner' ? 'planner' : 'trips'); setEditor(initial); setEditorKey((n) => n + 1); onNavigate('trips') }
  const closeEditor = () => { setEditor(null); onNavigate(editorReturn) }
  if (demo.error) return <><div role="alert"><p>{demo.error}</p><button type="button" className="primary-button" onClick={demo.retry}>Reintentar escenarios</button></div>{section === 'planner' && <JourneyFlowActions onBack={onBack} onCancel={onCancel} />}</>
  const data = demo.data
  if (!data) return <><p role="status">Cargando ejemplos de viaje…</p>{section === 'planner' && <JourneyFlowActions onBack={onBack} onCancel={onCancel} />}</>
  const showPlan = (request: PlanRequest) => { if (demo.plan(request)) { onFrame(); onFocus() } }
  return <>
    {!demo.persistent && <p role="status" className="demo-note">El almacenamiento no está disponible. Tus cambios se conservan en memoria durante esta sesión.</p>}
    {section === 'demo' && <DemoControls demo={demo} onFrame={onFrame} />}
    {demo.notice && (section !== 'planner' || demo.phase === 'departure') && <p role="status" className="demo-note">{demo.notice}</p>}
    {demo.suggestion && !demo.active && !editor && (section === 'trips' || (section === 'planner' && demo.phase === 'complete')) && <div className="habit-suggestion"><strong>¿Recordamos este viaje como habitual?</strong><p>Completaste tres viajes {placeName(data, demo.suggestion.originId)} → {placeName(data, demo.suggestion.destinationId)} en 14 días y a una hora similar (±30 min). Dos pertenecen al historial inicial simulado.</p><div className="stack"><button type="button" className="primary-button" onClick={() => edit(demo.suggestion!)}>Revisar y aceptar rutina</button><button type="button" className="text-button" onClick={() => demo.dismissSuggestion(pairKey(demo.suggestion!.originId, demo.suggestion!.destinationId))}>No sugerir este viaje</button></div></div>}
    {section === 'planner' && <>
      {demo.phase === 'places' && <JourneyPlanner data={data} draft={demo.draft} mode={demo.placesMode} favorites={demo.stored.favorites} onMode={demo.setPlacesMode} onChange={demo.setDraft} onPlan={showPlan} onBack={onBack} onCancel={onCancel} />}
      {demo.phase === 'options' && <section className="journey-phase journey-options" aria-label="Comparar opciones">
        <p className="journey-route-summary">{placeName(data, demo.request.originId)} → {placeName(data, demo.request.destinationId)}</p>
        <JourneyResults alternatives={demo.alternatives} selected={demo.selected} recommendedId={demo.recommended?.estimate.itinerary.id} request={demo.request} sort={sort} onSort={setSort} onSelect={(id) => { demo.select(id); onFrame() }} />
        <JourneyFlowActions onBack={onBack} onCancel={onCancel}><button type="button" className="primary-button" disabled={!demo.selected} onClick={() => { demo.continueToDeparture(); onFocus() }}>Ver plan de salida</button></JourneyFlowActions>
      </section>}
      {demo.phase === 'departure' && (demo.selected ? <JourneyDeparture selected={demo.selected} request={demo.request} favorite={demo.stored.favorites.includes(demo.request.destinationId)} onTiming={demo.updateTiming} onFavorite={() => demo.toggleFavorite(demo.request.destinationId)} onStart={() => { demo.start(); onFocus() }} onSave={() => edit(demo.request)} onBack={onBack} onCancel={onCancel} /> : <><p role="status">No hay una alternativa disponible. Vuelve para revisar las opciones.</p><JourneyFlowActions onBack={onBack} onCancel={onCancel} /></>)}
      {demo.phase === 'simulation' && demo.active && <JourneyProgress active={demo.active} onNext={() => { demo.nextStep(); onFocus() }} onBack={onBack} onCancel={onCancel} />}
      {demo.phase === 'complete' && <section className="journey-phase journey-complete" aria-label="Viaje finalizado"><p>Llegaste a {placeName(data, demo.request.destinationId)} a las {timeText(demo.clock.minute)} del reloj virtual. El viaje completado se agregó al historial.</p><JourneyFlowActions onBack={onBack} onCancel={onCancel}><button type="button" className="primary-button" onClick={() => { demo.restartPlan(); onFocus() }}>Planificar otro viaje</button><button type="button" className="secondary-button" onClick={() => { demo.back(); onFocus() }}>Ver plan de salida</button></JourneyFlowActions></section>}
    </>}
    {section === 'trips' && <>
      {editor ? <RoutineEditor key={editorKey} data={data} initial={editor} newId={demo.newId} onSave={(routine) => { demo.saveRoutine(routine); closeEditor() }} onCancel={closeEditor} /> : <>
        <p className="simulation-label">Rutinas locales · ejemplos de la demo de Martín</p>
        <button type="button" className="primary-button" onClick={() => edit(demo.request)}>Añadir viaje habitual</button>
        {!demo.stored.routines.length && <p className="empty-state">Aún no guardaste viajes habituales. Solo se crean al aceptar.</p>}
        {demo.stored.routines.map((routine) => <article key={routine.id} className="routine-card"><h3>{routine.name}</h3><p>{placeName(data, routine.originId)} → {placeName(data, routine.destinationId)}</p><p>Llegada {timeText(routine.arriveBy)} · margen {routine.margin} min · aviso {routine.leadMinutes} min antes.</p><p>{routine.days.map((day) => DAYS[day].slice(0, 3)).join(', ')} · {routine.paused ? 'Pausada' : 'Activa'}</p><div className="control-row"><button type="button" className="secondary-button" onClick={() => edit(routine)}>Editar</button><button type="button" className="secondary-button" onClick={() => demo.toggleRoutine(routine.id)}>{routine.paused ? 'Reanudar' : 'Pausar'}</button><button type="button" className="secondary-button" onClick={() => demo.removeRoutine(routine.id)}>Borrar</button></div><button type="button" className="text-button" onClick={() => { demo.plan(routine, undefined, 'departure'); onNavigate('planner'); onFrame() }}>Ver este plan</button></article>)}
        <h3>Destinos favoritos</h3>{!demo.stored.favorites.length ? <p className="muted">Guarda un destino desde el planificador.</p> : <div className="control-row">{demo.stored.favorites.map((id) => <button type="button" className="secondary-button" key={id} onClick={() => { demo.plan({ ...demo.request, destinationId: id }); onNavigate('planner'); onFrame() }}>★ {placeName(data, id)}</button>)}</div>}
        <details><summary>Historial de demostración ({demo.stored.history.length})</summary>{demo.stored.history.map((entry) => <p key={entry.id}>{placeName(data, entry.originId)} → {placeName(data, entry.destinationId)} · {DAYS[weekday(entry.day)]}, día {entry.day} · {timeText(entry.departedAt)} · simulado{entry.id.startsWith('seed') ? ' (ejemplo inicial)' : ''}</p>)}</details>
      </>}
    </>}
    {section === 'alerts' && <>
      <p className="simulation-label">Avisos simulados · solo dentro de la app abierta</p>
      {!demo.stored.alerts.length && <p className="empty-state">Sin avisos. Guarda una rutina y avanza el reloj hasta su ventana de aviso con tráfico, cierre o cambio de recorrido. En situación normal no enviamos avisos.</p>}
      {[...demo.stored.alerts].reverse().map((alert) => <article key={alert.id} className="in-app-alert"><strong>{alert.title}</strong><p>{alert.message}</p><p className="muted">{DAYS[weekday(alert.day)]} · día virtual {alert.day}{alert.read ? ' · consultado' : ' · nuevo'}</p><button type="button" className="secondary-button" onClick={() => { demo.openAlert(alert); onNavigate('planner'); onFrame() }}>{alert.incidentId === 'closure' ? 'Ver alternativa' : 'Ver plan'}</button></article>)}
    </>}
  </>
}
