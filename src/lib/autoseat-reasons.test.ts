import { describe, it, expect } from 'vitest'
import { proposeAssignmentsWithReasons } from './autoSeat'
import { createSeedState } from './seed'

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
})
