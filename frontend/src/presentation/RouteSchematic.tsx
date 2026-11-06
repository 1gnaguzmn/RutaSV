import type { Paso } from './demoData'

// Mapa esquemático (SVG) del recorrido. Funciona sin internet: no usa teselas
// ni coordenadas, solo los pasos definidos en demoData.ts.
interface Props {
  pasos: Paso[]
  origen: string
  destino: string
  mode?: 'normal' | 'aviso' | 'completado'
  /** Índice del paso afectado (solo en modo aviso). */
  pasoAfectado?: number
  alterna?: string
  cerrado?: string
}

const X0 = 26, X1 = 314, Y = 52

export function RouteSchematic({ pasos, origen, destino, mode = 'normal', pasoAfectado = -1, alterna = '', cerrado = '' }: Props) {
  const segments = pasos.map((paso, index) => ({ paso, index })).filter(({ paso }) => paso.tipo !== 'bajar')
  const xs = segments.map((_, i) => X0 + ((X1 - X0) * i) / segments.length).concat(X1)
  const affected = mode === 'aviso' ? segments.findIndex(({ index }) => index === pasoAfectado) : -1
  let busCount = 0
  const height = mode === 'aviso' ? 168 : 96
  const label = `Mapa esquemático: ${origen} a ${destino}${mode === 'aviso' ? `, tramo afectado y ruta alterna ${alterna}` : ''}`

  return <svg className="schematic" viewBox={`0 0 340 ${height}`} role="img" aria-label={label}>
    <text x={X0 - 8} y={20} className="sch-place" textAnchor="start">{origen}</text>
    <text x={X1 + 8} y={20} className="sch-place" textAnchor="end">{destino}</text>
    {segments.map(({ paso }, i) => {
      const bus = paso.tipo !== 'caminar'
      if (bus) busCount += 1
      const isAffected = i === affected
      const faded = affected >= 0 && i > affected
      const color = isAffected ? 'var(--p-danger)' : faded ? 'var(--p-faded)' : mode === 'completado' ? 'var(--color-primary)' : bus ? (busCount === 1 ? 'var(--color-primary)' : 'var(--color-route-b)') : 'var(--p-walk)'
      const mid = (xs[i] + xs[i + 1]) / 2
      const text = bus ? paso.etiquetaMapa ?? '' : `${paso.min ?? ''} min`
      return <g key={i}>
        <line x1={xs[i]} y1={Y} x2={xs[i + 1]} y2={Y} stroke="#fff" strokeWidth={bus ? 13 : 9} strokeLinecap="round" />
        <line x1={xs[i]} y1={Y} x2={xs[i + 1]} y2={Y} stroke={color} strokeWidth={bus ? 9 : 5} strokeLinecap="round" strokeDasharray={isAffected ? '10 8' : !bus ? '2 9' : undefined} />
        {isAffected && <g className="sch-closed" transform={`translate(${mid} ${Y})`}><circle r="11" fill="var(--p-danger)" stroke="#fff" strokeWidth="2.5" /><path d="M-4.5 -4.5 4.5 4.5M-4.5 4.5 4.5 -4.5" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" /></g>}
        <text x={mid} y={Y + 30} textAnchor="middle" className={isAffected ? 'sch-seg sch-seg-danger' : faded ? 'sch-seg sch-seg-faded' : 'sch-seg'}>{isAffected ? cerrado : text}</text>
      </g>
    })}
    {affected >= 0 && <g className="sch-alt">
      <path d={`M${xs[affected]} ${Y} C${xs[affected]} 130 ${xs[affected] + 10} 130 ${xs[affected] + 40} 130 L${X1 - 40} 130 C${X1 - 10} 130 ${X1} 130 ${X1} ${Y}`} fill="none" stroke="#fff" strokeWidth="15" strokeLinecap="round" />
      <path d={`M${xs[affected]} ${Y} C${xs[affected]} 130 ${xs[affected] + 10} 130 ${xs[affected] + 40} 130 L${X1 - 40} 130 C${X1 - 10} 130 ${X1} 130 ${X1} ${Y}`} fill="none" stroke="var(--color-primary)" strokeWidth="10" strokeLinecap="round" />
      <text x={(xs[affected] + X1) / 2} y={156} textAnchor="middle" className="sch-seg sch-seg-alt">{alterna}</text>
    </g>}
    {xs.map((x, i) => {
      const first = i === 0, last = i === xs.length - 1
      if (first || last) return <g key={i}><circle cx={x} cy={Y} r="11" fill={first ? 'var(--color-journey-origin)' : 'var(--color-journey-destination)'} stroke="#fff" strokeWidth="3" /><text x={x} y={Y + 4.5} textAnchor="middle" className="sch-pin">{first ? 'A' : 'B'}</text></g>
      return <circle key={i} cx={x} cy={Y} r="6.5" fill="#fff" stroke={affected >= 0 && i > affected ? 'var(--p-faded)' : 'var(--color-primary-dark)'} strokeWidth="3" />
    })}
    {mode === 'completado' && <g transform={`translate(${X1} ${Y + 27})`}><circle r="10" fill="var(--color-primary)" stroke="#fff" strokeWidth="2.5" /><path d="M-4.5 0.5 -1.2 3.8 4.8 -2.8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></g>}
  </svg>
}
