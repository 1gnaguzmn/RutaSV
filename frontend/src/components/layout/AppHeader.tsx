import { Icon } from '../ui/Icon'
import { useEffect, useRef, useState } from 'react'
import type { AppSection } from '../../types/journey'

export function AppHeader({ section, clock, unread, disabled, onNavigate }: { section: AppSection; clock: string; unread: number; disabled: boolean; onNavigate: (section: AppSection) => void }) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  return <header className="app-header">
    <div className="brand"><span className="brand-mark"><Icon name="bus" /></span><div><h1>RutaSV</h1><p className="virtual-time">{clock} · simulado</p></div></div>
    <div className="header-actions"><span className="badge">Demo</span><nav ref={container} aria-label="Navegación principal" onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); button.current?.focus() } }}>
      <button ref={button} type="button" className="icon-button" aria-label={`Menú principal${unread ? `, ${unread} avisos nuevos` : ''}`} aria-expanded={open} aria-controls="app-menu" onClick={() => setOpen((value) => !value)}>☰</button>
      <div id="app-menu" className="journey-menu" hidden={!open}>{([['explore', 'Explorar'], ['planner', 'Planificar'], ['trips', 'Mis viajes'], ['alerts', `Avisos${unread ? ` (${unread})` : ''}`], ['demo', 'Controles de demo']] as [AppSection, string][]).map(([id, label]) => <button type="button" key={id} aria-current={section === id ? 'page' : undefined} disabled={disabled && id !== 'planner'} onClick={() => { onNavigate(id); setOpen(false) }}>{label}</button>)}</div>
    </nav></div>
  </header>
}
