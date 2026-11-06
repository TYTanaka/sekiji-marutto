import type { Guest } from '../types';

/** 変更の主体：ゲスト本人の回答か、主催者が管理画面で記録したか */
export type ChangeSource = 'guest' | 'host';

export interface ChangeEvent {
  id: string;
  at: string;
  guestId: string;
  guestName: string;
  kind: 'rsvp' | 'companions' | 'allergy';
  text: string;
  /** 旧データには無い場合がある（表示側で「主体不明」として扱う） */
  source?: ChangeSource;
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
  source?: ChangeSource,
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
      ...(source ? { source } : {}),
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

/** 集約表示用：同一ゲストの連続変更を1件に畳んだもの */
export interface ChangeGroup {
  guestId: string;
  guestName: string;
  /** グループ内で最新の変更時刻 */
  at: string;
  /** 畳まれた変更の総件数 */
  count: number;
  /** 種類ごとの最終状態（新しい種類から順に） */
  texts: string[];
  source?: ChangeSource;
}

/**
 * 変更レーダーの表示用集約。新しい順のイベント列を受け取り、
 * 同一ゲストの「連続した」変更を1グループに畳む。
 * ゲストが回答を迷って何度も変えた場合でも、最終状態と変更回数だけが見える。
 * 種類（出欠・同伴者・アレルギー）ごとに最新の文面を残すので、
 * 最終状態そのものは落とさない。
 */
export function groupChanges(events: ChangeEvent[]): ChangeGroup[] {
  const groups: (ChangeGroup & { kinds: Set<ChangeEvent['kind']> })[] = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    if (last && last.guestId === event.guestId) {
      last.count += 1;
      if (!last.kinds.has(event.kind)) {
        last.kinds.add(event.kind);
        last.texts.push(event.text);
      }
      if (!last.source && event.source) last.source = event.source;
    } else {
      groups.push({
        guestId: event.guestId,
        guestName: event.guestName,
        at: event.at,
        count: 1,
        texts: [event.text],
        kinds: new Set([event.kind]),
        ...(event.source ? { source: event.source } : {}),
      });
    }
  }
  return groups.map(({ kinds: _kinds, ...group }) => group);
}
