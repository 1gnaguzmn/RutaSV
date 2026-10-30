import { useEffect, useLayoutEffect, useRef } from 'react'
import type { GeoJSONSource, Map, MapLayerMouseEvent } from 'maplibre-gl'
import type { MapInsets, TransitData } from '../../types/transit'
import { contextStops } from '../../features/stops/stopGroups'
import { STOP_CLUSTER_OPTIONS, STOP_HIT_RADIUS, STOP_ICON_MIN_ZOOM, STOP_MIN_ZOOM, routeLabelFont } from './layerStyles'
import { createStopIcon, SELECTED_STOP_ICON, STOP_ICON, STOP_ICON_PIXEL_RATIO } from './stopIcon'
import { ClusterInteraction } from './clusterInteraction'

const EXPLORE_LAYERS = ['explore-stops-point', 'explore-stops-icon', 'explore-stops-hit', 'explore-clusters', 'explore-cluster-count', 'explore-clusters-hit']
const CONTEXT_LAYERS = ['stops-point', 'stops-icon', 'stop-selected-icon', 'stops-hit']

interface Props {
  map: Map; data: TransitData; routeId: string | null; selectedId: string | null
  interactionRevision: number; insets: MapInsets
  onSelect: (id: string) => void; onGroup: (ids: string[]) => void
  onError: (retry: (() => void) | null) => void
}

