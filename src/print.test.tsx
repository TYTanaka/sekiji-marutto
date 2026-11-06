import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import App from './App'
import { createLargeSeedState } from './lib/seedLarge'
import { seatOccupant } from './lib/seating'

describe('印刷用席次表（大規模サンプル）', () => {
  beforeEach(() => {
    localStorage.clear(); window.location.hash = '#/app'
    localStorage.setItem('sekiji-state-v2', JSON.stringify(createLargeSeedState()))
  })
  afterEach(() => cleanup())

  it('末尾の空席は1行に集約され、卓見出しの数と矛盾しない', async () => {
    const state = createLargeSeedState()
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: '印刷' }))
    // 印刷ビューは遅延読み込みされるため、卓見出しが出るまで待つ
    // （「席次表」はタブの文言にもあるため待機条件には使えない）
    expect(
      await screen.findByText(/A卓（/, {}, { timeout: 8000 }),
    ).toBeTruthy()
    // 末尾空席が k 個の卓は「（空席 ×k）」の集約行がちょうど卓の数だけ出る
    // （大規模サンプルは数名が未配置で始まるため、期待値はシードから算出する。
    //   占有判定は同伴者の席も含む seatOccupant に合わせる）
    const trailingByTable = state.tables.map((table) => {
      let lastOccupied = -1
      for (let i = 0; i < table.seats; i++) {
        if (seatOccupant(state, table.id, i)) lastOccupied = i
      }
      // 全席空席の卓は「（全席 空席 ×N）」と別表記になるため集計から除く
      if (lastOccupied === -1) return 0
      return table.seats - (lastOccupied + 1)
    })
    for (const k of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const expected = trailingByTable.filter((n) => n === k).length
      expect(screen.queryAllByText(`（空席 ×${k}）`)).toHaveLength(expected)
    }
  })
})
