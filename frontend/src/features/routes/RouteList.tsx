import type { Route, Stop } from '../../types/transit'
import { RouteCard } from './RouteCard'
import { groupRoutes } from './routeData'

export function RouteList({ routes, stops, onSelect, searching = false }: { routes: Route[]; stops: Stop[]; onSelect: (id: string) => void; searching?: boolean }) {
  if (!routes.length) return <p className="empty-state">{searching ? 'No encontramos rutas con ese nombre' : 'Aún no hay rutas cargadas'}</p>
  return <ul className="route-list">{groupRoutes(routes).map((group) => <li key={group.id}><RouteCard group={group} stops={stops} onSelect={onSelect} /></li>)}</ul>
}
