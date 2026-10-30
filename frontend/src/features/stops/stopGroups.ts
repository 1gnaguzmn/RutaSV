import type { Route, Stop } from '../../types/transit.ts'
import { getRouteStops } from '../routes/routeData.ts'

export const STOP_GROUP_PAGE_SIZE = 50

export function contextStops(routes: Route[], stops: Stop[], routeId: string | null, stopId: string | null): Stop[] {
  const route = routes.find((item) => item.properties.id === routeId)
  if (routeId) return route ? getRouteStops(route, stops) : []
  return stopId ? stops.filter((stop) => stop.properties.id === stopId) : []
}

export function sortGroupStops(stops: Stop[], ids: string[]): Stop[] {
  const wanted = new Set(ids)
  return stops.filter((stop) => wanted.has(stop.properties.id))
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'es') || a.properties.id.localeCompare(b.properties.id))
}

export function stopRouteLabels(routes: Route[], stops: Stop[]): Map<string, string[]> {
  const names = new Map<string, Set<string>>()
  for (const route of routes) for (const stop of getRouteStops(route, stops)) {
    const id = stop.properties.id
    if (!names.has(id)) names.set(id, new Set())
    names.get(id)!.add(route.properties.short_name)
  }
  return new Map([...names].map(([id, labels]) => [id, [...labels].sort((a, b) => a.localeCompare(b, 'es'))]))
}
