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
  it('moveTask swaps tasks and stops at the edges', () => {
    const first = s.tasks[0]
    const moved = reducer(s, { type: 'moveTask', taskId: first.id, direction: 1 })
    expect(moved.tasks[1].id).toBe(first.id)
    const atTop = reducer(s, { type: 'moveTask', taskId: first.id, direction: -1 })
    expect(atTop).toBe(s)
  })
})

describe('hydrate', () => {
  it('replaces state with a valid cloud state', () => {
    const s = createSeedState()
    const other = { ...createSeedState(), guests: [] }
    expect(reducer(s, { type: 'hydrate', state: other }).guests).toHaveLength(0)
  })

  it('壊れた要素は落とし、不正な割り当ては除去する（白画面防止）', () => {
    const s = createSeedState()
    const broken = {
      ...createSeedState(),
      guests: [
        ...createSeedState().guests,
        { id: 123, name: 'idが数値' },
        null,
        { id: 'gx', name: '値が変なゲスト', side: 'alien', group: 'vip', rsvp: 'maybe', companions: 99 },
      ],
      assignments: {
        ...createSeedState().assignments,
        ghost: { tableId: 'table-a', seatIndex: 0 },
        g1: { tableId: 'no-such-table', seatIndex: 0 },
      },
    } as unknown as ReturnType<typeof createSeedState>
    const next = reducer(s, { type: 'hydrate', state: broken })
    expect(next.guests.some((g) => g.name === 'idが数値')).toBe(false)
    const odd = next.guests.find((g) => g.id === 'gx')
    expect(odd?.side).toBe('groom')
    expect(odd?.group).toBe('friends')
    expect(odd?.rsvp).toBe('pending')
    expect(odd?.companions).toBe(5)
    expect(next.assignments['ghost']).toBeUndefined()
    expect(next.assignments['g1']).toBeUndefined()
  })
})
