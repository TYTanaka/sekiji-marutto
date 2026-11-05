import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { createSeedState } from './lib/seed'
import { createLargeSeedState } from './lib/seedLarge'
import { openedAtFor } from './store/appState'
import App from './App'

function setHash(hash: string) {
  window.history.pushState(null, '', hash || '#/')
}

describe('デモデータの開封記録（M-2）', () => {
  it('小規模デモの未回答ゲストに「開封済み」と「未開封」が混在する', () => {
    const state = createSeedState()
    const pending = state.guests.filter((g) => g.rsvp === 'pending')
    expect(pending.length).toBe(2)
    const opened = pending.filter((g) => openedAtFor({}, g))
    const unopened = pending.filter((g) => !openedAtFor({}, g))
    expect(opened.map((g) => g.name)).toEqual(['山本 悠介'])
    expect(unopened.map((g) => g.name)).toEqual(['中村 千尋'])
  })

  it('大規模デモの未回答ゲストにも開封済み・未開封が混在する', () => {
    const state = createLargeSeedState()
    const pending = state.guests.filter((g) => g.rsvp === 'pending')
    expect(pending.length).toBeGreaterThan(0)
    const opened = pending.filter((g) => openedAtFor({}, g))
    expect(opened.length).toBeGreaterThan(0)
    expect(opened.length).toBeLessThan(pending.length)
  })
})

describe('デモの概要：催促サポートの開封区分表示（M-2）', () => {
  beforeEach(() => {
    localStorage.clear()
    setHash('#/')
  })
  afterEach(() => {
    cleanup()
    setHash('#/')
  })

  it('未回答ゲストが「開いたのに未回答」と「まだ開いていない」に分かれて表示される', () => {
    setHash('#/demo')
    render(<App />)
    const card = screen
      .getByRole('heading', { name: '未回答のゲストへの催促サポート' })
      .closest('.card') as HTMLElement
    const scoped = within(card)
    const openedHead = scoped.getByText('リンクを開いたのに未回答（回答まであと一歩）')
    const unopenedHead = scoped.getByText('まだリンクを開いていないゲスト')
    const openedGuest = scoped.getByText('山本 悠介 様')
    const unopenedGuest = scoped.getByText('中村 千尋 様')
    // 開封済みセクション（見出し→該当ゲスト）が未開封セクションより前に並ぶ
    expect(
      openedHead.compareDocumentPosition(openedGuest) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      openedGuest.compareDocumentPosition(unopenedHead) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      unopenedHead.compareDocumentPosition(unopenedGuest) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
