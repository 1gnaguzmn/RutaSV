import type { Route, RouteGroup, Stop } from '../../types/transit.ts'

export function groupRoutes(routes: Route[]): RouteGroup[] {
  const groups = new Map<string, RouteGroup>()
  for (const route of routes) {
    const id = route.properties.route_id
    if (!groups.has(id)) groups.set(id, { id, variants: [] })
    groups.get(id)!.variants.push(route)
  }
  return [...groups.values()].map((group) => ({ ...group, variants: group.variants.sort((a, b) =>
    (a.properties.recorrido_code ?? a.properties.direction).localeCompare(b.properties.recorrido_code ?? b.properties.direction, 'es')) }))
}

export function getRouteStops(route: Route, stops: Stop[]): Stop[] {
  if (route.properties.stop_sequence_status === 'pending') {
    return stops.filter((stop) => stop.properties.shape_id === route.properties.id)
      .sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'es') || a.properties.id.localeCompare(b.properties.id))
  }
  const byId = new Map(stops.map((stop) => [stop.properties.id, stop]))
  return route.properties.stop_ids.flatMap((id) => {
    const stop = byId.get(id)
    return stop ? [stop] : []
  })
}

export function getGroupStops(group: RouteGroup, stops: Stop[]): Stop[] {
  return [...new Map(group.variants.flatMap((route) => getRouteStops(route, stops)).map((stop) => [stop.properties.id, stop])).values()]
}

export function getInitialRoute(routes: Route[]): Route | undefined {
  return routes.find((route) => route.properties.recorrido_code === '01') ?? routes[0]
}
