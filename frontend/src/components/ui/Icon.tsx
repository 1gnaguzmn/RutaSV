type IconName = 'search' | 'close' | 'arrow' | 'chevron' | 'bus' | 'pin' | 'locate' | 'frame' | 'plus' | 'minus'
const paths: Record<IconName, string> = {
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  close: 'M6 6l12 12M6 18L18 6',
  arrow: 'M19 12H5m6-6-6 6 6 6',
  chevron: 'm6 15 6-6 6 6',
  bus: 'M5 17V6c0-2 14-2 14 0v11H5Zm0-6h14M8 17v3m8-3v3M8 14h1m6 0h1',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  locate: 'M12 2v4m0 12v4M2 12h4m12 0h4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  frame: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 12h8m-4-4v8',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
}

export function Icon({ name }: { name: IconName }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
