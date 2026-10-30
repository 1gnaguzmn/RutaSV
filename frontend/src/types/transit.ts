import type { Feature, FeatureCollection, LineString, Point } from 'geojson'

export interface Provenance {
  source: string
  verification_status: 'demonstration' | 'verified' | 'unverified'
  verified_at: string | null
  source_label?: string
  source_snapshot?: string
  source_updated_at?: string
}

export interface RouteProperties extends Provenance {
  id: string
  route_id: string
  short_name: string
  long_name: string
  direction: string
  color_key: 'a' | 'b'
  stop_ids: string[]
  source_route_code?: string
  recorrido_code?: string
  stop_sequence_status?: 'pending' | 'reviewed_subset'
}

export interface StopProperties extends Provenance {
  id: string
  name: string
  source_route_code?: string
  source_direction_code?: 'I' | 'R'
  shape_id?: string
  association_basis?: 'demo_direction_mapping'
}

export type Route = Feature<LineString, RouteProperties>
export type Stop = Feature<Point, StopProperties>
export interface RouteGroup {
  id: string
  variants: Route[]
}
export interface TransitData {
  routes: FeatureCollection<LineString, RouteProperties>
  stops: FeatureCollection<Point, StopProperties>
}

export type Selection =
  | { view: 'explore'; routeId: null; stopId: null }
  | { view: 'route'; routeId: string; stopId: null }
  | { view: 'stop'; routeId: string | null; stopId: string }

export interface MapInsets {
  top: number
  bottom: number
  left: number
  right: number
}
