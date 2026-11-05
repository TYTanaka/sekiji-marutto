import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import App from './App'

describe('保存状態の表示（ローカル保存失敗時）', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('保存に失敗したら「保存済み」と表示せず、専用文言を出す', () => {
    // 端末の保存領域が使えない（容量超過など）状態を再現する
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    render(<App />)
    expect(screen.getByText('保存できませんでした')).toBeTruthy()
    expect(screen.queryByText(/✓ 保存済み/)).toBeNull()
    expect(screen.queryByText(/✓ クラウドに保存済み/)).toBeNull()
  })

  it('保存に成功したら従来どおり「✓ 保存済み」を出す', () => {
    render(<App />)
    expect(screen.getByText(/✓ 保存済み/)).toBeTruthy()
    expect(screen.queryByText('保存できませんでした')).toBeNull()
  })
})
