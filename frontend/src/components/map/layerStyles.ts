import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import type { Route } from '../../types/transit.ts'
import { getRouteAppearance } from '../../features/routes/routeAppearance.ts'

export const ROUTE_LABEL_MIN_ZOOM = 12
export const STOP_ICON_MIN_ZOOM = 15
export const STOP_HIT_RADIUS = 22

export function routeColorExpression(routes: Route[], token: (name: string) => string): ExpressionSpecification | string {
  const groups = new Map(routes.map((route) => [route.properties.route_id, getRouteAppearance(route.properties)]))
  if (!groups.size) return token('--color-route-a')
  const [first, ...rest] = [...groups]
  return ['match', ['get', 'route_id'], first[0], token(first[1].colorToken),
    ...rest.flatMap(([id, appearance]) => [id, token(appearance.colorToken)]),
    token('--color-route-a')]
}

export function routeLabelFont(style: StyleSpecification): string[] {
  // El endpoint de glyphs de Liberty ya sirve estas fuentes; no añadir otro proveedor.
  const fonts = style.layers.flatMap((layer) => {
    const value = layer.type === 'symbol' ? layer.layout?.['text-font'] : undefined
    return Array.isArray(value) && value.length > 0 && value.every((font) => typeof font === 'string') ? [value as string[]] : []
  })
  return fonts.find((stack) => stack.some((font) => /regular/i.test(font))) ?? fonts[0] ?? ['Noto Sans Regular']
}
