import type { DemoData, DemoStorage } from '../../types/journey.ts'

export const STORAGE_KEY = 'rutasv.demo.v02'
export function initialStorage(): DemoStorage {
  return { version: 1, routines: [], favorites: [], alerts: [], dismissedSuggestions: [], history: [
    { id: 'seed-1', originId: 'south', destinationId: 'university', day: -7, departedAt: 345, simulated: true },
    { id: 'seed-2', originId: 'south', destinationId: 'university', day: -5, departedAt: 355, simulated: true },
  ] }
}

export function parseStorage(text: string | null, data: DemoData): DemoStorage {
  if (!text) return initialStorage()
  try {
    const value = JSON.parse(text) as DemoStorage
    if (!value || value.version !== 1 || !['routines', 'favorites', 'history', 'alerts', 'dismissedSuggestions'].every((key) => Array.isArray(value[key as keyof DemoStorage]))) return initialStorage()
    const pairs = (a: string, b: string) => data.itineraries.some((trip) => trip.originId === a && trip.destinationId === b)
    const minute = (n: number) => Number.isInteger(n) && n >= 0 && n < 1440
    const label = (n: unknown): n is string => typeof n === 'string' && n.length > 0 && n.length <= 200
    const unique = <T extends { id: string }>(items: T[]) => [...new Map(items.map((item) => [item.id, item])).values()]
    return { version: 1,
      routines: unique(value.routines.filter((r) => r && label(r.id) && label(r.name) && pairs(r.originId, r.destinationId) && minute(r.arriveBy) && Number.isInteger(r.margin) && r.margin >= 0 && r.margin <= 60 && Number.isInteger(r.leadMinutes) && r.leadMinutes >= 0 && r.leadMinutes <= 120 && typeof r.paused === 'boolean' && Array.isArray(r.days) && r.days.length > 0 && r.days.every((d) => Number.isInteger(d) && d >= 0 && d < 7))),
      favorites: [...new Set(value.favorites.filter((id) => data.places.some((place) => place.id === id)))],
      history: unique(value.history.filter((h) => h && label(h.id) && pairs(h.originId, h.destinationId) && Number.isInteger(h.day) && minute(h.departedAt) && h.simulated === true)),
      alerts: unique(value.alerts.filter((a) => a && label(a.id) && label(a.title) && label(a.message) && label(a.routineId) && Number.isInteger(a.day) && ['traffic', 'closure', 'route-change'].includes(a.incidentId) && data.itineraries.some((trip) => trip.id === a.itineraryId) && (a.departure === null || Number.isInteger(a.departure)) && typeof a.read === 'boolean')),
      dismissedSuggestions: value.dismissedSuggestions.filter((key) => typeof key === 'string'),
    }
  } catch { return initialStorage() }
}

export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function readStorage(storage: StoragePort | null, data: DemoData): { state: DemoStorage; available: boolean } {
  try { return { state: parseStorage(storage?.getItem(STORAGE_KEY) ?? null, data), available: storage !== null } } catch { return { state: initialStorage(), available: false } }
}
export function writeStorage(storage: StoragePort | null, state: DemoStorage): boolean {
  try { if (!storage) return false; storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true } catch { return false }
}
