import { useEffect } from 'react'
import type { Map, MapLayerMouseEvent, SymbolLayerSpecification } from 'maplibre-gl'
import type { TransitData } from '../../types/transit'
import { ROUTE_LABEL_MIN_ZOOM, routeColorExpression, routeLabelFont } from './layerStyles'

interface Props { map: Map; data: TransitData; selectedId: string | null; onSelect: (id: string) => void }
export function RouteLayer({ map, data, selectedId, onSelect }: Props) {
  useEffect(() => {
    const tokens = getComputedStyle(document.documentElement)
    const token = (name: string) => tokens.getPropertyValue(name).trim()
    const colors = routeColorExpression(data.routes.features, token)
    map.addSource('routes', { type: 'geojson', data: data.routes })
    map.addLayer({ id: 'routes-line', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: {
      'line-color': colors,
      'line-width': 4, 'line-opacity': .8,
    } })
    map.addLayer({ id: 'routes-hit', type: 'line', source: 'routes', paint: { 'line-width': 22, 'line-opacity': 0 } })
    map.addLayer({ id: 'route-selected-outline', type: 'line', source: 'routes', filter: ['==', ['get', 'id'], ''], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': tokens.getPropertyValue('--color-surface').trim(), 'line-width': 10 } })
    map.addLayer({ id: 'route-selected', type: 'line', source: 'routes', filter: ['==', ['get', 'id'], ''], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': tokens.getPropertyValue('--color-primary').trim(), 'line-width': 6 } })
    const labelLayout: SymbolLayerSpecification['layout'] = {
      'symbol-placement': 'line', 'symbol-spacing': 300,
      'text-field': ['get', 'short_name'], 'text-font': routeLabelFont(map.getStyle()),
      'text-size': ['interpolate', ['linear'], ['zoom'], 12, 12, 16, 14],
      'text-padding': 6, 'text-allow-overlap': false, 'text-ignore-placement': false,
      'text-keep-upright': true,
    }
    map.addLayer({ id: 'routes-label', type: 'symbol', source: 'routes', minzoom: ROUTE_LABEL_MIN_ZOOM,
      layout: labelLayout, paint: { 'text-color': colors, 'text-halo-color': token('--color-surface'), 'text-halo-width': 2 },
    })
    map.addLayer({ id: 'route-selected-label', type: 'symbol', source: 'routes', minzoom: ROUTE_LABEL_MIN_ZOOM,
      filter: ['==', ['get', 'id'], ''],
      layout: { ...labelLayout, 'text-field': ['concat', ['get', 'short_name'],
        ['case', ['has', 'recorrido_code'], ['concat', ' · ', ['get', 'recorrido_code']], '']] },
      paint: { 'text-color': token('--color-primary'), 'text-halo-color': token('--color-surface'), 'text-halo-width': 2 },
    })
    const interactiveLayers = ['routes-hit', 'routes-label', 'route-selected-label']
    const select = (event: MapLayerMouseEvent) => {
      // Las paradas tienen prioridad cuando sus áreas táctiles coinciden con una línea.
      if (map.getLayer('stops-hit') && map.queryRenderedFeatures(event.point, { layers: ['stops-hit'] }).length) return
      const id: unknown = event.features?.[0]?.properties?.id
      if (typeof id === 'string') onSelect(id)
    }
    const enter = () => { map.getCanvas().style.cursor = 'pointer' }
    const leave = () => { map.getCanvas().style.cursor = '' }
    map.on('click', interactiveLayers, select)
    map.on('mouseenter', interactiveLayers, enter)
    map.on('mouseleave', interactiveLayers, leave)
    return () => {
      map.off('click', interactiveLayers, select)
      map.off('mouseenter', interactiveLayers, enter)
      map.off('mouseleave', interactiveLayers, leave)
      for (const id of ['route-selected-label', 'routes-label', 'route-selected', 'route-selected-outline', 'routes-hit', 'routes-line']) {
        if (map.getLayer(id)) map.removeLayer(id)
      }
      if (map.getSource('routes')) map.removeSource('routes')
    }
  }, [map, data, onSelect])
  useEffect(() => {
    for (const id of ['route-selected', 'route-selected-outline', 'route-selected-label']) {
      if (map.getLayer(id)) map.setFilter(id, ['==', ['get', 'id'], selectedId ?? ''])
    }
    if (map.getLayer('routes-label')) map.setFilter('routes-label', ['!=', ['get', 'id'], selectedId ?? ''])
  }, [map, data, selectedId, onSelect])
  return null
}
