import type { AppState, Assignments, Guest } from '../types';

const VIP_PATTERN = /部長|社長|専務|課長|先生|主賓|上司/;

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
  const occupied = new Map<string, Set<number>>();
  for (const table of state.tables) occupied.set(table.id, new Set());
  for (const a of Object.values(state.assignments)) {
    occupied.get(a.tableId)?.add(a.seatIndex);
  }

  const freeSeats = (tableId: string, capacity: number): number[] => {
    const used = occupied.get(tableId) ?? new Set<number>();
    const free: number[] = [];
    for (let i = 0; i < capacity; i += 1) {
      if (!used.has(i)) free.push(i);
    }
    return free;
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

  for (const bucket of sortedBuckets) {
    const ordered = [...bucket].sort((a, b) => seatPriority(a) - seatPriority(b));
    for (const guest of ordered) {
      // 空席が最も多い卓を選ぶ（同数なら定義順）
      let best: { tableId: string; seats: number[] } | null = null;
      for (const table of state.tables) {
        const seats = freeSeats(table.id, table.seats);
        if (seats.length === 0) continue;
        if (!best || seats.length > best.seats.length) best = { tableId: table.id, seats };
      }
      if (!best) break;
      const seatIndex = best.seats[0];
      proposal[guest.id] = { tableId: best.tableId, seatIndex };
      occupied.get(best.tableId)?.add(seatIndex);
    }
  }

  return proposal;
}
