import { useEffect, useRef, useState } from 'react'
import { AttributionControl, LngLatBounds, Map, Marker, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { MapInsets, TransitData } from '../../types/transit'
import { RouteLayer } from './RouteLayer'
import { StopLayer } from './StopLayer'
import { MapControls } from './MapControls'
import './map.css'

setWorkerUrl(workerUrl)
const STYLE = 'https://tiles.openfreemap.org/styles/liberty'

interface Props {
  data: TransitData | null
  routeId: string | null
  stopId: string | null
  frameRequest: number
  insets: MapInsets
  onRoute: (id: string) => void
  onStop: (id: string) => void
}

interface CameraSnapshot { center: [number, number]; zoom: number }

export function MapView(props: Props) {
  const [attempt, setAttempt] = useState(0)
  const [camera, setCamera] = useState<CameraSnapshot>({ center: [-89.19, 13.70], zoom: 12 })
  return <MapSession key={attempt} {...props} initialCamera={camera} onRetry={(snapshot) => {
    setCamera(snapshot)
    setAttempt((value) => value + 1)
  }} />
}

function MapSession({ data, routeId, stopId, frameRequest, insets, onRoute, onStop, initialCamera, onRetry }: Props & { initialCamera: CameraSnapshot; onRetry: (snapshot: CameraSnapshot) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<Map | null>(null)
  const locationMarker = useRef<Marker | null>(null)
  const [map, setMap] = useState<Map | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [notice, setNotice] = useState('')
  const [viewportRevision, setViewportRevision] = useState(0)
  const lastFrame = useRef(0)
  const lastViewport = useRef(0)
  const padding = useRef(insets)
  useEffect(() => { padding.current = insets }, [insets])

  useEffect(() => {
    if (!container.current) return
    let next: Map
    try {
      next = new Map({ container: container.current, style: STYLE, ...initialCamera, attributionControl: false,
        locale: { 'AttributionControl.ToggleAttribution': 'Mostrar u ocultar atribuciones del mapa' },
      })
    } catch {
      setError('Este navegador no pudo iniciar el mapa. Comprueba que WebGL esté disponible.')
      return
    }
    instance.current = next
    next.addControl(new AttributionControl({ compact: true }), 'bottom-left')
    next.getCanvas().setAttribute('aria-label', 'Mapa de San Salvador. También puedes explorar rutas y paradas desde el panel.')
    const loaded = () => { setMap(next); setReady(true); setError(null) }
    const failed = () => setError('No se pudo cargar un recurso del mapa. Comprueba tu conexión o vuelve a intentar.')
    next.on('load', loaded)
    next.on('error', failed)
    let width = container.current.clientWidth
    let height = container.current.clientHeight
    const observer = new ResizeObserver(() => {
      const target = next.getContainer()
      const changed = target.clientWidth !== width || target.clientHeight !== height
      width = target.clientWidth
      height = target.clientHeight
      next.resize()
      if (changed) setViewportRevision((value) => value + 1)
    })
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      instance.current = null
      locationMarker.current?.remove()
      locationMarker.current = null
      next.remove()
    }
  }, [initialCamera])

  const frame = () => {
    if (!map) return
    const features = data?.routes.features.filter((route) => !routeId || route.properties.id === routeId) ?? []
    const bounds = new LngLatBounds()
    features.forEach((route) => route.geometry.coordinates.forEach(([lng, lat]) => bounds.extend([lng, lat])))
    if (bounds.isEmpty()) map.jumpTo({ center: [-89.19, 13.70], zoom: 12 })
    else map.fitBounds(bounds, { padding: padding.current, maxZoom: 14.5, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200 })
  }

  // Reencuadrar al seleccionar o cambiar el viewport; plegar el panel conserva la cámara.
  useEffect(() => {
    if (!map || !data) return
    const requested = frameRequest !== lastFrame.current
    const resized = viewportRevision !== lastViewport.current
    if (!requested && (!resized || !routeId)) return
    const task = requestAnimationFrame(() => {
      lastFrame.current = frameRequest
      lastViewport.current = viewportRevision
      const routes = data.routes.features.filter((route) => !routeId || route.properties.id === routeId)
      const bounds = new LngLatBounds()
      routes.forEach((route) => route.geometry.coordinates.forEach(([lng, lat]) => bounds.extend([lng, lat])))
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: padding.current, maxZoom: 14.5, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200 })
    })
    return () => cancelAnimationFrame(task)
  }, [map, data, routeId, frameRequest, viewportRevision])

  const locate = () => {
    if (!map) return
    if (!navigator.geolocation) { setNotice('Tu navegador no admite geolocalización. Puedes seguir explorando las rutas.'); return }
    setLocating(true)
    setNotice('Buscando tu ubicación…')
    navigator.geolocation.getCurrentPosition((position) => {
      if (instance.current !== map) return
      const coordinates: [number, number] = [position.coords.longitude, position.coords.latitude]
      locationMarker.current?.remove()
      const dot = document.createElement('div')
      dot.className = 'user-location'
      dot.setAttribute('aria-label', 'Tu ubicación aproximada')
      locationMarker.current = new Marker({ element: dot }).setLngLat(coordinates).addTo(map)
      const visible = padding.current
      map.easeTo({ center: coordinates, zoom: 14, offset: [(visible.left - visible.right) / 2, (visible.top - visible.bottom) / 2], duration: 0 })
      setNotice(`Ubicación puntual del dispositivo · precisión aproximada ${Math.round(position.coords.accuracy)} m. No representa un bus.`)
      setLocating(false)
    }, (reason) => {
      if (instance.current !== map) return
      setLocating(false)
      setNotice(reason.code === 1 ? 'No autorizaste la ubicación. Puedes seguir explorando las rutas.' : 'No pudimos obtener tu ubicación. Intenta nuevamente.')
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 })
  }

  const retry = () => {
    const active = instance.current
    onRetry(active ? { center: active.getCenter().toArray(), zoom: active.getZoom() } : initialCamera)
  }

  return <>
    <div ref={container} className="map-canvas" />
    {ready && map && data && <><RouteLayer map={map} data={data} selectedId={routeId} onSelect={onRoute} /><StopLayer map={map} data={data} routeId={routeId} selectedId={stopId} onSelect={onStop} /></>}
    <MapControls map={map} onFrame={frame} onLocate={locate} locating={locating} />
    <div className="map-messages">
      {!ready && !error && <p className="map-status" role="status">Cargando mapa…</p>}
      {error && <div className="map-status map-error" role="alert"><p>{error}</p><button type="button" onClick={retry}>Reintentar mapa</button><button type="button" onClick={() => setError(null)}>Ocultar aviso</button></div>}
      {notice && <div className="map-status" role="status"><p>{notice}</p><button type="button" onClick={() => setNotice('')}>Cerrar aviso</button></div>}
    </div>
  </>
}
