import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ActiveJourney, DemoAlert, DemoData, DemoStorage, HabitualTrip, PlanRequest, ScenarioId } from '../types/journey'
import type { TransitData } from '../types/transit'
import { parseDemoData } from '../services/journeyDemo'
import { initialStorage, readStorage, writeStorage } from '../features/habits/storage'
import { appendHistory, habitSuggestion } from '../features/habits/habits'
import { advanceClock, INITIAL_CLOCK } from '../features/journeys/time'
import { estimateJourney, journeySteps, planAlternatives, preferredAlternative, validPlanRequest } from '../features/journeys/planning'
import { evaluateAlerts } from '../features/alerts/alerts'
import { journeyFlow } from '../features/journeys/flow'

const DEFAULT_REQUEST: PlanRequest = { originId: 'south', destinationId: 'university', arriveBy: 420, margin: 10 }
const storagePort = () => { try { return window.localStorage } catch { return null } }
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

export function useJourneyDemo(transit: TransitData | null) {
  const [data, setData] = useState<DemoData | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [stored, setStored] = useState<DemoStorage>(initialStorage)
  const [persistent, setPersistent] = useState(true)
  const [clock, setClock] = useState(INITIAL_CLOCK)
  const [scenario, setScenario] = useState<ScenarioId>('normal')
  const [request, setRequest] = useState<PlanRequest>(DEFAULT_REQUEST)
  const [draft, setDraft] = useState<PlanRequest>(DEFAULT_REQUEST)
  const [placesMode, setPlacesMode] = useState<'manual' | 'examples'>('manual')
  const [phase, flow] = useReducer(journeyFlow, 'places')
  const [planned, setPlanned] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [active, setActive] = useState<ActiveJourney | null>(null)
  const [notice, setNotice] = useState('')
  const [resetRevision, setResetRevision] = useState(0)
  const hydrated = useRef(false)

  useEffect(() => {
    if (!transit) return
    const controller = new AbortController()
    setError('')
    fetch(`${import.meta.env.BASE_URL}data/demo/scenarios.json`, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error('No se pudieron cargar los escenarios simulados.')
      return response.json() as Promise<unknown>
    }).then((value) => {
      if (controller.signal.aborted) return
      const parsed = parseDemoData(value, transit)
      if (!hydrated.current) {
        const saved = readStorage(storagePort(), parsed)
        setStored(saved.state); setPersistent(saved.available); hydrated.current = true
      }
      setData(parsed)
    }).catch(() => { if (!controller.signal.aborted) setError('No se pudieron cargar los escenarios simulados. Comprueba la conexión y vuelve a intentar.') })
    return () => controller.abort()
  }, [transit, attempt])

  useEffect(() => { if (data && !writeStorage(storagePort(), stored)) setPersistent(false) }, [data, stored])
  useEffect(() => {
    if (!data || active) return
    setStored((state) => {
      const alerts = evaluateAlerts(data, state, clock, scenario)
      return alerts.length ? { ...state, alerts: [...state.alerts, ...alerts] } : state
    })
  }, [data, active, clock, scenario, stored.routines])

  const alternatives = useMemo(() => data && planned ? planAlternatives(data, scenario, request, clock.day, clock.minute) : [], [data, planned, scenario, request, clock])
  const recommended = preferredAlternative(alternatives)
  const selected = alternatives.find((item) => item.estimate.itinerary.id === selectedId && !item.estimate.blocked) ?? recommended
  const plan = useCallback((next: PlanRequest, preferredId?: string, destinationPhase: 'options' | 'departure' = 'options'): boolean => {
    if (!data || active) return false
    if (!validPlanRequest(next, data)) { setNotice('Completa una hora de llegada válida y un margen entero entre 0 y 60 minutos.'); return false }
    const options = planAlternatives(data, scenario, next, clock.day, clock.minute)
    const sameRequest = planned && Object.keys(request).every((key) => request[key as keyof PlanRequest] === next[key as keyof PlanRequest])
    const keepId = preferredId ?? (sameRequest ? selectedId : null)
    setRequest(next); setDraft(next); setPlanned(true)
    setSelectedId(options.find((item) => item.estimate.itinerary.id === keepId && !item.estimate.blocked)?.estimate.itinerary.id ?? preferredAlternative(options)?.estimate.itinerary.id ?? null)
    flow(destinationPhase === 'departure' ? 'open-plan' : 'planned')
    setNotice('')
    return true
  }, [data, active, scenario, clock, planned, request, selectedId])
  const updateTiming = (arriveBy: number, margin: number): boolean => {
    const next = { ...request, arriveBy, margin }
    if (!data || active || !validPlanRequest(next, data)) return false
    setRequest(next); setDraft(next); setNotice('')
    return true
  }
  const start = () => {
    if (!selected || !data || active || phase !== 'departure') return
    const estimate = estimateJourney(data.itineraries.find((item) => item.id === selected.estimate.itinerary.id)!, data, scenario, clock.minute, clock.day)
    if (estimate.blocked) return
    setSelectedId(estimate.itinerary.id)
    setActive({ itineraryId: estimate.itinerary.id, steps: journeySteps(estimate), stepIndex: 0, departedAt: clock.minute, day: clock.day })
    flow('start')
    setNotice('')
  }
  const nextStep = () => {
    if (!active || !data) return
    setClock((value) => advanceClock(value, active.steps[active.stepIndex].minutes))
    if (active.stepIndex + 1 < active.steps.length) { setActive({ ...active, stepIndex: active.stepIndex + 1 }); return }
    const trip = data.itineraries.find((item) => item.id === active.itineraryId)!
    setStored((value) => appendHistory(value, { id: newId(), originId: trip.originId, destinationId: trip.destinationId, day: active.day, departedAt: active.departedAt, simulated: true }))
    setActive(null); flow('finish'); setNotice('Llegaste al destino de ejemplo. Viaje simulado finalizado.')
  }
  const saveRoutine = (routine: HabitualTrip) => { setStored((state) => ({ ...state, routines: [...state.routines.filter((item) => item.id !== routine.id), routine] })); setNotice('Viaje habitual guardado en este navegador.') }
  const reset = (all: boolean) => {
    setResetRevision((value) => value + 1)
    setActive(null); setClock(INITIAL_CLOCK); setScenario('normal'); setRequest(DEFAULT_REQUEST); setDraft(DEFAULT_REQUEST); setPlacesMode('manual'); flow('reset'); setSelectedId(null); setPlanned(false); setNotice('Escenario reiniciado.')
    setStored((state) => all ? initialStorage() : { ...state, alerts: [], history: initialStorage().history })
  }
  const openAlert = (alert: DemoAlert) => {
    if (!data || active) return
    const routine = stored.routines.find((item) => item.id === alert.routineId)
    const trip = data.itineraries.find((item) => item.id === alert.itineraryId)
    if (!trip) return
    const next = routine ?? { ...DEFAULT_REQUEST, originId: trip.originId, destinationId: trip.destinationId }
    setRequest(next); setDraft(next); setPlanned(true); setScenario(alert.incidentId); setSelectedId(alert.itineraryId); flow('open-plan'); setNotice('')
    setStored((state) => ({ ...state, alerts: state.alerts.map((item) => item.id === alert.id ? { ...item, read: true } : item) }))
  }
  return { data, error, retry: () => setAttempt((n) => n + 1), stored, setStored, persistent, clock, scenario, request, draft, setDraft, placesMode, setPlacesMode, phase, planned, selected, recommended, alternatives,
    active, notice, setNotice, plan, start, nextStep, updateTiming,
    continueToDeparture: () => { if (selected) { flow('continue'); setNotice('') } },
    back: () => { if (active) { setActive(null); setNotice('Simulación detenida. Puedes ajustar el plan e iniciar de nuevo.') } else setNotice(''); flow('back') },
    restartPlan: () => { flow('reset'); setNotice('') },
    cancelTrip: () => { setActive(null); setPlanned(false); setSelectedId(null); flow('reset'); setNotice('Viaje cancelado. Las rutinas guardadas se conservan.') },
    select: (id: string) => { if (!active) setSelectedId(id) },
    changeScenario: (value: ScenarioId) => { if (!active) { setScenario(value); setSelectedId(null) } },
    advance: (minutes: number) => { if (!active) setClock((value) => advanceClock(value, minutes)) },
    saveRoutine, removeRoutine: (id: string) => setStored((state) => ({ ...state, routines: state.routines.filter((item) => item.id !== id) })),
    toggleRoutine: (id: string) => setStored((state) => ({ ...state, routines: state.routines.map((item) => item.id === id ? { ...item, paused: !item.paused } : item) })),
    toggleFavorite: (id: string) => setStored((state) => ({ ...state, favorites: state.favorites.includes(id) ? state.favorites.filter((item) => item !== id) : [...state.favorites, id] })),
    suggestion: habitSuggestion(stored, clock.day), dismissSuggestion: (key: string) => setStored((state) => ({ ...state, dismissedSuggestions: [...state.dismissedSuggestions, key] })),
    openAlert, reset, resetRevision, newId,
  }
}
export type JourneyDemo = ReturnType<typeof useJourneyDemo>
