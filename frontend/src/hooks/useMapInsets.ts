import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { MapInsets } from '../types/transit'

export function useDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  useLayoutEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const update = () => setDesktop(media.matches)
    media.addEventListener('change', update)
    update()
    return () => media.removeEventListener('change', update)
  }, [])
  return desktop
}

export function useMapInsets(mapRef: RefObject<HTMLElement | null>, overlayRef: RefObject<HTMLDivElement | null>, panelRef: RefObject<HTMLElement | null>, desktop: boolean, expanded: boolean) {
  const [insets, setInsets] = useState<MapInsets>({ top: 150, bottom: 120, left: 24, right: 24 })
  useLayoutEffect(() => {
    const map = mapRef.current
    const overlay = overlayRef.current
    const panel = panelRef.current
    if (!map || !overlay || !panel) return
    const measure = () => {
      const bounds = map.getBoundingClientRect()
      const top = Math.max(16, overlay.getBoundingClientRect().bottom - bounds.top + 16)
      const bottom = desktop ? 16 : Math.max(16, bounds.bottom - panel.getBoundingClientRect().top + 8)
      map.style.setProperty('--map-top', `${top}px`)
      map.style.setProperty('--map-bottom', `${bottom}px`)
      const controls = map.querySelector('.map-controls')?.getBoundingClientRect()
      const attribution = map.querySelector('.maplibregl-ctrl-attrib')?.getBoundingClientRect()
      const overlayBottom = overlay.getBoundingClientRect().bottom
      let cameraBottom = attribution && attribution.top >= overlayBottom
        ? Math.max(bottom + 24, bounds.bottom - attribution.top + 16) : bottom + 24
      // Con el panel móvil abierto conviene usar el espacio a la izquierda de los controles.
      const useSideSpace = expanded && !desktop && controls && controls.top >= overlayBottom
      const right = useSideSpace
        ? Math.max(24, bounds.right - controls.left + 16) : 24
      if (!useSideSpace && controls && controls.top >= overlayBottom) {
        cameraBottom = Math.max(cameraBottom, bounds.bottom - controls.top + 16)
      }
      const next = { top, bottom: Math.min(cameraBottom, Math.max(16, bounds.height - top - 32)), left: 24, right }
      setInsets((previous) => Object.keys(next).every((key) => next[key as keyof MapInsets] === previous[key as keyof MapInsets]) ? previous : next)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(map)
    observer.observe(overlay)
    observer.observe(panel)
    const attribution = map.querySelector('.maplibregl-ctrl-attrib')
    if (attribution) observer.observe(attribution)
    // MapLibre agrega la atribución de forma asíncrona al inicializar o reintentar.
    const mutations = new MutationObserver(() => {
      const current = map.querySelector('.maplibregl-ctrl-attrib')
      if (current) observer.observe(current)
      measure()
    })
    mutations.observe(map, { childList: true, subtree: true })
    measure()
    return () => { observer.disconnect(); mutations.disconnect() }
  }, [mapRef, overlayRef, panelRef, desktop, expanded])
  return insets
}
