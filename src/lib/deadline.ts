import type { WeddingInfo } from '../types';

/**
 * 回答期限（主催者が式の情報で設定した日付）。
 * 挙式30日前という目安（reminder の replyDeadline）とは別に、
 * こちらは「設定された場合にだけ」招待ページへ表示され、期限後は受付を締める。
 */

/** 設定された回答期限の日付（当日 00:00）。未設定・不正値なら null */
export function configuredDeadline(info: WeddingInfo): Date | null {
  if (!info.rsvpDeadline) return null;
  const d = new Date(`${info.rsvpDeadline}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 期限を過ぎているか。期限当日はまだ回答できる（含む） */
export function isDeadlinePassed(
  info: WeddingInfo,
  now: Date = new Date(),
): boolean {
  const deadline = configuredDeadline(info);
  if (!deadline) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today.getTime() > deadline.getTime();
}
