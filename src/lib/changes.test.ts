import { describe, it, expect } from 'vitest'
import { diffGuests, groupChanges } from './changes'
import { createSeedState } from './seed'

const at = new Date('2026-10-31T03:00:00+09:00')

describe('diffGuests（変更レーダー）', () => {
  it('出欠・同伴者・アレルギーの変化を検出する', () => {
    const state = createSeedState()
    const target = state.guests.find((g) => g.rsvp === 'pending')!
    const next = state.guests.map((g) =>
      g.id === target.id ? { ...g, rsvp: 'declined' as const, companions: 2, allergy: '甲殻類' } : g,
    )
    const events = diffGuests(state.guests, next, at)
    expect(events.map((e) => e.kind)).toEqual(['rsvp', 'companions', 'allergy'])
    expect(events[0].text).toContain('未回答 → 欠席')
    expect(events[0].guestName).toBe(target.name)
  })

  it('変化がなければ空、追加・削除は無視する', () => {
    const state = createSeedState()
    expect(diffGuests(state.guests, state.guests, at)).toEqual([])
    const fewer = state.guests.slice(1)
    expect(diffGuests(state.guests, fewer, at)).toEqual([])
  })

  it('変更主体（ゲスト本人／主催者）がイベントに伝わる', () => {
    const state = createSeedState()
    const target = state.guests[0]
    const next = state.guests.map((g) =>
      g.id === target.id ? { ...g, rsvp: 'declined' as const } : g,
    )
    expect(diffGuests(state.guests, next, at, 'guest')[0].source).toBe('guest')
    expect(diffGuests(state.guests, next, at, 'host')[0].source).toBe('host')
    expect(diffGuests(state.guests, next, at)[0].source).toBeUndefined()
  })
})

describe('groupChanges（変更レーダーの集約）', () => {
  const state = createSeedState()
  const a = state.guests.find((g) => g.rsvp === 'pending') ?? state.guests[0]
  const b = state.guests.find((g) => g.id !== a.id)!

  function rsvpFlip(guest: typeof a, to: 'attending' | 'declined', t: number) {
    return diffGuests(
      state.guests,
      state.guests.map((g) => (g.id === guest.id ? { ...g, rsvp: to } : g)),
      new Date(t),
      'guest',
    )
  }

  it('同一ゲストの連続変更は「最終状態＋変更回数」に畳まれる', () => {
    // pending → attending → declined → attending の3回の回答変更が連続する
    const e1 = diffGuests(
      state.guests,
      state.guests.map((g) =>
        g.id === a.id ? { ...g, rsvp: 'attending' as const } : g,
      ),
      new Date(1000),
      'guest',
    )
    const e2 = rsvpFlip(a, 'declined', 2000)
    const e3 = rsvpFlip(a, 'attending', 3000)
    const groups = groupChanges([...e3, ...e2, ...e1]) // 新しい順
    expect(groups).toHaveLength(1)
    expect(groups[0].count).toBe(3)
    expect(groups[0].guestId).toBe(a.id)
    expect(groups[0].source).toBe('guest')
    // 最終状態（最新の文面）が残る
    expect(groups[0].texts[0]).toContain('出席')
  })

  it('別のゲストを挟むと連続扱いにならず別グループになる', () => {
    const e1 = diffGuests(
      state.guests,
      state.guests.map((g) =>
        g.id === a.id ? { ...g, allergy: 'えび' } : g,
      ),
      new Date(1000),
      'host',
    )
    const e2 = diffGuests(
      state.guests,
      state.guests.map((g) =>
        g.id === b.id ? { ...g, allergy: 'かに' } : g,
      ),
      new Date(2000),
      'host',
    )
    const e3 = diffGuests(
      state.guests,
      state.guests.map((g) =>
        g.id === a.id ? { ...g, allergy: 'そば' } : g,
      ),
      new Date(3000),
      'host',
    )
    const groups = groupChanges([...e3, ...e2, ...e1])
    expect(groups).toHaveLength(3)
    expect(groups.map((g) => g.guestId)).toEqual([a.id, b.id, a.id])
    expect(groups.every((g) => g.count === 1)).toBe(true)
  })

  it('同じ変更で複数項目が変わっても、項目ごとに最新だけが残る', () => {
    const first = diffGuests(
      state.guests,
      state.guests.map((g) =>
        g.id === a.id
          ? { ...g, rsvp: 'attending' as const, companions: 1 }
          : g,
      ),
      new Date(1000),
      'guest',
    )
    const second = diffGuests(
      state.guests.map((g) =>
        g.id === a.id
          ? { ...g, rsvp: 'attending' as const, companions: 1 }
          : g,
      ),
      state.guests.map((g) =>
        g.id === a.id ? { ...g, rsvp: 'declined' as const, companions: 0 } : g,
      ),
      new Date(2000),
      'guest',
    )
    const groups = groupChanges([...second, ...first])
    expect(groups).toHaveLength(1)
    expect(groups[0].count).toBe(4)
    // 種類ごとに最新だけが残る（出欠・同伴者の2件）で、出欠は最終状態（欠席）
    expect(groups[0].texts).toHaveLength(2)
    expect(groups[0].texts.some((t) => t.includes('欠席'))).toBe(true)
    expect(groups[0].texts.some((t) => t.includes('同伴者'))).toBe(true)
  })
})
