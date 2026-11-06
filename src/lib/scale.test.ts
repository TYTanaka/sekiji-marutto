import { describe, expect, it } from 'vitest';
import { createLargeSeedState } from './seedLarge';
import { proposeAssignments } from './autoSeat';
import { summarize, seatShortage } from './stats';
import { unassignedAttending, tableFill } from './seating';
import { checkSeatingEtiquette } from './etiquette';
import type { AppState } from '../types';

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

  it('大規模サンプルは数名だけ未配置で読み込まれ、自動配置を体験できる', () => {
    const unassigned = unassignedAttending(state);
    // 自動配置ボタン→配置理由まで辿れるよう、5〜8名が未配置で始まる
    expect(unassigned.length).toBeGreaterThanOrEqual(5);
    expect(unassigned.length).toBeLessThanOrEqual(8);
    for (const table of state.tables) {
      const fill = tableFill(state, table.id);
      expect(fill.seated).toBeLessThanOrEqual(fill.seats);
    }
    // 初期状態の時点で作法チェックの警告は出ない（デモの第一印象を荒らさない）
    expect(checkSeatingEtiquette(state).filter((n) => n.level === 'warn')).toEqual([]);

    // 提案を適用すると全員が配置され、作法の警告も出ない
    // （proposeAssignments は未配置分への追加提案を返す）
    const after: AppState = {
      ...state,
      assignments: { ...state.assignments, ...proposeAssignments(state) },
    };
    expect(unassignedAttending(after)).toHaveLength(0);
    expect(checkSeatingEtiquette(after).filter((n) => n.level === 'warn')).toEqual([]);
  });

  it('定員超過は seatShortage で不足席数として算出される', () => {
    expect(seatShortage(state)).toBe(0);
    // 卓を減らすと、その分だけ不足として数えられる
    const fewer: AppState = { ...state, tables: state.tables.slice(0, 14) };
    const attendingHeads = state.guests
      .filter((g) => g.rsvp === 'attending')
      .reduce((sum, g) => sum + 1 + g.companions, 0);
    expect(seatShortage(fewer)).toBe(attendingHeads - 14 * 8);
  });
});
