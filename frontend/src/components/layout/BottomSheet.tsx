import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Icon } from '../ui/Icon'
import './BottomSheet.css'

interface Props {
  expanded: boolean
  desktop: boolean
  title: string
  summary: string
  focusKey: string
  panelRef: RefObject<HTMLElement | null>
  onToggle: () => void
  onBack?: () => void
  children: ReactNode
}

export function BottomSheet({ expanded, desktop, title, summary, focusKey, panelRef, onToggle, onBack, children }: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  const previousKey = useRef(focusKey)
  useEffect(() => {
    if (previousKey.current !== focusKey) {
      heading.current?.focus({ preventScroll: true })
      previousKey.current = focusKey
    }
  }, [focusKey])
  return <aside ref={panelRef} className={`bottom-sheet ${expanded ? 'is-expanded' : ''}`} aria-labelledby="context-title">
    <div className="sheet-heading">
      {onBack && <button type="button" className="icon-button" aria-label="Volver" onClick={onBack}><Icon name="arrow" /></button>}
      <div className="sheet-heading-text"><h2 ref={heading} id="context-title" tabIndex={-1}>{title}</h2><p>{summary}</p></div>
      <button type="button" className="icon-button sheet-toggle" aria-label={expanded ? 'Contraer panel' : 'Expandir panel'} aria-expanded={expanded} aria-controls="context-content" onClick={onToggle}><Icon name="chevron" /></button>
    </div>
    <div id="context-content" className="sheet-content" hidden={!expanded && !desktop}>{children}</div>
  </aside>
}
