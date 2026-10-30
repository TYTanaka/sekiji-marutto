import { describe, it, expect } from 'vitest'
import { reducer } from './appState'
import { createSeedState } from '../lib/seed'

describe('reducer', () => {
  const s = createSeedState()
  it('setRsvp to declined removes the seat assignment', () => {
    const next = reducer(s, { type: 'setRsvp', guestId: 'g1', rsvp: 'declined' })
    expect(next.assignments['g1']).toBeUndefined()
    expect(next.guests.find((g) => g.id === 'g1')?.rsvp).toBe('declined')
  })
  it('assign to an occupied seat leaves state unchanged', () => {
    const unseated = s.guests.find((g) => g.rsvp === 'attending' && !s.assignments[g.id])!
    const next = reducer(s, { type: 'assign', guestId: unseated.id, tableId: 'table-a', seatIndex: 0 })
    expect(next).toBe(s)
  })
  it('assign moves a seated guest to a new seat', () => {
    const next = reducer(s, { type: 'assign', guestId: 'g1', tableId: 'table-b', seatIndex: 2 })
    expect(next.assignments['g1']).toEqual({ tableId: 'table-b', seatIndex: 2 })
  })
  it('removeTable clears its assignments', () => {
    const next = reducer(s, { type: 'removeTable', tableId: 'table-a' })
    expect(Object.values(next.assignments).some((a) => a.tableId === 'table-a')).toBe(false)
  })
  it('removeGuest removes their assignment too', () => {
    const next = reducer(s, { type: 'removeGuest', guestId: 'g2' })
    expect(next.assignments['g2']).toBeUndefined()
    expect(next.guests.some((g) => g.id === 'g2')).toBe(false)
  })
})
