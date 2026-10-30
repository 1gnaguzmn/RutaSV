import type { Provenance } from '../../types/transit'

export function SourceDetails({ data }: { data: Provenance }) {
  const url = data.source.split(' · ')[0]
  const edition = data.source_updated_at && new Intl.DateTimeFormat('es-SV', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(data.source_updated_at))
  return <div className="provenance">
    <strong>Procedencia de los datos</strong>
    <p>{data.source_label ?? data.source}</p>
    {edition && <p>Edición declarada: {edition}</p>}
    {data.source_snapshot && <p>Instantánea: {data.source_snapshot}</p>}
    {url.startsWith('https://') && <p><a href={url} target="_blank" rel="noopener noreferrer">Ver fuente de datos</a></p>}
    <p>{data.verified_at ? `Verificación: ${data.verified_at}` : 'Sin verificación de campo.'}</p>
  </div>
}
