import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { AppStateProvider } from './store/appState'
import { SeatingEditor } from './components/SeatingEditor'

describe('SeatingEditor UX', () => {
  beforeEach(() => { localStorage.clear(); })
  afterEach(() => cleanup())

  it('occupied seat needs two taps to unassign', () => {
    const { container } = render(<AppStateProvider><SeatingEditor /></AppStateProvider>)
    expect(container.querySelectorAll('.chip').length).toBe(4)
    const seat = screen.getByRole('button', { name: /高橋 誠/ })
    fireEvent.click(seat)
    // first tap only arms: guest still seated (button still present with armed label)
    expect(screen.getByRole('button', { name: /高橋 誠/ })).toBeTruthy()
    expect(screen.getByText(/もう一度同じ席をタップ/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /高橋 誠/ }))
    // after second tap the guest returns to the unassigned chips
    expect(container.querySelectorAll('.chip').length).toBe(5)
  })
})
