import type { Route, Stop } from '../../types/transit'
import { SourceDetails } from '../../components/ui/SourceDetails'
import { getRouteStops, groupRoutes } from './routeData'
import './routes.css'

export function RouteDetails({ route, routes, stops, onStop, onRoute }: { route: Route; routes: Route[]; stops: Stop[]; onStop: (id: string) => void; onRoute: (id: string) => void }) {
  const p = route.properties
  const variants = groupRoutes(routes).find((group) => group.id === p.route_id)?.variants ?? [route]
  const routeStops = getRouteStops(route, stops)
  const unordered = p.stop_sequence_status === 'pending'
  const StopList = unordered ? 'ul' : 'ol'
  return <div className="route-details">
    <span className="badge">Seleccionada · {p.source_label ? `Fuente ${p.source_label}` : p.verification_status === 'demonstration' ? 'Demostración' : p.verification_status === 'verified' ? 'Verificada' : 'Sin verificar'}</span>
    <h3>{p.source_route_code ? `Ruta ${p.short_name}` : p.long_name}</h3>
    {p.source_route_code && <p className="muted">{p.source_route_code}</p>}
    {variants.length > 1 ? <div className="variant-field">
      <label htmlFor="route-variant">Recorrido</label>
      <select id="route-variant" value={p.id} onChange={(event) => onRoute(event.target.value)}>
        {variants.map((variant) => <option key={variant.properties.id} value={variant.properties.id}>{variant.properties.direction}</option>)}
      </select>
    </div> : <p className="muted">{p.direction}</p>}
    <h3>{routeStops.length} paradas del recorrido</h3>
    {routeStops.length === 0 && <p className="demo-note">La fuente no incluye paradas para este recorrido. Puedes explorar su trazado en el mapa.</p>}
    {routeStops.some((stop) => (stop.properties.shape_ids?.length ?? 0) > 1) &&
      <p className="demo-note">La fuente contiene varios trazados con el mismo código de recorrido. Las paradas se muestran en todos los trazados compatibles; no se especifica una variante única.</p>}
    {unordered && <p className="demo-note">Orden de viaje no definido · lista alfabética.</p>}
    <StopList className={`stop-list ${unordered ? 'stop-list--unordered' : ''}`}>{routeStops.map((stop) =>
      <li key={stop.properties.id}><button type="button" onClick={() => onStop(stop.properties.id)}>{stop.properties.name}<span aria-hidden="true">→</span></button></li>
    )}</StopList>
    <SourceDetails data={p} />
  </div>
}
