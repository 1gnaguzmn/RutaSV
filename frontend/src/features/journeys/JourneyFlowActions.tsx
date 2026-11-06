import type { ReactNode } from 'react'

export function JourneyFlowActions({ onBack, onCancel, children }: { onBack: () => void; onCancel: () => void; children?: ReactNode }) {
  return <footer className="journey-flow-actions">
    {children && <div className="stack">{children}</div>}
    <div className="journey-flow-navigation"><button type="button" className="secondary-button" onClick={onBack}>Volver</button><button type="button" className="text-button" onClick={onCancel}>Cancelar viaje</button></div>
  </footer>
}
