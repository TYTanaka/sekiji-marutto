import { describe, it, expect } from 'vitest'
import { diffGuests } from './changes'
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
})
