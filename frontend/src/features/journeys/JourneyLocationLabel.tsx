import { Icon } from '../../components/ui/Icon'

export function JourneyLocationLabel({ kind }: { kind: 'origin' | 'destination' }) {
  return <span className={`journey-location-label journey-location-${kind}`}><Icon name="pin" /><span>{kind === 'origin' ? 'A · Inicio de ejemplo' : 'B · Destino de ejemplo'}</span></span>
}
