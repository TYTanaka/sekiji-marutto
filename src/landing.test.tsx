import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import App from './App'

describe('初回トップページ', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => cleanup())

  it('初回は説明ページが出て、サンプルでアプリに入れる', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: '席次表とWeb招待状を、ひとつに。' })).toBeTruthy()
    expect(screen.getByText('ゲスト別リンクで出欠収集')).toBeTruthy()
    expect(screen.queryByRole('tab', { name: '概要' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'サンプルで試してみる' }))
    expect(screen.getByRole('tab', { name: '概要' })).toBeTruthy()
    expect(localStorage.getItem('sekiji-entered-v1')).toBe('1')
  })

  it('データがある再訪では説明ページを挟まない', () => {
    localStorage.setItem('sekiji-state-v2', JSON.stringify({ version: 2, guests: [], tables: [], assignments: {}, info: { groomName: 'A', brideName: 'B', date: '2027-04-18', venue: 'V', message: '' }, tasks: [] }))
    render(<App />)
    expect(screen.queryByRole('heading', { name: '席次表とWeb招待状を、ひとつに。' })).toBeNull()
    expect(screen.getByRole('tab', { name: '概要' })).toBeTruthy()
  })
})
