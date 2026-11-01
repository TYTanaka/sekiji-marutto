import { describe, it, expect } from 'vitest'
import { scopedDeviceKey, legacyScopedDeviceKey } from './deviceKeys'
import { createSeedState } from './seed'

describe('deviceKeys（端末キーの式分離）', () => {
  it('式の表示情報を編集してもキーは変わらない（localId基準）', () => {
    const s = createSeedState()
    const before = scopedDeviceKey('sekiji-checkin-v1', s)
    const renamed = {
      ...s,
      info: { ...s.info, groomName: '別の名前', date: '2028-01-01' },
    }
    expect(scopedDeviceKey('sekiji-checkin-v1', renamed)).toBe(before)
  })

  it('別の式（別のlocalId）とはキーが分かれる', () => {
    const a = createSeedState()
    const b = createSeedState()
    expect(scopedDeviceKey('sekiji-checkin-v1', a)).not.toBe(
      scopedDeviceKey('sekiji-checkin-v1', b),
    )
  })

  it('localIdが無い旧データでは表示情報の指紋にフォールバックする', () => {
    const s = createSeedState()
    const legacy = { ...s, localId: undefined }
    expect(scopedDeviceKey('sekiji-checkin-v1', legacy)).toBe(
      legacyScopedDeviceKey('sekiji-checkin-v1', s.info),
    )
  })
})
