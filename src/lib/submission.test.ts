import { describe, it, expect } from 'vitest';
import { createSeedState } from './seed';
import { takeSubmissionSnapshot, diffSubmission } from './submission';

describe('式場提出パックの差分', () => {
  it('変更がなければ差分は空', () => {
    const state = createSeedState();
    const snapshot = takeSubmissionSnapshot(state);
    const diff = diffSubmission(snapshot, state);
    expect(diff.guestChanges).toEqual([]);
    expect(diff.seatChanges).toEqual([]);
  });

  it('回答の変化と席の移動を検出する', () => {
    const state = createSeedState();
    const snapshot = takeSubmissionSnapshot(state);
    const next = {
      ...state,
      guests: state.guests.map((g) =>
        g.id === 'g10' ? { ...g, rsvp: 'attending' as const } : g,
      ),
      assignments: {
        ...state.assignments,
        g1: { tableId: 'table-b', seatIndex: 2 },
      },
    };
    const diff = diffSubmission(snapshot, next);
    expect(diff.guestChanges.some((c) => c.text.includes('出欠'))).toBe(true);
    expect(diff.seatChanges).toHaveLength(1);
    expect(diff.seatChanges[0].guestName).toBe('高橋 誠');
    expect(diff.seatChanges[0].from).toContain('A卓');
    expect(diff.seatChanges[0].to).toContain('B卓');
  });
});
