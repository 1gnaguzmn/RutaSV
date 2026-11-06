import type { DemoClock } from '../../types/journey.ts'

export const INITIAL_CLOCK: DemoClock = { day: 0, minute: 345 }
export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const weekday = (day: number) => ((day % 7) + 7) % 7
export function timeText(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}${minutes < 0 ? ' (día anterior)' : minutes >= 1440 ? ' (+1 día)' : ''}`
}
export const parseTime = (value: string) => { const [hours, minutes] = value.split(':').map(Number); return hours * 60 + minutes }
export function advanceClock(clock: DemoClock, minutes: number): DemoClock {
  const total = clock.day * 1440 + clock.minute + minutes
  return { day: Math.floor(total / 1440), minute: ((total % 1440) + 1440) % 1440 }
}
