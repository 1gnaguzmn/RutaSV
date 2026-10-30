import { useEffect } from 'react'
import type { FilterSpecification, Map, MapLayerMouseEvent } from 'maplibre-gl'
import type { TransitData } from '../../types/transit'
import { getRouteStops } from '../../features/routes/routeData'
import { STOP_HIT_RADIUS, STOP_ICON_MIN_ZOOM } from './layerStyles'
import { createStopIcon, SELECTED_STOP_ICON, STOP_ICON, STOP_ICON_PIXEL_RATIO } from './stopIcon'

interface Props { map: Map; data: TransitData; routeId: string | null; selectedId: string | null; onSelect: (id: string) => void }
export function StopLayer({ map, data, routeId, selectedId, onSelect }: Props) {
  useEffect(() => {
    const tokens = getComputedStyle(document.documentElement)
    const primary = tokens.getPropertyValue('--color-primary').trim()
    const surface = tokens.getPropertyValue('--color-surface').trim()
    map.addSource('stops', { type: 'geojson', data: data.stops })
    map.addLayer({ id: 'stops-point', type: 'circle', source: 'stops', paint: {
      'circle-radius': 3.5, 'circle-color': surface,
      'circle-stroke-color': primary, 'circle-stroke-width': 2,
    } })
    const ownedImages: string[] = []
    // La generación es local y síncrona; cualquier fallo conserva los círculos y sus clics.
    try {
      for (const [id, selected] of [[STOP_ICON, false], [SELECTED_STOP_ICON, true]] as const) {
        if (map.hasImage(id)) continue
        const image = createStopIcon(surface, primary, selected)
        if (!image) continue
        map.addImage(id, image, { pixelRatio: STOP_ICON_PIXEL_RATIO })
        ownedImages.push(id)
      }
    } catch {
      // Canvas 2D puede no estar disponible aunque WebGL sí lo esté.
    }
    if (map.hasImage(STOP_ICON) && map.hasImage(SELECTED_STOP_ICON)) {
      map.addLayer({ id: 'stops-icon', type: 'symbol', source: 'stops', minzoom: STOP_ICON_MIN_ZOOM,
        layout: { 'icon-image': STOP_ICON, 'icon-size': 1, 'icon-padding': 4,
          'icon-allow-overlap': false, 'icon-ignore-placement': false },
      })
      map.addLayer({ id: 'stop-selected-icon', type: 'symbol', source: 'stops', minzoom: STOP_ICON_MIN_ZOOM,
        filter: ['==', ['get', 'id'], ''],
        layout: { 'icon-image': SELECTED_STOP_ICON, 'icon-size': 1.15, 'icon-padding': 4,
          'icon-allow-overlap': true, 'icon-ignore-placement': false },
      })
    }
    map.addLayer({ id: 'stops-hit', type: 'circle', source: 'stops', paint: { 'circle-radius': STOP_HIT_RADIUS, 'circle-opacity': 0 } })
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
      for (const id of ['stops-hit', 'stop-selected-icon', 'stops-icon', 'stops-point']) if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource('stops')) map.removeSource('stops')
      if (map.getStyle()) for (const id of ownedImages) if (map.hasImage(id)) map.removeImage(id)
    }
  }, [map, data, onSelect])
  useEffect(() => {
    const route = data.routes.features.find((item) => item.properties.id === routeId)
    const stopIds = route ? getRouteStops(route, data.stops.features).map((stop) => stop.properties.id) : []
    const filter: FilterSpecification | null = route ? ['in', ['get', 'id'], ['literal', stopIds]] : null
    for (const id of ['stops-hit', 'stops-point']) {
      if (!map.getLayer(id)) continue
      map.setLayerZoomRange(id, route ? 0 : 11, 24)
      map.setFilter(id, filter)
    }
    if (map.getLayer('stops-icon')) map.setFilter('stops-icon', ['all', ...(filter ? [filter] : []), ['!=', ['get', 'id'], selectedId ?? '']])
    if (map.getLayer('stop-selected-icon')) map.setFilter('stop-selected-icon', ['all', ...(filter ? [filter] : []), ['==', ['get', 'id'], selectedId ?? '']])
    if (map.getLayer('stops-point')) {
      map.setPaintProperty('stops-point', 'circle-radius', ['case', ['==', ['get', 'id'], selectedId ?? ''], 9, 3.5])
      map.setPaintProperty('stops-point', 'circle-stroke-width', ['case', ['==', ['get', 'id'], selectedId ?? ''], 4, 2])
    }
  }, [map, data, routeId, selectedId, onSelect])
  return null
}
