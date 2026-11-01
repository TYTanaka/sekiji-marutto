import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AppStateProvider } from './store/appState'
import { Invitation } from './components/Invitation'

describe('Invitation のゲスト体験フォーム（G-7）', () => {
  beforeEach(() => { localStorage.clear(); })
  afterEach(() => cleanup())

  it('本番モードでは体験用フォームが表示される', () => {
    render(
      <AppStateProvider mode="app">
        <Invitation />
      </AppStateProvider>,
    )
    expect(screen.getByText('ゲスト回答（体験用）')).toBeTruthy()
  })

  it('デモモードでは体験用フォームが表示されず、招待状デザインのみになる', () => {
    render(
      <AppStateProvider mode="demo">
        <Invitation />
      </AppStateProvider>,
    )
    expect(screen.queryByText('ゲスト回答（体験用）')).toBeNull()
    expect(screen.getByText('Wedding Invitation')).toBeTruthy()
  })
})
