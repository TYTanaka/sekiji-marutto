import type { AppState, Assignments, Guest } from '../types';
import { GROUP_LABELS, SIDE_LABELS } from '../types';
import { partySize } from './seating';

export interface ProposalWithReasons {
  assignments: Assignments;
  reasons: Record<string, string[]>;
}

export const VIP_PATTERN = /部長|社長|専務|課長|先生|主賓|上司/;

/** 小さいほど上座（seatIndex 0）に近い席を割り当てる */
function seatPriority(guest: Guest): number {
  if (VIP_PATTERN.test(guest.title)) return 0;
  if (guest.group === 'family') return 1;
  if (guest.group === 'work') return 2;
  if (guest.group === 'friends') return 3;
  return 4;
}

/**
 * 出席・未配置のゲストに席の提案を返す（既存の配置は変更しない）。
 * 同じ「新郎/新婦側 × グループ」の塊をなるべく同じ卓にまとめ、
 * 役職者や親族を上座側から配置する。
 */
export function proposeAssignments(state: AppState): Assignments {
  return proposeAssignmentsWithReasons(state).assignments;
}

export function proposeAssignmentsWithReasons(state: AppState): ProposalWithReasons {
  const occupied = new Map<string, Set<number>>();
  for (const table of state.tables) occupied.set(table.id, new Set());
  const guestsById = new Map(state.guests.map((g) => [g.id, g]));
  for (const [guestId, a] of Object.entries(state.assignments)) {
    const size = partySize(guestsById.get(guestId) ?? ({ companions: 0 } as Guest));
    for (let offset = 0; offset < size; offset += 1) {
      occupied.get(a.tableId)?.add(a.seatIndex + offset);
    }
  }

  const freeSeats = (tableId: string, capacity: number): number[] => {
    const used = occupied.get(tableId) ?? new Set<number>();
    const free: number[] = [];
    for (let i = 0; i < capacity; i += 1) {
      if (!used.has(i)) free.push(i);
    }
    return free;
  };

  /** size 人が隣同士で座れる連続した空席の開始位置（なければ -1） */
  const freeRunStart = (tableId: string, capacity: number, size: number): number => {
    const used = occupied.get(tableId) ?? new Set<number>();
    for (let start = 0; start + size - 1 < capacity; start += 1) {
      let ok = true;
      for (let offset = 0; offset < size; offset += 1) {
        if (used.has(start + offset)) { ok = false; break; }
      }
      if (ok) return start;
    }
    return -1;
  };

  const buckets = new Map<string, Guest[]>();
  for (const guest of state.guests) {
    if (guest.rsvp !== 'attending' || state.assignments[guest.id]) continue;
    const key = `${guest.side}:${guest.group}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(guest);
    buckets.set(key, bucket);
  }

  const sortedBuckets = [...buckets.values()].sort((a, b) => b.length - a.length);
  const proposal: Assignments = {};
  const reasons: Record<string, string[]> = {};
  const placedByTableBucket = new Map<string, Guest[]>();

  for (const bucket of sortedBuckets) {
    const ordered = [...bucket].sort((a, b) => seatPriority(a) - seatPriority(b));
    for (const guest of ordered) {
      const size = partySize(guest);
      // 本人＋同伴者が隣同士で座れる卓のうち、空席が最も多い卓を選ぶ（同数なら定義順）
      let best: { tableId: string; seats: number[]; start: number } | null = null;
      for (const table of state.tables) {
        const start = freeRunStart(table.id, table.seats, size);
        if (start < 0) continue;
        const seats = freeSeats(table.id, table.seats);
        if (!best || seats.length > best.seats.length) best = { tableId: table.id, seats, start };
      }
      if (!best) continue;
      const seatIndex = best.start;
      proposal[guest.id] = { tableId: best.tableId, seatIndex };
      for (let offset = 0; offset < size; offset += 1) {
        occupied.get(best.tableId)?.add(seatIndex + offset);
      }

      const guestReasons: string[] = [];
      if (seatPriority(guest) === 0) {
        guestReasons.push('主賓・役職者として上座側へ');
      } else if (seatIndex === 0) {
        guestReasons.push('上座に配置');
      }
      if (size > 1) {
        guestReasons.push(`同伴者${size - 1}名と隣同士になるよう配置`);
      }
      const bucketKey = `${best.tableId}:${guest.side}:${guest.group}`;
      const sameBucket = placedByTableBucket.get(bucketKey) ?? [];
      if (sameBucket.length > 0) {
        const names = sameBucket.slice(0, 2).map((g) => `${g.name}さん`).join('・');
        guestReasons.push(
          `同じ${SIDE_LABELS[guest.side]}・${GROUP_LABELS[guest.group]}の${names}と同じ卓`,
        );
      }
      if (guestReasons.length === 0) {
        guestReasons.push('空席のバランスを考慮して配置');
      }
      reasons[guest.id] = guestReasons;
      placedByTableBucket.set(bucketKey, [...sameBucket, guest]);
    }
  }

  return { assignments: proposal, reasons };
}
