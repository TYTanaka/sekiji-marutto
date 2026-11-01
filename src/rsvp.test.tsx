import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import App from './App'

describe('RSVP public page (local mode)', () => {
  beforeEach(() => { localStorage.clear(); })
  afterEach(() => { cleanup(); window.location.hash = '' })

  it('opens the invitation for a valid token and requires an explicit choice', async () => {
    window.location.hash = '#/rsvp/inv-1gx8qe64'
    render(<App />)
    // 回答ページは遅延読み込みされるため、表示を待つ
    expect(await screen.findByText(/青山ウェディングホール/)).toBeTruthy()
    const submit = screen.getByRole('button', { name: '送信する' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '出席' }))
    expect(submit.disabled).toBe(false)
  })

  it('keeps the confirmation screen after submitting (does not bounce back to the form)', async () => {
    window.location.hash = '#/rsvp/inv-1gx8qe64'
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '欠席' }))
    fireEvent.click(screen.getByRole('button', { name: '送信する' }))
    expect(screen.getByText('回答を受け付けました')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '送信する' })).toBeNull()
  })

  it('shows not-found for an unknown token', async () => {
    window.location.hash = '#/rsvp/inv-unknown00'
    render(<App />)
    expect(await screen.findByText(/招待が見つかりませんでした/)).toBeTruthy()
  })
})
