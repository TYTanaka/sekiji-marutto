import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import App from './App'

describe('RSVP public page (local mode)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => { cleanup(); window.location.hash = '' })

  it('opens the invitation for a valid token and requires an explicit choice', () => {
    window.location.hash = '#/rsvp/inv-1gx8qe64'
    render(<App />)
    expect(screen.getByText(/青山ウェディングホール/)).toBeTruthy()
    const submit = screen.getByRole('button', { name: '送信する' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '出席' }))
    expect(submit.disabled).toBe(false)
  })

  it('shows not-found for an unknown token', () => {
    window.location.hash = '#/rsvp/inv-unknown00'
    render(<App />)
    expect(screen.getByText(/招待が見つかりませんでした/)).toBeTruthy()
  })
})