export function StopLayer({ map, data, routeId, selectedId, interactionRevision, insets, onSelect, onGroup, onError }: Props) {
  const interaction = useRef(new ClusterInteraction())
  const context = useRef({ interactionRevision, insets })
  useLayoutEffect(() => { context.current = { interactionRevision, insets } }, [interactionRevision, insets])
  useLayoutEffect(() => { interaction.current.invalidate() }, [map, data, interactionRevision])
  useEffect(() => {
    let alive = true
    const controller = interaction.current
    const tokens = getComputedStyle(document.documentElement)
    const token = (name: string) => tokens.getPropertyValue(name).trim()
    const primary = tokens.getPropertyValue('--color-primary').trim()
    const surface = tokens.getPropertyValue('--color-surface').trim()
    map.addSource('explore-stops', { type: 'geojson', data: data.stops, ...STOP_CLUSTER_OPTIONS })
    map.addSource('stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
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
    const iconsReady = map.hasImage(STOP_ICON) && map.hasImage(SELECTED_STOP_ICON)
    const pointPaint = { 'circle-radius': 3.5, 'circle-color': surface, 'circle-stroke-color': primary, 'circle-stroke-width': 2 }
    map.addLayer({ id: 'explore-stops-point', type: 'circle', source: 'explore-stops', minzoom: STOP_MIN_ZOOM,
      filter: ['!', ['has', 'point_count']], layout: { visibility: 'none' }, paint: pointPaint })
    if (iconsReady) map.addLayer({ id: 'explore-stops-icon', type: 'symbol', source: 'explore-stops', minzoom: STOP_ICON_MIN_ZOOM,
      filter: ['!', ['has', 'point_count']], layout: { visibility: 'none', 'icon-image': STOP_ICON, 'icon-size': 1,
        'icon-padding': 4, 'icon-allow-overlap': false, 'icon-ignore-placement': false } })
    map.addLayer({ id: 'explore-stops-hit', type: 'circle', source: 'explore-stops', minzoom: STOP_MIN_ZOOM,
      filter: ['!', ['has', 'point_count']], layout: { visibility: 'none' },
      paint: { 'circle-radius': STOP_HIT_RADIUS, 'circle-opacity': 0 } })
    map.addLayer({ id: 'explore-clusters', type: 'circle', source: 'explore-stops', minzoom: STOP_MIN_ZOOM, maxzoom: STOP_ICON_MIN_ZOOM,
      filter: ['has', 'point_count'], layout: { visibility: 'none' }, paint: {
        'circle-radius': 18, 'circle-color': token('--color-primary-soft'), 'circle-stroke-color': primary, 'circle-stroke-width': 1.5 } })
    map.addLayer({ id: 'explore-cluster-count', type: 'symbol', source: 'explore-stops', minzoom: STOP_MIN_ZOOM, maxzoom: STOP_ICON_MIN_ZOOM,
      filter: ['has', 'point_count'], layout: { visibility: 'none', 'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 14, 'text-font': routeLabelFont(map.getStyle()), 'text-allow-overlap': true },
      paint: { 'text-color': token('--color-primary-dark') } })
    map.addLayer({ id: 'explore-clusters-hit', type: 'circle', source: 'explore-stops', minzoom: STOP_MIN_ZOOM, maxzoom: STOP_ICON_MIN_ZOOM,
      filter: ['has', 'point_count'], layout: { visibility: 'none' }, paint: { 'circle-radius': STOP_HIT_RADIUS, 'circle-opacity': 0 } })
    map.addLayer({ id: 'stops-point', type: 'circle', source: 'stops', layout: { visibility: 'none' }, paint: pointPaint })
    if (iconsReady) {
      map.addLayer({ id: 'stops-icon', type: 'symbol', source: 'stops', minzoom: STOP_ICON_MIN_ZOOM,
        layout: { visibility: 'none', 'icon-image': STOP_ICON, 'icon-size': 1, 'icon-padding': 4,
          'icon-allow-overlap': false, 'icon-ignore-placement': false },
      })
      map.addLayer({ id: 'stop-selected-icon', type: 'symbol', source: 'stops', minzoom: STOP_ICON_MIN_ZOOM,
        filter: ['==', ['get', 'id'], ''],
        layout: { visibility: 'none', 'icon-image': SELECTED_STOP_ICON, 'icon-size': 1.15, 'icon-padding': 4,
          'icon-allow-overlap': true, 'icon-ignore-placement': false },
      })
    }
    map.addLayer({ id: 'stops-hit', type: 'circle', source: 'stops', layout: { visibility: 'none' }, paint: { 'circle-radius': STOP_HIT_RADIUS, 'circle-opacity': 0 } })
    const knownStopIds = new Set(data.stops.features.map((stop) => stop.properties.id))
    const interactiveLayers = ['explore-clusters-hit', 'explore-stops-hit', 'stops-hit']
    const select = (event: MapLayerMouseEvent) => {
      const first = event.features?.[0]
      if (first?.layer.id === 'explore-clusters-hit' && first.geometry.type === 'Point') {
        const clusterId: unknown = first.properties.cluster_id
        const pointCount: unknown = first.properties.point_count
        if (typeof clusterId !== 'number' || typeof pointCount !== 'number') return
        const coordinates: [number, number] = [first.geometry.coordinates[0], first.geometry.coordinates[1]]
        const revision = context.current.interactionRevision
        const request = {
          source: map.getSource('explore-stops') as GeoJSONSource,
          clusterId, pointCount, knownStopIds,
          onExpand: (zoom: number) => map.easeTo({ center: coordinates, zoom, padding: context.current.insets,
            duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200 }),
          onGroup,
          onError: () => onError(retry),
        }
        function retry(): void {
          if (!alive || revision !== context.current.interactionRevision) return
          onError(null)
          void controller.open(request)
        }
        retry()
        return
      }
      const ids = [...new Set((event.features ?? []).map((feature) => feature.properties.id as unknown)
        .filter((id): id is string => typeof id === 'string' && knownStopIds.has(id)))]
      if (ids.length > 1) onGroup(ids)
      else if (ids.length === 1) onSelect(ids[0])
    }
    const enter = () => { map.getCanvas().style.cursor = 'pointer' }
    const leave = () => { map.getCanvas().style.cursor = '' }
    map.on('click', interactiveLayers, select)
    map.on('mouseenter', interactiveLayers, enter)
    map.on('mouseleave', interactiveLayers, leave)
    return () => {
      alive = false
      controller.invalidate()
      map.off('click', interactiveLayers, select)
      map.off('mouseenter', interactiveLayers, enter)
      map.off('mouseleave', interactiveLayers, leave)
      for (const id of [...CONTEXT_LAYERS, ...EXPLORE_LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource('stops')) map.removeSource('stops')
      if (map.getSource('explore-stops')) map.removeSource('explore-stops')
      if (map.getStyle()) for (const id of ownedImages) if (map.hasImage(id)) map.removeImage(id)
    }
  }, [map, data, onSelect, onGroup, onError])
  useEffect(() => {
    const stops = contextStops(data.routes.features, data.stops.features, routeId, selectedId)
    const stopIds = stops.map((stop) => stop.properties.id)
    const source = map.getSource('stops') as GeoJSONSource | undefined
    source?.setData({ type: 'FeatureCollection', features: stops })
    for (const id of EXPLORE_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', routeId ? 'none' : 'visible')
    for (const id of CONTEXT_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', routeId || selectedId ? 'visible' : 'none')
    for (const id of ['stops-hit', 'stops-point']) {
      if (!map.getLayer(id)) continue
      map.setLayerZoomRange(id, routeId ? 0 : STOP_MIN_ZOOM, 24)
      map.setFilter(id, ['in', ['get', 'id'], ['literal', stopIds]])
    }
    for (const id of ['explore-stops-point', 'explore-stops-icon', 'explore-stops-hit']) if (map.getLayer(id)) {
      map.setFilter(id, ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'id'], selectedId ?? '']])
    }
    if (map.getLayer('stops-icon')) map.setFilter('stops-icon', ['!=', ['get', 'id'], selectedId ?? ''])
    if (map.getLayer('stop-selected-icon')) map.setFilter('stop-selected-icon', ['==', ['get', 'id'], selectedId ?? ''])
    if (map.getLayer('stops-point')) {
      map.setPaintProperty('stops-point', 'circle-radius', ['case', ['==', ['get', 'id'], selectedId ?? ''], 9, 3.5])
      map.setPaintProperty('stops-point', 'circle-stroke-width', ['case', ['==', ['get', 'id'], selectedId ?? ''], 4, 2])
    }
  }, [map, data, routeId, selectedId, onSelect, onGroup, onError])
  return null
}
