import { useEffect, useId, useRef, useState } from 'react'
import { demoData as D, type Paso, type RutaId } from './demoData'
import { PIcon, type PIconName } from './PIcon'
import { RouteSchematic } from './RouteSchematic'

type Tab = 'buscar' | 'calcular' | 'avisos'
interface Trip { desde: string; hasta: string; route: RutaId; days: boolean[] }

const ROUTE_IDS = Object.keys(D.rutas) as RutaId[]
const STEP_ICON: Record<Paso['tipo'], PIconName> = { caminar: 'walk', abordar: 'bus', transbordo: 'transfer', bajar: 'alight' }
const B = D.buscar

/** Única tecla oculta: R reinicia el demo (sin viajes guardados). */
export function PresentationApp() {
  const [run, setRun] = useState(0)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== 'r') return
      const target = event.target as HTMLElement
      if (target.matches('input, textarea')) return
      setRun((value) => value + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return <main className="stage"><Phone key={run} /></main>
}

function Phone() {
  const [tab, setTab] = useState<Tab>('buscar')
  const [trip, setTrip] = useState<Trip | null>(null)
  const [toast, setToast] = useState('')
  const [banner, setBanner] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  // Calcular viaje: se llena con el viaje guardado.
  const [calc, setCalc] = useState({ desde: '', hasta: '' })

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (!banner) return
    const timer = window.setTimeout(() => setBanner(false), 8000)
    return () => window.clearTimeout(timer)
  }, [banner])

  const save = (value: Trip) => { setTrip(value); setCalc({ desde: value.desde, hasta: value.hasta }); setToast(B.guardado) }
  const openAlert = () => { setBanner(false); setTab('avisos'); setAlertOpen(true) }
  const changeTab = (next: Tab) => { setTab(next); if (next !== 'avisos') setAlertOpen(false) }

  return <div className="phone">
    <div className="phone-screen">
      <header className="phone-top">
        <div className="p-brand"><span className="p-brand-mark"><PIcon name="bus" /></span>{D.marca}</div>
        <span className="data-label">{D.etiquetaDatos}</span>
      </header>
      <div className="screen" key={tab + (alertOpen ? '-alerta' : '')}>
        {tab === 'buscar' && <Buscar trip={trip} onSave={save} onRemove={() => setTrip(null)} />}
        {tab === 'calcular' && <Calcular initial={calc} route={D.calcular.ruta} onFields={setCalc} />}
        {tab === 'avisos' && (alertOpen
          ? <AlertaCierre route={trip?.route ?? D.avisos.cierre.rutaPorDefecto} onBack={() => setAlertOpen(false)} />
          : <Avisos onOpen={openAlert} onExample={() => setBanner(true)} />)}
      </div>
      <nav className="tab-bar" aria-label="Secciones">
        {([['buscar', 'search', D.pestanas.buscar], ['calcular', 'clock', D.pestanas.calcular], ['avisos', 'bell', D.pestanas.avisos]] as [Tab, PIconName, string][]).map(([id, icon, label]) =>
          <button type="button" key={id} className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => changeTab(id)}><PIcon name={icon} />{label}</button>)}
      </nav>
      {toast && <p className="toast" role="status"><PIcon name="check" />{toast}</p>}
      {banner && <button type="button" className="banner" onClick={openAlert}><NotificationContent aviso={D.avisos.lista[0]} /></button>}
    </div>
  </div>
}

