import type { AppState } from '../types';
import { unassignedAttending } from './seating';

export interface Summary {
  total: number;
  replied: number;
  attending: number;
  declined: number;
  pending: number;
  unseated: number;
  replyRate: number;
  allSeated: boolean;
}

export function summarize(state: AppState): Summary {
  const total = state.guests.length;
  const attending = state.guests.filter(
    (guest) => guest.rsvp === 'attending',
  ).length;
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
    declined,
    pending,
    unseated,
    replyRate: total === 0 ? 0 : Math.round((replied / total) * 100),
    allSeated: attending > 0 && unseated === 0,
  };
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
