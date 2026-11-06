import { useCallback, useReducer, useRef, useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import { BottomSheet } from './components/layout/BottomSheet'
import { MapView } from './components/map/MapView'
import { SearchBar } from './components/ui/SearchBar'
import { RouteList } from './features/routes/RouteList'
import { RouteDetails } from './features/routes/RouteDetails'
import { StopDetails } from './features/stops/StopDetails'
import { StopGroupDetails } from './features/stops/StopGroupDetails'
import { sortGroupStops } from './features/stops/stopGroups'
import { initialSelection, selectionReducer } from './features/routes/selection'
import { filterRoutes } from './services/transit'
import { useTransitData } from './hooks/useTransitData'
import { useDesktop, useMapInsets } from './hooks/useMapInsets'
import { getRouteStops, groupRoutes } from './features/routes/routeData'
import { useJourneyDemo } from './hooks/useJourneyDemo'
import { JourneyWorkspace } from './features/journeys/JourneyWorkspace'
import { DAYS, timeText, weekday } from './features/journeys/time'
import { PHASE_LABELS } from './features/journeys/flow'
import type { AppSection, MapScene } from './types/journey'
import './App.css'

export default function App() {
  const [selection, dispatch] = useReducer(selectionReducer, initialSelection)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [frameRequest, setFrameRequest] = useState(0)
  const [navigation, setNavigation] = useState(0)
  const [interactionRevision, setInteractionRevision] = useState(0)
  const [section, setSection] = useState<AppSection>('explore')
  const mapRef = useRef<HTMLElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const desktop = useDesktop()
  const insets = useMapInsets(mapRef, overlayRef, panelRef, desktop, expanded)
  const { data, loading, error, retry } = useTransitData()
  const demo = useJourneyDemo(data)
  const frame = () => setFrameRequest((value) => value + 1)
  const focus = () => setNavigation((value) => value + 1)
  const navigate = (next: AppSection) => {
    if (demo.active && next !== 'planner') return
    setSection(next); setExpanded(true); focus()
    setInteractionRevision((value) => value + 1)
    if (next === 'explore') dispatch({ type: 'explore' })
  }
  const plannerBack = () => { if (demo.phase === 'places') navigate('explore'); else { demo.back(); focus() } }
  const cancelJourney = () => {
    demo.cancelTrip(); setSection('explore'); dispatch({ type: 'explore' }); setExpanded(true)
    setInteractionRevision((value) => value + 1); focus()
  }
  const scene: MapScene = section !== 'explore' && demo.phase !== 'places' && demo.selected ? { mode: 'itinerary', itinerary: demo.selected.estimate.itinerary, activeLeg: demo.active?.steps[demo.active.stepIndex].legIndex ?? null } : { mode: 'explore' }
  const unread = demo.stored.alerts.filter((alert) => !alert.read)
  const routes = data?.routes.features ?? []
  const stops = data?.stops.features ?? []
  const results = filterRoutes(routes, query)
  const resultCount = groupRoutes(results).length
  const route = routes.find((item) => item.properties.id === selection.routeId)
  const stop = stops.find((item) => item.properties.id === selection.stopId)
  const selectRoute = useCallback((id: string) => {
    setInteractionRevision((value) => value + 1)
    dispatch({ type: 'route', id })
    setExpanded(true)
    setFrameRequest((value) => value + 1)
    setNavigation((value) => value + 1)
  }, [])
  const selectStop = useCallback((id: string) => {
    setInteractionRevision((value) => value + 1)
    dispatch({ type: 'stop', id })
    setExpanded(true)
    setNavigation((value) => value + 1)
  }, [])
  const selectGroup = useCallback((ids: string[]) => {
    const knownIds = sortGroupStops(data?.stops.features ?? [], ids).map((item) => item.properties.id)
    if (!knownIds.length) return
    setInteractionRevision((value) => value + 1)
    dispatch({ type: 'group', ids: knownIds })
    setExpanded(true)
    setNavigation((value) => value + 1)
  }, [data])
  const changeVariant = useCallback((id: string) => {
    setInteractionRevision((value) => value + 1)
    dispatch({ type: 'route', id })
    setFrameRequest((value) => value + 1)
  }, [])
  const search = (value: string) => {
    setInteractionRevision((revision) => revision + 1)
    setQuery(value)
    setExpanded(true)
    dispatch({ type: 'explore' })
  }
  const back = () => {
    setInteractionRevision((value) => value + 1)
    dispatch({ type: 'back' })
    setNavigation((value) => value + 1)
  }
  const clearSelection = () => {
    setInteractionRevision((value) => value + 1)
    dispatch({ type: 'explore' })
    setNavigation((value) => value + 1)
  }
  const changeGroupPage = (page: number) => {
    setInteractionRevision((value) => value + 1)
    dispatch({ type: 'group-page', page })
  }
  const title = section !== 'explore' ? section === 'planner' ? PHASE_LABELS[demo.phase].title : section === 'trips' ? 'Mis viajes' : section === 'demo' ? 'Controles de demo' : 'Avisos' : selection.view === 'group' ? 'Grupo de paradas' : selection.view === 'stop' ? 'Detalle de parada' : route ? route.properties.short_name : 'Explorar rutas'
  const summary = section === 'planner' ? PHASE_LABELS[demo.phase].summary : section !== 'explore' ? `${DAYS[weekday(demo.clock.day)]} ${timeText(demo.clock.minute)} · simulación` : selection.view === 'group' ? `${selection.group.stopIds.length} registros · lista alfabética` : selection.view === 'stop' ? 'Ubicación y rutas asociadas' : route ? `${route.properties.direction} · ${getRouteStops(route, stops).length} paradas` : loading ? 'Cargando rutas…' : error ? 'No se pudieron cargar las rutas' : `${resultCount} ${resultCount === 1 ? 'ruta disponible' : 'rutas disponibles'}`

  return <main className="app-shell">
    <section ref={mapRef} className="map-region" aria-label="Mapa interactivo de San Salvador">
      <MapView scene={scene} data={loading || error ? null : data} routeId={section === 'explore' ? selection.routeId : null} stopId={section === 'explore' ? selection.stopId : null} frameRequest={frameRequest} interactionRevision={interactionRevision} insets={insets} onRoute={selectRoute} onStop={selectStop} onGroup={selectGroup} />
      <div ref={overlayRef} className="top-overlay">
        <AppHeader section={section} clock={`${DAYS[weekday(demo.clock.day)].slice(0, 3)} ${timeText(demo.clock.minute)}`} unread={unread.length} disabled={Boolean(demo.active)} onNavigate={navigate} />
        {section === 'explore' && <SearchBar value={query} onChange={search} />}
        {unread.length > 0 && !demo.active && section !== 'alerts' && section !== 'planner' && <button type="button" className="alert-toast" onClick={() => navigate('alerts')}>{unread.length} {unread.length === 1 ? 'aviso simulado' : 'avisos simulados'} · Ver avisos</button>}
      </div>
    </section>
    <BottomSheet journey={section === 'planner'} expanded={expanded} desktop={desktop} title={title} summary={summary} focusKey={String(navigation)} panelRef={panelRef} onToggle={() => setExpanded((value) => !value)} onBack={section === 'planner' ? plannerBack : section === 'explore' && selection.view !== 'explore' ? back : undefined}>
      {loading && <p role="status">Cargando rutas…</p>}
      {error && <div role="alert" className="data-error"><p>{error}</p><button type="button" className="primary-button" onClick={() => { setInteractionRevision((value) => value + 1); retry() }}>Reintentar datos</button></div>}
      {section === 'explore' && !loading && !error && selection.view !== 'explore' && <button type="button" className="clear-selection" onClick={clearSelection}>Limpiar selección</button>}
      {section === 'explore' && !loading && !error && selection.view === 'explore' && <>
        <p className="demo-note">Rutas del AMSS · Fuente VMT / ArcGIS</p>
        <RouteList routes={results} stops={stops} onSelect={selectRoute} searching={Boolean(query.trim())} />
        <button type="button" className="primary-button journey-action" onClick={() => navigate('planner')}>Planificar un viaje</button>
      </>}
      {section === 'explore' && !loading && !error && selection.view === 'route' && route && <RouteDetails route={route} routes={routes} stops={stops} onStop={selectStop} onRoute={changeVariant} />}
      {section === 'explore' && !loading && !error && selection.view === 'stop' && stop && <StopDetails stop={stop} routes={routes} stops={stops} onRoute={selectRoute} />}
      {section === 'explore' && !loading && !error && selection.view === 'group' && <StopGroupDetails group={selection.group} routes={routes} stops={stops} onStop={selectStop} onPage={changeGroupPage} />}
      {section !== 'explore' && !loading && !error && <JourneyWorkspace key={demo.resetRevision} demo={demo} section={section} onNavigate={navigate} onFrame={frame} onFocus={focus} onBack={plannerBack} onCancel={cancelJourney} />}
    </BottomSheet>
    <p className="sr-only" role="status" aria-live="polite">{loading ? 'Cargando rutas' : error ? error : `${resultCount} ${resultCount === 1 ? 'ruta encontrada' : 'rutas encontradas'}`}</p>
  </main>
}
