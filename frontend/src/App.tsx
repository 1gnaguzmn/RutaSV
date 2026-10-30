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
import './App.css'

export default function App() {
  const [selection, dispatch] = useReducer(selectionReducer, initialSelection)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [frameRequest, setFrameRequest] = useState(0)
  const [navigation, setNavigation] = useState(0)
  const [interactionRevision, setInteractionRevision] = useState(0)
  const [plannerNotice, setPlannerNotice] = useState(false)
  const mapRef = useRef<HTMLElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const desktop = useDesktop()
  const insets = useMapInsets(mapRef, overlayRef, panelRef, desktop, expanded)
  const { data, loading, error, retry } = useTransitData()
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
  const title = selection.view === 'group' ? 'Grupo de paradas' : selection.view === 'stop' ? 'Detalle de parada' : route ? route.properties.short_name : 'Explorar rutas'
  const summary = selection.view === 'group' ? `${selection.group.stopIds.length} registros · lista alfabética` : selection.view === 'stop' ? 'Ubicación y rutas asociadas' : route ? `${route.properties.direction} · ${getRouteStops(route, stops).length} paradas` : loading ? 'Cargando rutas…' : error ? 'No se pudieron cargar las rutas' : `${resultCount} ${resultCount === 1 ? 'ruta disponible' : 'rutas disponibles'}`

  return <main className="app-shell">
    <section ref={mapRef} className="map-region" aria-label="Mapa interactivo de San Salvador">
      <MapView data={loading || error ? null : data} routeId={selection.routeId} stopId={selection.stopId} frameRequest={frameRequest} interactionRevision={interactionRevision} insets={insets} onRoute={selectRoute} onStop={selectStop} onGroup={selectGroup} />
      <div ref={overlayRef} className="top-overlay">
        <AppHeader />
        <SearchBar value={query} onChange={search} />
      </div>
    </section>
    <BottomSheet expanded={expanded} desktop={desktop} title={title} summary={summary} focusKey={String(navigation)} panelRef={panelRef} onToggle={() => setExpanded((value) => !value)} onBack={selection.view !== 'explore' ? back : undefined}>
      {loading && <p role="status">Cargando rutas…</p>}
      {error && <div role="alert" className="data-error"><p>{error}</p><button type="button" className="primary-button" onClick={() => { setInteractionRevision((value) => value + 1); retry() }}>Reintentar datos</button></div>}
      {!loading && !error && selection.view !== 'explore' && <button type="button" className="clear-selection" onClick={clearSelection}>Limpiar selección</button>}
      {!loading && !error && selection.view === 'explore' && <>
        <p className="demo-note">Rutas del AMSS · Fuente VMT / ArcGIS</p>
        <RouteList routes={results} stops={stops} onSelect={selectRoute} searching={Boolean(query.trim())} />
        <button type="button" className="primary-button journey-action" onClick={() => setPlannerNotice(true)}>Planificar un viaje</button>
        {plannerNotice && <p role="status" className="muted">Disponible en una próxima fase.</p>}
      </>}
      {!loading && !error && selection.view === 'route' && route && <RouteDetails route={route} routes={routes} stops={stops} onStop={selectStop} onRoute={changeVariant} />}
      {!loading && !error && selection.view === 'stop' && stop && <StopDetails stop={stop} routes={routes} stops={stops} onRoute={selectRoute} />}
      {!loading && !error && selection.view === 'group' && <StopGroupDetails group={selection.group} routes={routes} stops={stops} onStop={selectStop} onPage={changeGroupPage} />}
    </BottomSheet>
    <p className="sr-only" role="status" aria-live="polite">{loading ? 'Cargando rutas' : error ? error : `${resultCount} ${resultCount === 1 ? 'ruta encontrada' : 'rutas encontradas'}`}</p>
  </main>
}