/* ── Campos con sugerencias ───────────────────────────────────────────────── */
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function PlaceField({ label, value, kind, onChange }: { label: string; value: string; kind: 'origin' | 'destination'; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const matches = D.sugerencias.filter((place) => normalize(place).includes(normalize(value)) && place !== value).slice(0, 4)
  return <div className="place-field">
    <span className={`place-dot is-${kind}`}>{kind === 'origin' ? 'A' : 'B'}</span>
    <label className="place-text" htmlFor={id}><span className="place-label">{label}</span>
      <input id={id} className="place-input" value={value} autoComplete="off" placeholder={label}
        onChange={(event) => { onChange(event.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} />
    </label>
    {open && matches.length > 0 && <ul className="suggestions" role="listbox">
      {matches.map((place) => <li key={place}><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(place); setOpen(false) }}><PIcon name="pin" />{place}</button></li>)}
    </ul>}
  </div>
}

/* ── Pestaña 1 · Buscar ───────────────────────────────────────────────────── */
const transfersText = (n: number) => n === 0 ? B.sinTransbordos : `${n} ${n === 1 ? B.transbordo : B.transbordos}`
const daysText = (days: boolean[]) => days.every((on, i) => on === (i < 5)) ? B.lunesAViernes : days.map((on, i) => on ? B.diasNombres[i].slice(0, 3) : '').filter(Boolean).join(', ')

function Buscar({ trip, onSave, onRemove }: { trip: Trip | null; onSave: (trip: Trip) => void; onRemove: () => void }) {
  const [desde, setDesde] = useState(D.origen)
  const [hasta, setHasta] = useState(D.destino)
  const [searched, setSearched] = useState(false)
  const [open, setOpen] = useState<RutaId | null>(null)
  const [chosen, setChosen] = useState<RutaId | null>(null)
  const [days, setDays] = useState<boolean[]>([...B.diasPreseleccionados])
  const ready = desde.trim() !== '' && hasta.trim() !== '' && desde.trim() !== hasta.trim()
  const edit = (set: (value: string) => void) => (value: string) => { set(value); setSearched(false); setOpen(null); setChosen(null) }
  const savedNow = trip !== null && chosen !== null && trip.route === chosen && trip.desde === desde && trip.hasta === hasta
  const saveRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLElement>(null)
  // Mantener a la vista lo que acaba de aparecer.
  useEffect(() => { if (chosen) saveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [chosen])
  useEffect(() => { if (trip) topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [trip])

  return <section className="tab-page" ref={topRef}>
    {trip && <div className="saved-trips">
      <h2 className="p-subtitle">{B.tusViajes}</h2>
      <div className="trip-card">
        <span className="trip-icon"><PIcon name="calendar" /></span>
        <span className="trip-text"><strong>{trip.desde} → {trip.hasta}</strong><span>{daysText(trip.days)} · {D.rutas[trip.route].titulo}</span></span>
        <button type="button" className="link-button" onClick={onRemove}>{B.quitar}</button>
      </div>
    </div>}

    <div className="place-fields">
      <PlaceField label={B.desde} value={desde} kind="origin" onChange={edit(setDesde)} />
      <PlaceField label={B.hasta} value={hasta} kind="destination" onChange={edit(setHasta)} />
    </div>
    <button type="button" className={searched ? 'p-secondary' : 'p-primary'} disabled={!ready} onClick={() => setSearched(true)}><PIcon name="search" />{B.boton}</button>

    {searched && <div className="results">
      {ROUTE_IDS.map((id) => {
        const r = D.rutas[id]
        const expanded = open === id
        return <article key={id} className={`route-card is-${id.toLowerCase()}${expanded ? ' is-open' : ''}`}>
          <button type="button" className="route-summary" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : id)}>
            <span className="route-name">{r.titulo} · <span className="route-tag">{r.etiqueta}</span>{chosen === id && <span className="chosen-badge"><PIcon name="check" />{B.elegida}</span>}</span>
            <span className="route-duration"><strong>{r.duracionMin}</strong> min</span>
            <span className="route-facts"><span><PIcon name="walk" />{r.caminataMin} {B.caminando}</span><span><PIcon name="transfer" />{transfersText(r.transbordos)}</span></span>
            <PIcon name="chevron" className="route-chevron" />
          </button>
          {expanded && <div className="route-detail">
            <ol className="steps">
              {r.pasos.map((paso, i) => <li key={i} className={`step is-${paso.tipo}`}>
                <span className="step-icon"><PIcon name={STEP_ICON[paso.tipo]} /></span>
                <span className="step-text"><strong>{paso.texto}</strong>{stepMeta(paso) && <span>{stepMeta(paso)}</span>}</span>
              </li>)}
            </ol>
            {chosen !== id && <button type="button" className="p-primary" onClick={() => { setChosen(id); setOpen(null) }}>{B.elegir}</button>}
          </div>}
        </article>
      })}
    </div>}

    {chosen && !savedNow && <div className="save-box" ref={saveRef}>
      <h2 className="p-subtitle">{B.guardarTitulo}</h2>
      <p className="save-route">{desde} → {hasta} · {D.rutas[chosen].titulo}</p>
      <div className="day-chips" role="group" aria-label="Días">
        {B.dias.map((day, i) => <button type="button" key={i} className="day-chip" aria-pressed={days[i]} aria-label={B.diasNombres[i]} onClick={() => setDays((value) => value.map((on, j) => j === i ? !on : on))}>{day}</button>)}
      </div>
      <p className="fine-print">{B.privacidad}</p>
      <button type="button" className="p-primary" disabled={!days.some(Boolean)} onClick={() => onSave({ desde, hasta, route: chosen, days })}>{B.guardar}</button>
    </div>}
  </section>
}

function stepMeta(paso: Paso) {
  if (paso.tipo === 'abordar' || paso.tipo === 'transbordo') return [paso.paradas !== undefined ? `${paso.paradas} ${B.paradas}` : '', paso.min !== undefined ? `${paso.min} min` : ''].filter(Boolean).join(' · ')
  return paso.min !== undefined ? `${paso.min} min` : ''
}

/* ── Pestaña 2 · Calcular viaje ───────────────────────────────────────────── */
const C = D.calcular
function formatTime(minutes: number) {
  const m = ((minutes % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? C.am : C.pm}`
}

function Calcular({ initial, route, onFields }: { initial: { desde: string; hasta: string }; route: RutaId; onFields: (value: { desde: string; hasta: string }) => void }) {
  const [desde, setDesde] = useState(initial.desde)
  const [hasta, setHasta] = useState(initial.hasta)
  const [hora, setHora] = useState('')
  const [result, setResult] = useState<number | null>(null)
  const ready = desde.trim() !== '' && hasta.trim() !== '' && /^\d{2}:\d{2}$/.test(hora)
  const update = (next: { desde: string; hasta: string }) => { setDesde(next.desde); setHasta(next.hasta); onFields(next); setResult(null) }
  const calculate = () => { const [h, m] = hora.split(':').map(Number); setResult(h * 60 + m - C.duracionHabitualMin - C.margenMin) }
  const pasos = D.rutas[route].pasos

  return <section className="tab-page">
    <div className="place-fields">
      <PlaceField label={B.desde} value={desde} kind="origin" onChange={(value) => update({ desde: value, hasta })} />
      <PlaceField label={B.hasta} value={hasta} kind="destination" onChange={(value) => update({ desde, hasta: value })} />
    </div>
    <label className="time-label">{C.hora}
      <input type="time" className="time-input" value={hora} onChange={(event) => { setHora(event.target.value); setResult(null) }} />
    </label>
    <button type="button" className={result === null ? 'p-primary' : 'p-secondary'} disabled={!ready} onClick={calculate}>{C.boton}</button>
    {result !== null && <div className="result" role="status">
      <p className="result-time">{C.salAntes} <strong>{formatTime(result)}</strong></p>
      <p className="result-sub">{D.rutas[route].titulo} · {C.duracionHabitualMin} {C.resumenViaje} + {C.margenMin} {C.resumenMargen}</p>
      <ol className="mini-steps">
        {pasos.map((paso, i) => <li key={i}><PIcon name={STEP_ICON[paso.tipo]} />{paso.texto}{paso.min !== undefined && <span>{paso.min} min</span>}</li>)}
      </ol>
      <p className="estimate-note">{C.nota}</p>
    </div>}
  </section>
}

/* ── Pestaña 3 · Avisos ───────────────────────────────────────────────────── */
type Aviso = (typeof D.avisos.lista)[number]
function NotificationContent({ aviso }: { aviso: Aviso }) {
  return <>
    <span className="notif-head"><span className="notif-app"><PIcon name="bus" /></span><span className="notif-appname">{D.marca}</span><span className="notif-when">{aviso.hora}</span></span>
    <strong className="notif-title">{aviso.titulo}</strong>
    <span className="notif-body">{aviso.texto}</span>
  </>
}

function Avisos({ onOpen, onExample }: { onOpen: () => void; onExample: () => void }) {
  return <section className="tab-page">
    <p className="intro">{D.avisos.intro}</p>
    <ul className="notif-list">
      {D.avisos.lista.map((aviso) => <li key={aviso.id}>
        {aviso.id === 'cierre'
          ? <button type="button" className="notification is-tappable" onClick={onOpen}><NotificationContent aviso={aviso} /></button>
          : <div className="notification"><NotificationContent aviso={aviso} /></div>}
      </li>)}
    </ul>
    <button type="button" className="p-primary" onClick={onExample}><PIcon name="bell" />{D.avisos.boton}</button>
  </section>
}

function AlertaCierre({ route, onBack }: { route: RutaId; onBack: () => void }) {
  const A = D.avisos.cierre
  return <section className="tab-page">
    <button type="button" className="link-button is-back" onClick={onBack}>{D.avisos.volver}</button>
    <h2 className="p-title">{A.titulo}</h2>
    <p className="danger-chip"><PIcon name="alert" />{A.chip}</p>
    <RouteSchematic pasos={D.rutas[route].pasos} origen={D.origen} destino={D.destino} mode="aviso" pasoAfectado={A.pasoAfectado[route]} alterna={A.rutaAlterna} cerrado={A.cerrado} />
    <p className="alt-text">{A.rutaAlternaTexto}</p>
    <p className="leave-callout">{A.salidaAntes} <strong>{A.horaSalidaAlterna}</strong> {A.salidaDespues}</p>
  </section>
}
