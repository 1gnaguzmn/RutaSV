import type { Map } from 'maplibre-gl'
import { Icon } from '../ui/Icon'

interface Props { map: Map | null; onFrame: () => void; onLocate: () => void; locating: boolean }
export function MapControls({ map, onFrame, onLocate, locating }: Props) {
  return <div className="map-controls" role="group" aria-label="Controles del mapa">
    <button className="icon-button" type="button" aria-label="Acercar mapa" disabled={!map} onClick={() => map?.zoomIn({ duration: 0 })}><Icon name="plus" /></button>
    <button className="icon-button" type="button" aria-label="Alejar mapa" disabled={!map} onClick={() => map?.zoomOut({ duration: 0 })}><Icon name="minus" /></button>
    <button className="icon-button" type="button" aria-label="Encuadrar recorrido o rutas disponibles" disabled={!map} onClick={onFrame}><Icon name="frame" /></button>
    <button className="icon-button" type="button" aria-label="Mostrar mi ubicación" disabled={!map || locating} aria-busy={locating} onClick={onLocate}><Icon name="locate" /></button>
  </div>
}
