import type { AppState } from '../types';
import { unassignedAttending } from './seating';

export interface Summary {
  total: number;
  replied: number;
  attending: number;
  /** 出席ゲストの同伴者の合計 */
  companions: number;
  /** 出席の延べ人数（ゲスト本人＋同伴者） */
  attendingHeads: number;
  declined: number;
  pending: number;
  unseated: number;
  replyRate: number;
  allSeated: boolean;
}

export function summarize(state: AppState): Summary {
  const total = state.guests.length;
  const attendingGuests = state.guests.filter(
    (guest) => guest.rsvp === 'attending',
  );
  const attending = attendingGuests.length;
  const companions = attendingGuests.reduce(
    (sum, guest) => sum + Math.max(0, guest.companions ?? 0),
    0,
  );
  const declined = state.guests.filter(
    (guest) => guest.rsvp === 'declined',
  ).length;
  const replied = attending + declined;
  const pending = total - replied;
  const unseated = unassignedAttending(state).length;

  return {
    total,
    replied,
    attending,
    companions,
    attendingHeads: attending + companions,
    declined,
    pending,
    unseated,
    replyRate: total === 0 ? 0 : Math.round((replied / total) * 100),
    allSeated: attending > 0 && unseated === 0,
  };
}

/** 全卓の総席数 */
export function totalSeats(state: AppState): number {
  return state.tables.reduce((sum, table) => sum + table.seats, 0);
}

/**
 * 席が何名分足りないか（出席予定の延べ人数 − 総席数）。
 * 足りている場合は 0。未配置リストを数えなくても超過に気づけるよう、
 * 概要と席次タブで明示するための算出。
 */
export function seatShortage(state: AppState): number {
  return Math.max(0, summarize(state).attendingHeads - totalSeats(state));
}

export function nextActionHint(state: AppState): string {
  const { total, pending, unseated, attending } = summarize(state);

  if (total === 0) {
    return 'ゲストを登録しましょう';
  }

  if (pending > 0) {
    return `未回答のゲストが${pending}名います。出欠の確認を進めましょう`;
  }

  if (unseated > 0) {
    return `席が決まっていない出席ゲストが${unseated}名います。席次表で配置しましょう`;
  }

  if (attending === 0) {
    return '出席のゲストがまだいません';
  }

  return '準備は順調です。全員の席が決まっています。';
}
