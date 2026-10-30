import type { Selection } from '../../types/transit.ts'

export const initialSelection: Selection = { view: 'explore', routeId: null, stopId: null }
export type SelectionAction =
  | { type: 'route'; id: string }
  | { type: 'stop'; id: string }
  | { type: 'back' }
  | { type: 'explore' }

export function selectionReducer(state: Selection, action: SelectionAction): Selection {
  switch (action.type) {
    case 'route': return { view: 'route', routeId: action.id, stopId: null }
    case 'stop': return { view: 'stop', routeId: state.routeId, stopId: action.id }
    case 'back': return state.view === 'stop' && state.routeId
      ? { view: 'route', routeId: state.routeId, stopId: null } : initialSelection
    case 'explore': return initialSelection
  }
}
