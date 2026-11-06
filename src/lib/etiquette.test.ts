import { describe, it, expect } from 'vitest';
import { createSeedState } from './seed';
import { checkSeatingEtiquette } from './etiquette';
import type { AppState } from '../types';

function withAssignments(state: AppState, assignments: AppState['assignments']): AppState {
  return { ...state, assignments };
}

describe('席次作法チェック', () => {
  it('初期配置（役職者が上座・単独サイド）では指摘がない', () => {
    const state = createSeedState();
    expect(checkSeatingEtiquette(state)).toEqual([]);
  });

  it('役職者が下座側に座ると警告する', () => {
    const seed = createSeedState();
    const state = withAssignments(seed, {
      ...seed.assignments,
      g1: { tableId: 'table-a', seatIndex: 7 },
    });
    const notes = checkSeatingEtiquette(state);
    expect(notes.some((n) => n.level === 'warn' && n.text.includes('高橋 誠'))).toBe(true);
  });

  it('上座が空いていると確認ポイントを出す', () => {
    const seed = createSeedState();
    const state = withAssignments(seed, {
      g2: { tableId: 'table-a', seatIndex: 1 },
    });
    const notes = checkSeatingEtiquette(state);
    expect(notes.some((n) => n.text.includes('上座'))).toBe(true);
  });

  it('親族が末席で上座が親族以外だと警告する', () => {
    const seed = createSeedState();
    const state = withAssignments(seed, {
      g1: { tableId: 'table-a', seatIndex: 0 },
      g5: { tableId: 'table-a', seatIndex: 7 },
    });
    const notes = checkSeatingEtiquette(state);
    expect(notes.some((n) => n.level === 'warn' && n.text.includes('佐藤 正志'))).toBe(true);
  });

  it('新郎側と新婦側が同じ卓に混ざると確認ポイントを出す', () => {
    const seed = createSeedState();
    const state = withAssignments(seed, {
      ...seed.assignments,
      g7: { tableId: 'table-a', seatIndex: 4 },
    });
    const notes = checkSeatingEtiquette(state);
    expect(notes.some((n) => n.text.includes('混ざっています'))).toBe(true);
  });

  it('両サイド混在は「確認」レベル止まりで、警告にはならない', () => {
    const seed = createSeedState();
    const state = withAssignments(seed, {
      ...seed.assignments,
      g7: { tableId: 'table-a', seatIndex: 4 },
    });
    const notes = checkSeatingEtiquette(state);
    const sideMix = notes.filter((n) => n.text.includes('混ざっています'));
    expect(sideMix.length).toBeGreaterThan(0);
    expect(sideMix.every((n) => n.level === 'check')).toBe(true);
    // 混在そのものでは警告は1件も出ない（本物の問題の警告と混ざらない）
    expect(notes.filter((n) => n.level === 'warn')).toEqual([]);
  });
});
