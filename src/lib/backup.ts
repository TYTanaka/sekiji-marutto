import type { AppState } from '../types';

export interface BackupFile {
  app: 'sekiji-marutto';
  version: 1;
  exportedAt: string;
  state: AppState;
}

export function serializeBackup(state: AppState, now = new Date()): string {
  const file: BackupFile = {
    app: 'sekiji-marutto',
    version: 1,
    exportedAt: now.toISOString(),
    state,
  };
  return JSON.stringify(file, null, 2);
}

export function backupFilename(date: string): string {
  return `sekiji-marutto-backup-${date || 'data'}.json`;
}

export function downloadBackup(state: AppState): void {
  const blob = new Blob([serializeBackup(state)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = backupFilename(state.info.date);
  anchor.click();
  URL.revokeObjectURL(url);
}

const SIDES = ['groom', 'bride'];
const GROUPS = ['family', 'work', 'friends', 'other'];
const RSVPS = ['pending', 'attending', 'declined'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isGuest(v: unknown): boolean {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    SIDES.includes(v.side as string) &&
    GROUPS.includes(v.group as string) &&
    RSVPS.includes(v.rsvp as string) &&
    typeof v.inviteToken === 'string'
  );
}

function isTable(v: unknown): boolean {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.seats === 'number' &&
    Number.isFinite(v.seats)
  );
}

/** バックアップJSONの文字列を検証して AppState を返す（不正なら null） */
export function parseBackup(text: string): AppState | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  // バックアップ形式（{app, state}）と、stateそのもののJSONの両方を受ける
  const state: unknown = isRecord(data) && 'state' in data ? data.state : data;
  if (!isRecord(state)) return null;
  const { info, guests, tables, assignments, tasks } = state as Record<string, unknown>;
  if (!isRecord(info)) return null;
  for (const key of ['groomName', 'brideName', 'date', 'venue', 'message']) {
    if (typeof info[key] !== 'string') return null;
  }
  if (!Array.isArray(guests) || !guests.every(isGuest)) return null;
  if (!Array.isArray(tables) || !tables.every(isTable)) return null;
  if (!isRecord(assignments)) return null;
  for (const a of Object.values(assignments)) {
    if (!isRecord(a) || typeof a.tableId !== 'string' || typeof a.seatIndex !== 'number') {
      return null;
    }
  }
  if (!Array.isArray(tasks)) return null;
  for (const t of tasks) {
    if (!isRecord(t) || typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.done !== 'boolean') {
      return null;
    }
  }
  return state as unknown as AppState;
}
