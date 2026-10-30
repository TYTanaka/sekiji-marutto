import { describe, it, expect } from 'vitest'
import { seatPosition, unassignedAttending, validateAssignment, tableFill } from './seating'
import { summarize, nextActionHint } from './stats'
import { createSeedState } from './seed'

describe('seatPosition', () => {
  it('seat 0 is at the top center', () => {
    expect(seatPosition(0, 8)).toEqual({ x: 50, y: 12 })
  })
  it('positions are within the circle', () => {
    for (let i = 0; i < 8; i++) {
      const p = seatPosition(i, 8)
      expect(p.x).toBeGreaterThanOrEqual(12)
      expect(p.x).toBeLessThanOrEqual(88)
      expect(p.y).toBeGreaterThanOrEqual(12)
      expect(p.y).toBeLessThanOrEqual(88)
    }
  })
})

describe('seed + summarize', () => {
  const s = createSeedState()
  it('seed counts match the spec', () => {
    const sum = summarize(s)
    expect(sum.total).toBe(12)
    expect(sum.attending).toBe(8)
    expect(sum.pending).toBe(2)
    expect(sum.declined).toBe(2)
    expect(sum.replyRate).toBe(83)
  })
  it('4 attending guests start unseated', () => {
    expect(unassignedAttending(s)).toHaveLength(4)
    expect(summarize(s).allSeated).toBe(false)
  })
  it('hint mentions pending guests first', () => {
    expect(nextActionHint(s)).toContain('未回答')
  })
})

describe('validateAssignment', () => {
  const s = createSeedState()
  it('rejects an occupied seat', () => {
    const g = unassignedAttending(s)[0]
    const r = validateAssignment(s, g.id, 'table-a', 0)
    expect(r.ok).toBe(false)
  })
  it('accepts a free seat for an attending guest', () => {
    const g = unassignedAttending(s)[0]
    expect(validateAssignment(s, g.id, 'table-b', 0).ok).toBe(true)
  })
  it('rejects a declined guest', () => {
    const d = s.guests.find((x) => x.rsvp === 'declined')!
    expect(validateAssignment(s, d.id, 'table-b', 1).ok).toBe(false)
  })
  it('tableFill reports table A as 4 of 8', () => {
    expect(tableFill(s, 'table-a')).toEqual({ seated: 4, seats: 8 })
  })
})
