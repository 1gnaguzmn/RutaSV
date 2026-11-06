// Íconos del modo presentación. Mismo trazo y estilo que components/ui/Icon.tsx,
// pero escalan con el tamaño de letra (1em) para verse bien en el proyector.
export type PIconName = 'bus' | 'pin' | 'search' | 'walk' | 'transfer' | 'alight' | 'check' | 'lock' | 'clock' | 'alert' | 'trash' | 'arrow' | 'calendar' | 'bell' | 'chevron'

const paths: Record<PIconName, string> = {
  bus: 'M5 17V6c0-2 14-2 14 0v11H5Zm0-6h14M8 17v3m8-3v3M8 14h1m6 0h1',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  walk: 'M14 5a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 14 5ZM10 21l2.2-6 2.8 2.6V21M7.5 11.5 10 8h3.5l2.2 3.2 2.3.8M12.2 15 13.5 8',
  transfer: 'M4 8h14l-4-4M20 16H6l4 4',
  alight: 'M12 3v11m-5-4 5 5 5-5M5 20h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  lock: 'M8 11V8a4 4 0 0 1 8 0v3M6 11h12v9H6z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4m8-4v4',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 21h4',
  chevron: 'm6 9 6 6 6-6',
}

export function PIcon({ name, className }: { name: PIconName; className?: string }) {
  return <svg className={className} width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
