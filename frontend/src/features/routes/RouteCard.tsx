import type { RouteGroup, Stop } from '../../types/transit'
import { Icon } from '../../components/ui/Icon'
import { getGroupStops } from './routeData'
import { getRouteAppearance } from './routeAppearance'
import './routes.css'

export function RouteCard({ group, stops, onSelect }: { group: RouteGroup; stops: Stop[]; onSelect: (id: string) => void }) {
  const route = group.variants[0]
  const p = route.properties
  const count = getGroupStops(group, stops).length
  const appearance = getRouteAppearance(p)
  return <button className="route-card" type="button" onClick={() => onSelect(p.id)}>
    <span className={`route-code route-code--${appearance.key}`}><Icon name="bus" /><strong>{p.short_name}</strong></span>
    <span className="route-card-info">
      <strong>{p.source_route_code ? `Ruta ${p.short_name}` : p.long_name}</strong>
      <span>{group.variants.length} {group.variants.length === 1 ? 'recorrido' : 'recorridos'} · {count} registros de paradas</span>
      <span>{group.variants.map((variant) => variant.properties.direction).join(' / ')}</span>
      <span className="verification">{p.source_label ? `Fuente ${p.source_label}` : p.verification_status === 'demonstration' ? 'Demostración · datos ficticios' : p.verification_status === 'verified' ? 'Verificada' : 'Sin verificar'}</span>
    </span>
    <span aria-hidden="true">→</span>
  </button>
}
