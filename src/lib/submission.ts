import type { AppState, Assignments, Guest, TableDef } from '../types';
import { diffGuests, type ChangeEvent } from './changes';

/** 式場へ提出した時点のスナップショット */
export interface SubmissionSnapshot {
  at: string;
  guests: Guest[];
  tables: TableDef[];
  assignments: Assignments;
}

export interface SeatChange {
  guestId: string;
  guestName: string;
  from: string;
  to: string;
}

export interface SubmissionDiff {
  guestChanges: ChangeEvent[];
  seatChanges: SeatChange[];
}

function seatLabel(
  snapshot: { tables: TableDef[]; assignments: Assignments },
  guestId: string,
): string {
  const assignment = snapshot.assignments[guestId];
  if (!assignment) return '未配置';
  const table = snapshot.tables.find((t) => t.id === assignment.tableId);
  return `${table ? table.name : '不明な卓'} ${assignment.seatIndex + 1}番席`;
}

/**
 * 前回の提出版と現在の状態の差分を出す。
 * 回答内容の変化は変更レーダーと同じ検知（diffGuests）を再利用し、
 * 席の移動はここで別途検出する。
 */
export function diffSubmission(
  snapshot: SubmissionSnapshot,
  state: AppState,
  now: Date = new Date(),
): SubmissionDiff {
  const guestChanges = diffGuests(snapshot.guests, state.guests, now);

  const seatChanges: SeatChange[] = [];
  const prevById = new Map(snapshot.guests.map((g) => [g.id, g]));
  for (const guest of state.guests) {
    if (!prevById.has(guest.id)) continue;
    const from = seatLabel(snapshot, guest.id);
    const to = seatLabel(state, guest.id);
    if (from !== to) {
      seatChanges.push({ guestId: guest.id, guestName: guest.name, from, to });
    }
  }

  return { guestChanges, seatChanges };
}

export function takeSubmissionSnapshot(
  state: AppState,
  now: Date = new Date(),
): SubmissionSnapshot {
  return {
    at: now.toISOString(),
    guests: state.guests.map((g) => ({ ...g })),
    tables: state.tables.map((t) => ({ ...t })),
    assignments: { ...state.assignments },
  };
}
