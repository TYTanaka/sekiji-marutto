import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
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
  PrepTask,
} from '../types';
import { createSeedState } from '../lib/seed';
import { validateAssignment } from '../lib/seating';
import { createDefaultTasks } from '../lib/tasks';
import { newInviteToken } from '../lib/supabase';
import { diffGuests, type ChangeEvent } from '../lib/changes';

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
  | { type: 'reset' }
  | { type: 'addTask'; task: PrepTask }
  | { type: 'toggleTask'; taskId: string }
  | { type: 'removeTask'; taskId: string }
  | { type: 'hydrate'; state: AppState };

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
    case 'addTask':
      return { ...state, tasks: [...state.tasks, action.task] };
    case 'toggleTask':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.taskId ? { ...t, done: !t.done } : t)),
      };
    case 'removeTask':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.taskId) };
    case 'hydrate':
      if (action.state.version !== 2) return state;
      return normalizeState(action.state);
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

export function normalizeState(state: AppState): AppState {
  const guests = state.guests.map((g) =>
    g.inviteToken ? g : { ...g, inviteToken: newInviteToken() },
  );
  const tasks = Array.isArray(state.tasks) ? state.tasks : createDefaultTasks(state.info.date);
  if (guests.every((g, i) => g === state.guests[i]) && tasks === state.tasks) return state;
  return { ...state, guests, tasks };
}

export function loadInitialState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored !== null) {
      const parsed: unknown = JSON.parse(stored);

      if (hasMinimalShape(parsed)) {
        return normalizeState(parsed);
      }
    }
  } catch {
    // Unavailable storage or invalid JSON falls back to seed data.
  }

  return createSeedState();
}

export type CloudPhase = 'idle' | 'syncing' | 'synced' | 'error';

interface UndoNotice {
  id: number;
  message: string;
}

interface AppStateContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  dispatchWithUndo: (action: Action, message: string) => void;
  undoNotice: UndoNotice | null;
  undo: () => void;
  dismissUndo: () => void;
  savedAt: Date | null;
  cloudPhase: CloudPhase;
  reportCloud: (phase: CloudPhase) => void;
  changes: ChangeEvent[];
  clearChanges: () => void;
  /** クラウド側の開封記録（token → ISO日時）。ローカル分は Guest.openedAt を見る */
  opens: Record<string, string>;
  reportOpens: (opens: Record<string, string>) => void;
}

/** ゲストの招待リンク開封日時。クラウド記録を優先し、無ければローカル記録を見る */
export function openedAtFor(
  opens: Record<string, string>,
  guest: Guest,
): string | undefined {
  return opens[guest.inviteToken] ?? guest.openedAt;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(
  undefined,
);

const UNDO_WINDOW_MS = 9000;
const CHANGES_KEY = 'sekiji-changes-v1';
const MAX_CHANGES = 30;

function loadChanges(): ChangeEvent[] {
  try {
    const raw = localStorage.getItem(CHANGES_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as ChangeEvent[];
    }
  } catch {
    // Unavailable storage just means no change history.
  }
  return [];
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);
  const [changes, setChanges] = useState<ChangeEvent[]>(loadChanges);
  const prevGuestsRef = useRef<Guest[] | null>(null);

  // 変更レーダー： ゲストの回答内容が前回から変わったら記録する。
  // クラウド経由（ゲスト本人の回答）も、主催者の編集も、hydrate の差分として検知できる。
  useEffect(() => {
    const prev = prevGuestsRef.current;
    prevGuestsRef.current = state.guests;
    if (prev === null) return;
    const events = diffGuests(prev, state.guests);
    if (events.length === 0) return;
    setChanges((current) => {
      const merged = [...events.reverse(), ...current].slice(0, MAX_CHANGES);
      try {
        localStorage.setItem(CHANGES_KEY, JSON.stringify(merged));
      } catch {
        // Persistence is best-effort for the change feed.
      }
      return merged;
    });
  }, [state.guests]);

  const clearChanges = useCallback(() => {
    setChanges([]);
    try {
      localStorage.removeItem(CHANGES_KEY);
    } catch {
      // Ignore storage failures.
    }
  }, []);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [cloudPhase, setCloudPhase] = useState<CloudPhase>('idle');
  const [undoNotice, setUndoNotice] = useState<UndoNotice | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const undoSnapshotRef = useRef<AppState | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Keep the store usable when persistence is unavailable.
    }
    setSavedAt(new Date());
  }, [state]);

  const dismissUndo = useCallback(() => {
    setUndoNotice(null);
    undoSnapshotRef.current = null;
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  const dispatchWithUndo = useCallback((action: Action, message: string) => {
    undoSnapshotRef.current = stateRef.current;
    dispatch(action);
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
    }
    setUndoNotice({ id: Date.now(), message });
    undoTimerRef.current = setTimeout(() => {
      undoTimerRef.current = null;
      undoSnapshotRef.current = null;
      setUndoNotice(null);
    }, UNDO_WINDOW_MS);
  }, []);

  const undo = useCallback(() => {
    const snapshot = undoSnapshotRef.current;
    if (snapshot) {
      dispatch({ type: 'hydrate', state: snapshot });
    }
    dismissUndo();
  }, [dismissUndo]);

  const reportCloud = useCallback((phase: CloudPhase) => {
    setCloudPhase(phase);
  }, []);

  const [opens, setOpens] = useState<Record<string, string>>({});
  const reportOpens = useCallback((next: Record<string, string>) => {
    setOpens(next);
  }, []);

  useEffect(
    () => () => {
      if (undoTimerRef.current !== null) {
        clearTimeout(undoTimerRef.current);
      }
    },
    [],
  );

  return (
    <AppStateContext.Provider
      value={{
        state,
        dispatch,
        dispatchWithUndo,
        undoNotice,
        undo,
        dismissUndo,
        savedAt,
        cloudPhase,
        reportCloud,
        changes,
        clearChanges,
        opens,
        reportOpens,
      }}
    >
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
