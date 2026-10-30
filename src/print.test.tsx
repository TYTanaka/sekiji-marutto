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
    // 大規模サンプル: 7/8の卓が11（A〜K卓）、6/8の卓が4（L〜O卓）
    // 6/8の卓は「（空席 ×2）」が1行だけ、7/8の卓は「（空席 ×1）」が1行だけ出る
    expect(screen.getAllByText('（空席 ×2）')).toHaveLength(4)
    expect(screen.getAllByText('（空席 ×1）')).toHaveLength(11)
  })
})
