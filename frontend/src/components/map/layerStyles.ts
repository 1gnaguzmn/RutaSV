import type { StyleSpecification } from 'maplibre-gl'

export const ROUTE_LABEL_MIN_ZOOM = 12
export const STOP_ICON_MIN_ZOOM = 15
export const STOP_HIT_RADIUS = 22
export const STOP_MIN_ZOOM = 11
export const STOP_CLUSTER_MAX_ZOOM = 14
export const STOP_CLUSTER_OPTIONS = { cluster: true, clusterRadius: 50, clusterMinPoints: 2, clusterMaxZoom: STOP_CLUSTER_MAX_ZOOM } as const
export const MAP_INITIAL_CENTER: [number, number] = [-89.19, 13.70]
export const MAP_INITIAL_ZOOM = 12

export function routeLabelFont(style: StyleSpecification): string[] {
  // El endpoint de glyphs de Liberty ya sirve estas fuentes; no añadir otro proveedor.
  const fonts = style.layers.flatMap((layer) => {
    const value = layer.type === 'symbol' ? layer.layout?.['text-font'] : undefined
    return Array.isArray(value) && value.length > 0 && value.every((font) => typeof font === 'string') ? [value as string[]] : []
  })
  return fonts.find((stack) => stack.some((font) => /regular/i.test(font))) ?? fonts[0] ?? ['Noto Sans Regular']
}
