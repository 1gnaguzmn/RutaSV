import type { DemoData, DemoStorage, PlanRequest, TripHistoryEntry } from '../../types/journey.ts'

export const pairKey = (originId: string, destinationId: string) => `${originId}:${destinationId}`
export function habitSuggestion(state: DemoStorage, day: number): PlanRequest | null {
  for (const entry of [...state.history].reverse()) {
    const key = pairKey(entry.originId, entry.destinationId)
    if (state.dismissedSuggestions.includes(key) || state.routines.some((routine) => pairKey(routine.originId, routine.destinationId) === key)) continue
    const related = state.history.filter((h) => h.originId === entry.originId && h.destinationId === entry.destinationId && h.day <= day && day - h.day < 14 && Math.abs(h.departedAt - entry.departedAt) <= 30)
    if (related.length >= 3) return { originId: entry.originId, destinationId: entry.destinationId, arriveBy: 420, margin: 10 }
  }
  return null
}
export function appendHistory(state: DemoStorage, entry: TripHistoryEntry): DemoStorage {
  return { ...state, history: [...state.history.filter((item) => entry.day - item.day < 14), entry] }
}
export const placeName = (data: DemoData, id: string) => data.places.find((place) => place.id === id)?.name ?? id
