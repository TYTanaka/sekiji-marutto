import { describe, it, expect } from 'vitest'
import { seatPosition, unassignedAttending, validateAssignment, tableFill, seatOccupant } from './seating'
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
  it('summarize counts companions in attending heads', () => {
    const sum = summarize(s)
    expect(sum.companions).toBe(1)
    expect(sum.attendingHeads).toBe(9)
  })
})

describe('companions seating', () => {
  const s = createSeedState()
  const withParty = {
    ...s,
    guests: s.guests.map((g) => (g.id === 'g7' ? { ...g, companions: 2 } : g)),
  }
  it('accepts a seat where the whole party fits', () => {
    expect(validateAssignment(withParty, 'g7', 'table-b', 5).ok).toBe(true)
  })
  it('rejects a seat where companions would overflow the table', () => {
    expect(validateAssignment(withParty, 'g7', 'table-b', 6).ok).toBe(false)
  })
  it('rejects a seat inside another party’s companion range', () => {
    const seated = {
      ...withParty,
      assignments: { ...withParty.assignments, g7: { tableId: 'table-b', seatIndex: 2 } },
    }
    const other = unassignedAttending(seated).find((g) => g.id !== 'g7')!
    expect(validateAssignment(seated, other.id, 'table-b', 3).ok).toBe(false)
  })
  it('tableFill counts companions as seated people', () => {
    const seated = {
      ...s,
      assignments: { ...s.assignments, g7: { tableId: 'table-b', seatIndex: 0 } },
    }
    expect(tableFill(seated, 'table-b')).toEqual({ seated: 2, seats: 8 })
  })
  it('seatOccupant marks companion seats', () => {
    const seated = {
      ...s,
      assignments: { ...s.assignments, g7: { tableId: 'table-b', seatIndex: 0 } },
    }
    expect(seatOccupant(seated, 'table-b', 0)).toMatchObject({ companion: false })
    expect(seatOccupant(seated, 'table-b', 1)).toMatchObject({
      companion: true,
      guest: { id: 'g7' },
    })
    expect(seatOccupant(seated, 'table-b', 2)).toBeUndefined()
  })
})
