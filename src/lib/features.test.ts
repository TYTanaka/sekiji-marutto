import { describe, expect, it } from 'vitest';
import { createSeedState } from './seed';
import { createDefaultTasks, taskProgress } from './tasks';
import { buildInviteMessage, buildReminderMessage, replyDeadline } from './reminder';
import { proposeAssignments } from './autoSeat';

describe('createDefaultTasks', () => {
  it('挙式日から期日を逆算する', () => {
    const tasks = createDefaultTasks('2027-04-18');
    expect(tasks.length).toBeGreaterThanOrEqual(8);
    const send = tasks.find((t) => t.title.includes('招待状の送付'));
    expect(send?.dueDate).toBe('2027-02-17'); // 60日前
    expect(tasks.every((t) => !t.done)).toBe(true);
  });

  it('進捗率を計算する', () => {
    const tasks = createDefaultTasks('2027-04-18');
    tasks[0].done = true;
    const p = taskProgress(tasks);
    expect(p.done).toBe(1);
    expect(p.rate).toBe(Math.round(100 / tasks.length));
  });
});

describe('reminder messages', () => {
  const state = createSeedState();
  const guest = state.guests[0];

  it('招待メッセージにURLと式情報が入る', () => {
    const msg = buildInviteMessage(guest, state.info, 'https://example.com/#/rsvp/x');
    expect(msg).toContain(guest.name);
    expect(msg).toContain('https://example.com/#/rsvp/x');
    expect(msg).toContain(state.info.venue);
  });

  it('催促メッセージの締切は挙式30日前', () => {
    const d = replyDeadline(state.info);
    expect(d?.getFullYear()).toBe(2027);
    expect(d?.getMonth()).toBe(2); // 3月
    expect(d?.getDate()).toBe(19);
    const msg = buildReminderMessage(guest, state.info, 'https://example.com/#/rsvp/x');
    expect(msg).toContain('2027年3月19日');
  });
});

describe('proposeAssignments', () => {
  it('出席・未配置のゲストだけを提案し、既存配置は変えない', () => {
    const state = createSeedState();
    const before = { ...state.assignments };
    const proposal = proposeAssignments(state);
    // seed: 出席8名のうち4名配置済み → 残り4名が提案される
    expect(Object.keys(proposal)).toHaveLength(4);
    for (const [guestId, a] of Object.entries(proposal)) {
      const guest = state.guests.find((g) => g.id === guestId);
      expect(guest?.rsvp).toBe('attending');
      expect(before[guestId]).toBeUndefined();
      const table = state.tables.find((t) => t.id === a.tableId);
      expect(a.seatIndex).toBeLessThan(table?.seats ?? 0);
    }
    // 席の重複がない
    const keys = Object.values(proposal).map((a) => `${a.tableId}:${a.seatIndex}`);
    const existing = Object.values(before).map((a) => `${a.tableId}:${a.seatIndex}`);
    expect(new Set([...keys, ...existing]).size).toBe(keys.length + existing.length);
  });

  it('全員配置済みなら空を返す', () => {
    const state = createSeedState();
    const proposal = proposeAssignments(state);
    const full = { ...state, assignments: { ...state.assignments, ...proposal } };
    expect(proposeAssignments(full)).toEqual({});
  });
});
