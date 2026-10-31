import { describe, it, expect } from 'vitest'
import { serializeBackup, parseBackup, backupFilename } from './backup'
import { createSeedState } from './seed'

describe('backup', () => {
  it('round-trips a seed state through serialize/parse', () => {
    const s = createSeedState()
    const parsed = parseBackup(serializeBackup(s))
    expect(parsed).toEqual(s)
  })

  it('rejects invalid JSON', () => {
    expect(parseBackup('not json {')).toBeNull()
    expect(parseBackup('')).toBeNull()
    expect(parseBackup('42')).toBeNull()
  })

  it('rejects a structurally invalid state (bad rsvp value)', () => {
    const s = createSeedState()
    const broken = {
      ...s,
      guests: s.guests.map((g, i) => (i === 0 ? { ...g, rsvp: 'maybe' } : g)),
    }
    expect(parseBackup(JSON.stringify({ app: 'sekiji-marutto', version: 1, state: broken }))).toBeNull()
  })

  it('rejects a state missing required info fields', () => {
    const s = createSeedState()
    const broken = { ...s, info: { groomName: 'A' } }
    expect(parseBackup(JSON.stringify(broken))).toBeNull()
  })

  it('accepts a bare state JSON without the backup wrapper', () => {
    const s = createSeedState()
    expect(parseBackup(JSON.stringify(s))).toEqual(s)
  })

  it('builds a dated filename, falling back when no date is set', () => {
    expect(backupFilename('2027-04-18')).toBe('sekiji-marutto-backup-2027-04-18.json')
    expect(backupFilename('')).toBe('sekiji-marutto-backup-data.json')
  })
})
