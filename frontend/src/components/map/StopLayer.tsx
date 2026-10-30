import { useEffect } from 'react'
import type { Map, MapLayerMouseEvent } from 'maplibre-gl'
import type { TransitData } from '../../types/transit'
import { getRouteStops } from '../../features/routes/routeData'

interface Props { map: Map; data: TransitData; routeId: string | null; selectedId: string | null; onSelect: (id: string) => void }
export function StopLayer({ map, data, routeId, selectedId, onSelect }: Props) {
  useEffect(() => {
    const tokens = getComputedStyle(document.documentElement)
    map.addSource('stops', { type: 'geojson', data: data.stops })
    map.addLayer({ id: 'stops-point', type: 'circle', source: 'stops', paint: {
      'circle-radius': ['case', ['==', ['get', 'id'], ''], 9, 6],
      'circle-color': tokens.getPropertyValue('--color-surface').trim(),
      'circle-stroke-color': tokens.getPropertyValue('--color-primary').trim(), 'circle-stroke-width': 3,
    } })
    map.addLayer({ id: 'stops-hit', type: 'circle', source: 'stops', paint: { 'circle-radius': 22, 'circle-opacity': 0 } })
    const select = (event: MapLayerMouseEvent) => {
      const id: unknown = event.features?.[0]?.properties?.id
      if (typeof id === 'string') onSelect(id)
    }
    const enter = () => { map.getCanvas().style.cursor = 'pointer' }
    const leave = () => { map.getCanvas().style.cursor = '' }
    map.on('click', 'stops-hit', select)
    map.on('mouseenter', 'stops-hit', enter)
    map.on('mouseleave', 'stops-hit', leave)
    return () => {
      map.off('click', 'stops-hit', select)
      map.off('mouseenter', 'stops-hit', enter)
      map.off('mouseleave', 'stops-hit', leave)
      for (const id of ['stops-hit', 'stops-point']) if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource('stops')) map.removeSource('stops')
    }
  }, [map, data, onSelect])
  useEffect(() => {
    const route = data.routes.features.find((item) => item.properties.id === routeId)
    const stopIds = route ? getRouteStops(route, data.stops.features).map((stop) => stop.properties.id) : []
    for (const id of ['stops-hit', 'stops-point']) {
      if (!map.getLayer(id)) continue
      map.setLayerZoomRange(id, route ? 0 : 11, 24)
      map.setFilter(id, route ? ['in', ['get', 'id'], ['literal', stopIds]] : null)
    }
    if (map.getLayer('stops-point')) {
      map.setPaintProperty('stops-point', 'circle-radius', ['case', ['==', ['get', 'id'], selectedId ?? ''], 10, 6])
      map.setPaintProperty('stops-point', 'circle-stroke-width', ['case', ['==', ['get', 'id'], selectedId ?? ''], 5, 3])
    }
  }, [map, data, routeId, selectedId, onSelect])
  return null
}
