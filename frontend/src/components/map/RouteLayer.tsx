import { useEffect } from 'react'
import type { Map, MapLayerMouseEvent } from 'maplibre-gl'
import type { TransitData } from '../../types/transit'

interface Props { map: Map; data: TransitData; selectedId: string | null; onSelect: (id: string) => void }
export function RouteLayer({ map, data, selectedId, onSelect }: Props) {
  useEffect(() => {
    const tokens = getComputedStyle(document.documentElement)
    map.addSource('routes', { type: 'geojson', data: data.routes })
    map.addLayer({ id: 'routes-line', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: {
      'line-color': ['match', ['get', 'color_key'], 'b', tokens.getPropertyValue('--color-route-b').trim(), tokens.getPropertyValue('--color-route-a').trim()],
      'line-width': 4, 'line-opacity': .8,
    } })
    map.addLayer({ id: 'routes-hit', type: 'line', source: 'routes', paint: { 'line-width': 22, 'line-opacity': 0 } })
    map.addLayer({ id: 'route-selected-outline', type: 'line', source: 'routes', filter: ['==', ['get', 'id'], ''], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': tokens.getPropertyValue('--color-surface').trim(), 'line-width': 10 } })
    map.addLayer({ id: 'route-selected', type: 'line', source: 'routes', filter: ['==', ['get', 'id'], ''], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': tokens.getPropertyValue('--color-primary').trim(), 'line-width': 6 } })
    const select = (event: MapLayerMouseEvent) => {
      // Las paradas tienen prioridad cuando sus áreas táctiles coinciden con una línea.
      if (map.getLayer('stops-hit') && map.queryRenderedFeatures(event.point, { layers: ['stops-hit'] }).length) return
      const id: unknown = event.features?.[0]?.properties?.id
      if (typeof id === 'string') onSelect(id)
    }
    const enter = () => { map.getCanvas().style.cursor = 'pointer' }
    const leave = () => { map.getCanvas().style.cursor = '' }
    map.on('click', 'routes-hit', select)
    map.on('mouseenter', 'routes-hit', enter)
    map.on('mouseleave', 'routes-hit', leave)
    return () => {
      map.off('click', 'routes-hit', select)
      map.off('mouseenter', 'routes-hit', enter)
      map.off('mouseleave', 'routes-hit', leave)
      for (const id of ['route-selected', 'route-selected-outline', 'routes-hit', 'routes-line']) {
        if (map.getLayer(id)) map.removeLayer(id)
      }
      if (map.getSource('routes')) map.removeSource('routes')
    }
  }, [map, data, onSelect])
  useEffect(() => {
    for (const id of ['route-selected', 'route-selected-outline']) {
      if (map.getLayer(id)) map.setFilter(id, ['==', ['get', 'id'], selectedId ?? ''])
    }
  }, [map, data, selectedId, onSelect])
  return null
}
