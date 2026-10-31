import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import App from './App'
import { createLargeSeedState } from './lib/seedLarge'

describe('印刷用席次表（大規模サンプル）', () => {
  beforeEach(() => {
    localStorage.clear(); localStorage.setItem('sekiji-entered-v1', '1')
    localStorage.setItem('sekiji-state-v2', JSON.stringify(createLargeSeedState()))
  })
  afterEach(() => cleanup())

  it('末尾の空席は1行に集約され、卓見出しの数と矛盾しない', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: '印刷' }))
    // 大規模サンプル: 同伴者を含む延べ人数で 8/8の卓が7（A〜G卓）、7/8の卓が8（H〜O卓）
    // 7/8の卓は「（空席 ×1）」が1行だけ出て、「（空席 ×2）」は出ない
    expect(screen.queryAllByText('（空席 ×2）')).toHaveLength(0)
    expect(screen.getAllByText('（空席 ×1）')).toHaveLength(8)
  })
})
