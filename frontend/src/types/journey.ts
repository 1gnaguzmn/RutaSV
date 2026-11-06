import type { LineString, MultiLineString, Position } from 'geojson'

export type ScenarioId = 'normal' | 'traffic' | 'closure' | 'route-change'
export type AppSection = 'explore' | 'planner' | 'trips' | 'alerts' | 'demo'
export type JourneyPhase = 'places' | 'options' | 'departure' | 'simulation' | 'complete'
export interface DemoPlace { id: string; name: string; coordinates: Position }
export interface JourneyLeg {
  id: string
  mode: 'walk' | 'bus'
  label: string
  minutes: number
  distanceM: number
  geometry: LineString | MultiLineString
  shapeId?: string
  routeName?: string
  stopIds: string[]
  stopNames: string[]
}
export interface Itinerary {
  id: string; originId: string; destinationId: string; name: string
  simulated: true; legs: JourneyLeg[]
}
export interface DemoIncident {
  id: Exclude<ScenarioId, 'normal'>; title: string; description: string
  delayMinutes: number; affectedRouteNames: string[]; blockedItineraryIds: string[]
}
export interface DemoData {
  version: 1; places: DemoPlace[]; itineraries: Itinerary[]; incidents: DemoIncident[]
}
export interface PlanRequest { originId: string; destinationId: string; arriveBy: number; margin: number }
export interface JourneyEstimate { itinerary: Itinerary; duration: number; walkMinutes: number; walkingM: number; transfers: number; legMinutes: number[]; delay: number; blocked: boolean }
export interface DepartureRecommendation {
  departure: number | null; arrival: number | null; estimate: JourneyEstimate
  missed: boolean; nextDeparture: number | null; nextArrival: number | null
  comparisons: { departure: number; arrival: number; duration: number }[]
}
export interface HabitualTrip extends PlanRequest {
  id: string; name: string; days: number[]; leadMinutes: number; paused: boolean
}
export interface TripHistoryEntry { id: string; originId: string; destinationId: string; day: number; departedAt: number; simulated: true }
export interface DemoAlert { id: string; routineId: string; incidentId: ScenarioId; day: number; title: string; message: string; itineraryId: string; departure: number | null; read: boolean }
export interface DemoStorage {
  version: 1; routines: HabitualTrip[]; favorites: string[]; history: TripHistoryEntry[]
  alerts: DemoAlert[]; dismissedSuggestions: string[]
}
export interface DemoClock { day: number; minute: number }
export interface JourneyStep { id: string; legIndex: number; instruction: string; minutes: number; nextStop: boolean }
export interface ActiveJourney { itineraryId: string; steps: JourneyStep[]; stepIndex: number; departedAt: number; day: number }
export type MapScene = { mode: 'explore' } | { mode: 'itinerary'; itinerary: Itinerary; activeLeg: number | null }
