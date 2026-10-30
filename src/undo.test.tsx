import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import App from './App'

describe('確認UIと元に戻す', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => cleanup())

  it('ゲスト削除はページ内確認を経て、元に戻すで復元できる', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'ゲスト・出欠' }))
    expect(screen.getByText(/12 名/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '高橋 誠さんを削除' }))
    // ページ内確認が出て、まだ削除されていない
    expect(screen.getByText('高橋 誠さんを削除しますか？')).toBeTruthy()
    expect(screen.getByText(/12 名/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '削除する' }))
    expect(screen.queryByText('高橋 誠')).toBeNull()
    expect(screen.getByText('高橋 誠さんを削除しました')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '元に戻す' }))
    expect(screen.getByText('高橋 誠')).toBeTruthy()
    expect(screen.getByText(/12 名/)).toBeTruthy()
  })

  it('保存状態がヘッダーに表示される', () => {
    render(<App />)
    expect(screen.getByText(/✓ 保存済み/)).toBeTruthy()
  })

  it('初期化もページ内確認を経る', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: '設定' }))
    fireEvent.click(screen.getByRole('button', { name: 'データを初期状態に戻す' }))
    expect(screen.getByText('本当に初期状態に戻しますか？')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'やめる' }))
    expect(screen.queryByText('本当に初期状態に戻しますか？')).toBeNull()
  })
})
