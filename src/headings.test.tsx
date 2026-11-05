import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import App from './App'

function setHash(hash: string) {
  window.history.pushState(null, '', hash || '#/')
}

/**
 * アプリ内画面の見出し構造：どのタブでも画面タイトルが h1 として1つだけ立ち、
 * h2 から始まる画面がないことを確認する。
 */
describe('アプリ内画面の見出し構造（h1）', () => {
  beforeEach(() => {
    localStorage.clear()
    setHash('#/')
  })
  afterEach(() => {
    cleanup()
    setHash('#/')
  })

  function openDemo() {
    setHash('#/demo')
    render(<App />)
  }

  function panelH1s(): HTMLElement[] {
    const panel = document.getElementById('active-view')
    if (!panel) throw new Error('active-view panel not found')
    return Array.from(panel.querySelectorAll('h1'))
  }

  it('概要タブでは主催者名が h1 になる', () => {
    openDemo()
    const h1s = panelH1s()
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toContain('佐藤 健太')
    expect(h1s[0].textContent).toContain('鈴木 美咲')
  })

  it('ゲスト・出欠タブに h1 がある', () => {
    openDemo()
    fireEvent.click(screen.getByRole('tab', { name: 'ゲスト・出欠' }))
    const h1s = panelH1s()
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toBe('ゲスト・出欠')
  })

  it('席次表タブに h1 がある', () => {
    openDemo()
    fireEvent.click(screen.getByRole('tab', { name: '席次表' }))
    const h1s = panelH1s()
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toBe('席次表')
  })

  it('招待状タブ（デモ）に h1 があり、招待状デザイン内の名前は h1 にならない', () => {
    openDemo()
    fireEvent.click(screen.getByRole('tab', { name: '招待状' }))
    const h1s = panelH1s()
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toBe('招待リンクについて（デモ）')
  })

  it('準備タブに h1 がある', async () => {
    openDemo()
    fireEvent.click(screen.getByRole('tab', { name: '準備' }))
    expect(await screen.findByRole('heading', { level: 1, name: '結婚式の準備タスク' })).toBeTruthy()
    expect(panelH1s()).toHaveLength(1)
  })

  it('当日受付タブに h1 がある', async () => {
    openDemo()
    fireEvent.click(screen.getByRole('tab', { name: '当日受付' }))
    expect(await screen.findByRole('heading', { level: 1, name: '当日受付' })).toBeTruthy()
    expect(panelH1s()).toHaveLength(1)
  })

  it('設定タブに h1 がある', () => {
    openDemo()
    fireEvent.click(screen.getByRole('tab', { name: '設定' }))
    // 設定ビューは #active-view の外に描画されるため文書全体から探す
    const h1s = Array.from(document.querySelectorAll('h1'))
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toBe('式の情報')
  })
})
