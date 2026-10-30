import type { Selection } from '../../types/transit.ts'
import { STOP_GROUP_PAGE_SIZE } from '../stops/stopGroups.ts'

export const initialSelection: Selection = { view: 'explore', routeId: null, stopId: null }
export type SelectionAction =
  | { type: 'route'; id: string }
  | { type: 'stop'; id: string }
  | { type: 'group'; ids: string[] }
  | { type: 'group-page'; page: number }
  | { type: 'back' }
  | { type: 'explore' }

export function selectionReducer(state: Selection, action: SelectionAction): Selection {
  switch (action.type) {
    case 'route': return { view: 'route', routeId: action.id, stopId: null }
    case 'group': {
      const stopIds = [...new Set(action.ids)]
      return stopIds.length ? { view: 'group', routeId: state.routeId, stopId: null, group: { stopIds, page: 0 } } : state
    }
    case 'group-page': {
      if (state.view !== 'group' || !Number.isInteger(action.page)) return state
      const page = Math.max(0, Math.min(action.page, Math.ceil(state.group.stopIds.length / STOP_GROUP_PAGE_SIZE) - 1))
      return { ...state, group: { ...state.group, page } }
    }
    case 'stop': {
      const group = (state.view === 'group' || state.view === 'stop') && state.group?.stopIds.includes(action.id) ? state.group : undefined
      return { view: 'stop', routeId: state.routeId, stopId: action.id, ...(group ? { group } : {}) }
    }
    case 'back': {
      if (state.view === 'stop' && state.group) return { view: 'group', routeId: state.routeId, stopId: null, group: state.group }
      return state.routeId && state.view !== 'route' ? { view: 'route', routeId: state.routeId, stopId: null } : initialSelection
    }
    case 'explore': return initialSelection
  }
}
