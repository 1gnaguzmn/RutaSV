import { useEffect, useMemo, useRef } from 'react'
import type { Route, Stop, StopGroupContext } from '../../types/transit'
import { sortGroupStops, STOP_GROUP_PAGE_SIZE, stopRouteLabels } from './stopGroups'
import '../routes/routes.css'

interface Props { group: StopGroupContext; stops: Stop[]; routes: Route[]; onStop: (id: string) => void; onPage: (page: number) => void }

export function StopGroupDetails({ group, stops, routes, onStop, onPage }: Props) {
  const records = useMemo(() => sortGroupStops(stops, group.stopIds), [stops, group.stopIds])
  const labels = useMemo(() => stopRouteLabels(routes, stops), [routes, stops])
  const heading = useRef<HTMLHeadingElement>(null)
  const previousPage = useRef(group.page)
  useEffect(() => {
    if (previousPage.current === group.page) return
    previousPage.current = group.page
    heading.current?.closest('.sheet-content')?.scrollTo({ top: 0 })
    heading.current?.focus({ preventScroll: true })
  }, [group.page])
  const start = group.page * STOP_GROUP_PAGE_SIZE
  const page = records.slice(start, start + STOP_GROUP_PAGE_SIZE)
  const pages = Math.max(1, Math.ceil(records.length / STOP_GROUP_PAGE_SIZE))
  return <div className="stop-group-details">
    <h3 ref={heading} tabIndex={-1}>Registros de paradas</h3>
    <p className="demo-note">Lista alfabética. Varios registros pueden compartir una ubicación.</p>
    {!records.length && <p role="status">Este grupo ya no está disponible. Limpia la selección para seguir explorando.</p>}
    <ul className="stop-list stop-list--unordered">{page.map((stop) => <li key={stop.properties.id}>
      <button type="button" onClick={() => onStop(stop.properties.id)}>
        <span className="stop-group-record"><span>{stop.properties.name}</span><small>{labels.get(stop.properties.id)?.map((name) => `Ruta ${name}`).join(' · ') || 'Sin ruta asociada en los datos'}</small></span>
        <span aria-hidden="true">→</span>
      </button>
    </li>)}</ul>
    <p role="status" className="muted">{records.length ? `${start + 1}–${Math.min(start + STOP_GROUP_PAGE_SIZE, records.length)} de ${records.length} registros` : '0 registros'}</p>
    {pages > 1 && <nav className="group-pagination" aria-label="Páginas de paradas">
      <button type="button" disabled={group.page === 0} onClick={() => onPage(group.page - 1)}>Anterior</button>
      <span>Página {group.page + 1} de {pages}</span>
      <button type="button" disabled={group.page >= pages - 1} onClick={() => onPage(group.page + 1)}>Siguiente</button>
    </nav>}
  </div>
}
