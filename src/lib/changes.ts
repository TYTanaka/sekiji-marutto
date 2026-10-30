import type { Guest } from '../types';

export interface ChangeEvent {
  id: string;
  at: string;
  guestId: string;
  guestName: string;
  kind: 'rsvp' | 'companions' | 'allergy';
  text: string;
}

const RSVP_LABEL: Record<Guest['rsvp'], string> = {
  attending: '出席',
  pending: '未回答',
  declined: '欠席',
};

/**
 * 前回と今回のゲスト一覧を比べて、回答内容の変化を抽出する。
 * 追加・削除されたゲストは対象外（名簿の編集は変更レーダーの関心事ではない）。
 */
export function diffGuests(
  prev: Guest[],
  next: Guest[],
  now: Date = new Date(),
): ChangeEvent[] {
  const prevById = new Map(prev.map((guest) => [guest.id, guest]));
  const events: ChangeEvent[] = [];
  const at = now.toISOString();
  let seq = 0;
  const push = (
    guest: Guest,
    kind: ChangeEvent['kind'],
    text: string,
  ): void => {
    seq += 1;
    events.push({
      id: `${now.getTime()}-${guest.id}-${seq}`,
      at,
      guestId: guest.id,
      guestName: guest.name,
      kind,
      text,
    });
  };

  for (const guest of next) {
    const before = prevById.get(guest.id);
    if (!before) continue;

    if (before.rsvp !== guest.rsvp) {
      push(
        guest,
        'rsvp',
        `出欠： ${RSVP_LABEL[before.rsvp]} → ${RSVP_LABEL[guest.rsvp]}`,
      );
    }
    if ((before.companions ?? 0) !== (guest.companions ?? 0)) {
      push(
        guest,
        'companions',
        `同伴者： ${before.companions ?? 0}名 → ${guest.companions ?? 0}名`,
      );
    }
    const beforeAllergy = (before.allergy ?? '').trim();
    const nextAllergy = (guest.allergy ?? '').trim();
    if (beforeAllergy !== nextAllergy) {
      if (!beforeAllergy) {
        push(guest, 'allergy', `アレルギーを追加： ${nextAllergy}`);
      } else if (!nextAllergy) {
        push(guest, 'allergy', `アレルギーを削除： ${beforeAllergy}`);
      } else {
        push(guest, 'allergy', `アレルギー： ${beforeAllergy} → ${nextAllergy}`);
      }
    }
  }

  return events;
}
