import { describe, it, expect } from 'vitest'
import { proposeAssignmentsWithReasons } from './autoSeat'
import { createSeedState } from './seed'
import { seatOccupant, validateAssignment } from './seating'

describe('proposeAssignmentsWithReasons', () => {
  it('全員に理由が付き、上座の理由が含まれる', () => {
    const state = createSeedState()
    const { assignments, reasons } = proposeAssignmentsWithReasons(state)
    const ids = Object.keys(assignments)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(reasons[id]?.length).toBeGreaterThan(0)
    }
    const allReasons = ids.flatMap((id) => reasons[id])
    expect(allReasons.some((r) => r.includes('上座'))).toBe(true)
  })

  it('同伴者のいるゲストは隣同士になる席に置かれ、理由にも出る', () => {
    const base = createSeedState()
    const state = {
      ...base,
      guests: base.guests.map((g) => (g.id === 'g7' ? { ...g, companions: 2 } : g)),
    }
    const { assignments, reasons } = proposeAssignmentsWithReasons(state)
    const placed = assignments['g7']
    expect(placed).toBeDefined()
    expect(reasons['g7']?.some((r) => r.includes('同伴者2名'))).toBe(true)
    const merged = { ...state, assignments: { ...state.assignments, ...assignments } }
    expect(validateAssignment(state, 'g7', placed.tableId, placed.seatIndex).ok).toBe(true)
    expect(seatOccupant(merged, placed.tableId, placed.seatIndex + 1)).toMatchObject({
      companion: true,
      guest: { id: 'g7' },
    })
    expect(seatOccupant(merged, placed.tableId, placed.seatIndex + 2)).toMatchObject({
      companion: true,
    })
  })
})
