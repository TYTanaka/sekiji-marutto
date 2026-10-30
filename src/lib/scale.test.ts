import { describe, expect, it } from 'vitest';
import { createLargeSeedState } from './seedLarge';
import { proposeAssignments } from './autoSeat';
import { summarize } from './stats';
import { unassignedAttending, tableFill } from './seating';

describe('大規模データ（120名・15卓）の検証', () => {
  const state = createLargeSeedState();

  it('120名のゲストと15卓（120席）を生成する', () => {
    expect(state.guests).toHaveLength(120);
    expect(state.tables).toHaveLength(15);
    const capacity = state.tables.reduce((sum, t) => sum + t.seats, 0);
    expect(capacity).toBe(120);
  });

  it('ゲストIDと招待トークンが一意である', () => {
    expect(new Set(state.guests.map((g) => g.id)).size).toBe(120);
    expect(new Set(state.guests.map((g) => g.inviteToken)).size).toBe(120);
    expect(new Set(state.guests.map((g) => g.name)).size).toBe(120);
  });

  it('集計が120名規模でも整合する', () => {
    const sum = summarize(state);
    expect(sum.total).toBe(120);
    expect(sum.attending + sum.pending + sum.declined).toBe(120);
    expect(sum.attending).toBeGreaterThan(90);
    expect(sum.replied).toBe(sum.attending + sum.declined);
  });

  it('自動配置の提案が定員超過・重複なく全出席者を収容する', () => {
    const fresh = { ...state, assignments: {} };
    const proposal = proposeAssignments(fresh);
    const attending = fresh.guests.filter((g) => g.rsvp === 'attending');
    expect(Object.keys(proposal)).toHaveLength(attending.length);

    const used = new Set<string>();
    for (const [guestId, seat] of Object.entries(proposal)) {
      const table = fresh.tables.find((t) => t.id === seat.tableId);
      expect(table).toBeDefined();
      expect(seat.seatIndex).toBeGreaterThanOrEqual(0);
      expect(seat.seatIndex).toBeLessThan(table!.seats);
      const key = `${seat.tableId}:${seat.seatIndex}`;
      expect(used.has(key)).toBe(false);
      used.add(key);
      expect(attending.some((g) => g.id === guestId)).toBe(true);
    }
  });

  it('大規模サンプルは出席者全員が配置済みの状態で読み込まれる', () => {
    expect(unassignedAttending(state)).toHaveLength(0);
    for (const table of state.tables) {
      const fill = tableFill(state, table.id);
      expect(fill.seated).toBeLessThanOrEqual(fill.seats);
    }
  });
});
