import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type {
  AppState,
  Guest,
  TableDef,
  WeddingInfo,
  RsvpStatus,
  Assignments,
} from '../types';
import { createSeedState } from '../lib/seed';
import { validateAssignment } from '../lib/seating';

export type Action =
  | { type: 'addGuest'; guest: Guest }
  | { type: 'updateGuest'; guest: Guest }
  | { type: 'removeGuest'; guestId: string }
  | { type: 'setRsvp'; guestId: string; rsvp: RsvpStatus }
  | { type: 'addTable'; table: TableDef }
  | { type: 'removeTable'; tableId: string }
  | { type: 'updateTable'; table: TableDef }
  | { type: 'assign'; guestId: string; tableId: string; seatIndex: number }
  | { type: 'unassign'; guestId: string }
  | { type: 'setInfo'; info: WeddingInfo }
  | { type: 'reset' };

const STORAGE_KEY = 'sekiji-state-v2';

function withoutAssignment(
  assignments: Assignments,
  guestId: string,
): Assignments {
  const next = { ...assignments };
  delete next[guestId];
  return next;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addGuest':
      return {
        ...state,
        guests: [...state.guests, action.guest],
      };

    case 'updateGuest':
      return {
        ...state,
        guests: state.guests.map((guest) =>
          guest.id === action.guest.id ? action.guest : guest,
        ),
      };

    case 'removeGuest':
      return {
        ...state,
        guests: state.guests.filter((guest) => guest.id !== action.guestId),
        assignments: withoutAssignment(state.assignments, action.guestId),
      };

    case 'setRsvp':
      return {
        ...state,
        guests: state.guests.map((guest) =>
          guest.id === action.guestId
            ? { ...guest, rsvp: action.rsvp }
            : guest,
        ),
        assignments:
          action.rsvp === 'attending'
            ? state.assignments
            : withoutAssignment(state.assignments, action.guestId),
      };

    case 'addTable':
      return {
        ...state,
        tables: [...state.tables, action.table],
      };

    case 'removeTable': {
      const assignments: Assignments = { ...state.assignments };

      for (const [guestId, assignment] of Object.entries(assignments)) {
        if (assignment.tableId === action.tableId) {
          delete assignments[guestId];
        }
      }

      return {
        ...state,
        tables: state.tables.filter((table) => table.id !== action.tableId),
        assignments,
      };
    }

    case 'updateTable': {
      const assignments: Assignments = { ...state.assignments };

      for (const [guestId, assignment] of Object.entries(assignments)) {
        if (
          assignment.tableId === action.table.id &&
          assignment.seatIndex >= action.table.seats
        ) {
          delete assignments[guestId];
        }
      }

      return {
        ...state,
        tables: state.tables.map((table) =>
          table.id === action.table.id ? action.table : table,
        ),
        assignments,
      };
    }

    case 'assign': {
      const result = validateAssignment(
        state,
        action.guestId,
        action.tableId,
        action.seatIndex,
      );

      if (!result.ok) {
        return state;
      }

      return {
        ...state,
        assignments: {
          ...state.assignments,
          [action.guestId]: {
            tableId: action.tableId,
            seatIndex: action.seatIndex,
          },
        },
      };
    }

    case 'unassign':
      return {
        ...state,
        assignments: withoutAssignment(state.assignments, action.guestId),
      };

    case 'setInfo':
      return {
        ...state,
        info: action.info,
      };

    case 'reset':
      return createSeedState();
  }
}

function hasMinimalShape(value: unknown): value is AppState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'version' in value &&
    value.version === 2 &&
    'guests' in value &&
    Array.isArray(value.guests) &&
    'tables' in value &&
    Array.isArray(value.tables) &&
    'assignments' in value &&
    typeof value.assignments === 'object' &&
    value.assignments !== null &&
    !Array.isArray(value.assignments) &&
    'info' in value &&
    typeof value.info === 'object' &&
    value.info !== null &&
    !Array.isArray(value.info)
  );
}

export function loadInitialState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored !== null) {
      const parsed: unknown = JSON.parse(stored);

      if (hasMinimalShape(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Unavailable storage or invalid JSON falls back to seed data.
  }

  return createSeedState();
}

interface AppStateContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(
  undefined,
);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Keep the store usable when persistence is unavailable.
    }
  }, [state]);

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);

  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }

  return context;
}
