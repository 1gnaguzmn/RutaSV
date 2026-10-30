import type { Route, Stop } from '../../types/transit'
import { RouteList } from '../routes/RouteList'
import { getRouteStops } from '../routes/routeData'
import { SourceDetails } from '../../components/ui/SourceDetails'

export function StopDetails({ stop, routes, stops, onRoute }: { stop: Stop; routes: Route[]; stops: Stop[]; onRoute: (id: string) => void }) {
  const [lng, lat] = stop.geometry.coordinates
  const related = routes.filter((route) => getRouteStops(route, [stop]).some((item) => item.properties.id === stop.properties.id))
  return <div>
    <span className="badge">{stop.properties.source_label ? `Fuente ${stop.properties.source_label}` : stop.properties.verification_status === 'demonstration' ? 'Demostración · parada ficticia' : stop.properties.verification_status === 'verified' ? 'Verificada' : 'Sin verificar'}</span>
    <h3>{stop.properties.name}</h3>
    <p className="muted">Longitud {lng.toFixed(5)} · Latitud {lat.toFixed(5)}</p>
    <h3>Ruta y recorrido asociados</h3>
    <RouteList routes={related} stops={stops} onSelect={onRoute} />
    <SourceDetails data={stop.properties} />
  </div>
}
