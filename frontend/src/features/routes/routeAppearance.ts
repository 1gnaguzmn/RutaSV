import type { RouteProperties } from '../../types/transit.ts'

export interface RouteAppearance {
  key: string
  colorToken: string
}

const routeAppearances = new Map<string, RouteAppearance>([
  ['AB008A0SS', { key: '8a', colorToken: '--color-route-8a' }],
  ['MB030A0', { key: '30a', colorToken: '--color-route-30a' }],
  ['AB029G0', { key: '29g', colorToken: '--color-route-29g' }],
  ['AB101A2E', { key: '101a', colorToken: '--color-route-101a' }],
  ['MB044X0', { key: '44', colorToken: '--color-route-44' }],
  ['AB002C0', { key: '2c', colorToken: '--color-route-2c' }],
])

const legacyAppearances: Record<RouteProperties['color_key'], RouteAppearance> = {
  a: { key: 'a', colorToken: '--color-route-a' },
  b: { key: 'b', colorToken: '--color-route-b' },
}

export function getRouteAppearance(properties: Pick<RouteProperties, 'source_route_code' | 'color_key'>): RouteAppearance {
  return routeAppearances.get(properties.source_route_code ?? '') ?? legacyAppearances[properties.color_key]
}
