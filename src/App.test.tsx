import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import App from './App'

describe('App smoke', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => cleanup())

  it('renders the brand and dashboard hint for pending guests', () => {
    render(<App />)
    expect(screen.getByText('席次まるっと')).toBeTruthy()
    expect(screen.getByText(/未回答のゲストが2名/)).toBeTruthy()
  })

  it('guests view lists the seed guests', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'ゲスト・出欠' }))
    expect(screen.getByText('高橋 誠')).toBeTruthy()
    expect(screen.getByText(/12 名/)).toBeTruthy()
  })

  it('seating view shows 4 unassigned attending guests', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: '席次表' }))
    expect(screen.getByText(/未配置のゲスト/)).toBeTruthy()
  })

  it('invitation view shows the venue and couple names', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: '招待状' }))
    expect(screen.getByText(/青山ウェディングホール/)).toBeTruthy()
    expect(screen.getByText(/佐藤 健太/)).toBeTruthy()
  })
})
