import { describe, expect, it } from 'vitest';
import { configuredDeadline, isDeadlinePassed } from './deadline';
import { createEmptyState } from './seed';

const base = createEmptyState();

function infoWith(rsvpDeadline?: string) {
  return { ...base.info, rsvpDeadline };
}

describe('回答期限（deadline）', () => {
  it('未設定なら期限なしとして扱う', () => {
    expect(configuredDeadline(infoWith(undefined))).toBeNull();
    expect(configuredDeadline(infoWith(''))).toBeNull();
    expect(isDeadlinePassed(infoWith(undefined))).toBe(false);
  });

  it('期限日その日はまだ回答できる（当日は受付中）', () => {
    const info = infoWith('2026-11-20');
    const noon = new Date(2026, 10, 20, 12, 0);
    const lateNight = new Date(2026, 10, 20, 23, 59);
    expect(isDeadlinePassed(info, noon)).toBe(false);
    expect(isDeadlinePassed(info, lateNight)).toBe(false);
  });

  it('期限日の翌日から締め切りになる', () => {
    const info = infoWith('2026-11-20');
    const nextDay = new Date(2026, 10, 21, 0, 0);
    expect(isDeadlinePassed(info, nextDay)).toBe(true);
  });

  it('期限より前は受付中', () => {
    const info = infoWith('2026-11-20');
    expect(isDeadlinePassed(info, new Date(2026, 10, 1))).toBe(false);
  });

  it('不正な文字列は期限なしとして扱う（締め切ってしまわない）', () => {
    expect(configuredDeadline(infoWith('not-a-date'))).toBeNull();
    expect(isDeadlinePassed(infoWith('2026-13-40'))).toBe(false);
  });
});
