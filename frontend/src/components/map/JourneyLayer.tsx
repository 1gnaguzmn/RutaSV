import { useEffect } from 'react'
import type { FilterSpecification, GeoJSONSource, Map } from 'maplibre-gl'
import type { Itinerary } from '../../types/journey'
import { journeyGeoJSON } from '../../features/journeys/geometry'
import { routeLabelFont } from './layerStyles'
import { createJourneyPin, JOURNEY_DESTINATION_PIN, JOURNEY_ORIGIN_PIN, JOURNEY_PIN_PIXEL_RATIO } from './journeyPin'

export function JourneyLayer({ map, itinerary, activeLeg }: { map: Map; itinerary: Itinerary; activeLeg: number | null }) {
  useEffect(() => {
    const tokens = getComputedStyle(document.documentElement)
    const green = tokens.getPropertyValue('--color-primary').trim()
    const gray = tokens.getPropertyValue('--color-text-muted').trim()
    const white = tokens.getPropertyValue('--color-surface').trim()
    const originColor = tokens.getPropertyValue('--color-journey-origin').trim()
    const destinationColor = tokens.getPropertyValue('--color-journey-destination').trim()
    const endpointFilter: FilterSpecification = ['in', ['get', 'kind'], ['literal', ['origin', 'destination']]]
    const stopFilter: FilterSpecification = ['in', ['get', 'kind'], ['literal', ['boarding', 'transfer']]]
    const ownedImages: string[] = []
    try {
      for (const [id, color, letter] of [[JOURNEY_ORIGIN_PIN, originColor, 'A'], [JOURNEY_DESTINATION_PIN, destinationColor, 'B']] as const) {
        if (map.hasImage(id)) continue
        const image = createJourneyPin(color, white, letter)
        if (!image) continue
        map.addImage(id, image, { pixelRatio: JOURNEY_PIN_PIXEL_RATIO })
        ownedImages.push(id)
      }
    } catch {
      // Keep role colors and letters even when Canvas 2D images cannot be generated.
    }
    const pinsReady = map.hasImage(JOURNEY_ORIGIN_PIN) && map.hasImage(JOURNEY_DESTINATION_PIN)
    const empty = { type: 'FeatureCollection' as const, features: [] }
    map.addSource('journey-segments', { type: 'geojson', data: empty })
    map.addSource('journey-milestones', { type: 'geojson', data: empty })
    map.addLayer({ id: 'journey-outline', type: 'line', source: 'journey-segments', paint: { 'line-color': white, 'line-width': 9 } })
    map.addLayer({ id: 'journey-bus', type: 'line', source: 'journey-segments', filter: ['==', ['get', 'mode'], 'bus'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': green, 'line-width': 5 } })
    map.addLayer({ id: 'journey-walk', type: 'line', source: 'journey-segments', filter: ['==', ['get', 'mode'], 'walk'], paint: { 'line-color': gray, 'line-width': 4, 'line-dasharray': [2, 2] } })
    map.addLayer({ id: 'journey-points', type: 'circle', source: 'journey-milestones', filter: stopFilter, paint: { 'circle-radius': 10, 'circle-color': green, 'circle-stroke-color': white, 'circle-stroke-width': 3 } })
    map.addLayer({ id: 'journey-icons', type: 'symbol', source: 'journey-milestones', filter: stopFilter, layout: { 'text-field': ['match', ['get', 'kind'], 'boarding', '↑', '⇄'], 'text-font': routeLabelFont(map.getStyle()), 'text-size': 14, 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': white } })
    map.addLayer({ id: 'journey-labels', type: 'symbol', source: 'journey-milestones', filter: stopFilter, layout: { 'text-field': ['get', 'label'], 'text-font': routeLabelFont(map.getStyle()), 'text-size': 13, 'text-anchor': 'bottom', 'text-offset': [0, -1.2] }, paint: { 'text-color': green, 'text-halo-color': white, 'text-halo-width': 2 } })
    if (pinsReady) {
      map.addLayer({ id: 'journey-endpoint-pins', type: 'symbol', source: 'journey-milestones', filter: endpointFilter,
        layout: { 'icon-image': ['match', ['get', 'kind'], 'origin', JOURNEY_ORIGIN_PIN, JOURNEY_DESTINATION_PIN], 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true } })
    } else {
      map.addLayer({ id: 'journey-endpoint-fallback', type: 'circle', source: 'journey-milestones', filter: endpointFilter,
        paint: { 'circle-radius': 12, 'circle-color': ['case', ['==', ['get', 'kind'], 'destination'], destinationColor, originColor], 'circle-stroke-color': white, 'circle-stroke-width': 3 } })
      map.addLayer({ id: 'journey-endpoint-letters', type: 'symbol', source: 'journey-milestones', filter: endpointFilter,
        layout: { 'text-field': ['match', ['get', 'kind'], 'origin', 'A', 'B'], 'text-font': routeLabelFont(map.getStyle()), 'text-size': 14, 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': white } })
    }
    map.addLayer({ id: 'journey-endpoint-labels', type: 'symbol', source: 'journey-milestones', filter: endpointFilter,
      layout: { 'text-field': ['get', 'label'], 'text-font': routeLabelFont(map.getStyle()), 'text-size': 13, 'text-anchor': 'bottom', 'text-offset': [0, pinsReady ? -3.4 : -1.2] },
      paint: { 'text-color': ['case', ['==', ['get', 'kind'], 'destination'], destinationColor, originColor], 'text-halo-color': white, 'text-halo-width': 2 } })
    return () => {
      for (const id of ['journey-endpoint-labels', 'journey-endpoint-letters', 'journey-endpoint-fallback', 'journey-endpoint-pins', 'journey-labels', 'journey-icons', 'journey-points', 'journey-walk', 'journey-bus', 'journey-outline']) if (map.getLayer(id)) map.removeLayer(id)
      for (const id of ['journey-milestones', 'journey-segments']) if (map.getSource(id)) map.removeSource(id)
      if (map.getStyle()) for (const id of ownedImages) if (map.hasImage(id)) map.removeImage(id)
    }
  }, [map])
  useEffect(() => {
    const { segments, milestones } = journeyGeoJSON(itinerary)
    ;(map.getSource('journey-segments') as GeoJSONSource).setData(segments)
    ;(map.getSource('journey-milestones') as GeoJSONSource).setData(milestones)
  }, [map, itinerary])
  useEffect(() => {
    for (const id of ['journey-bus', 'journey-walk']) map.setPaintProperty(id, 'line-width', activeLeg === null ? (id === 'journey-bus' ? 5 : 4) : ['case', ['==', ['get', 'index'], activeLeg], 8, 4])
  }, [map, activeLeg])
  return null
}
