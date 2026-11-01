import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'

// 本番ビルド相当（クラウド有効）でも、デモの見本プレビューがクラウドを
// 一切呼ばないことを検証するため、supabase をスパイ付きで差し替える
const { fetchInvitationSpy, submitRsvpCloudSpy } = vi.hoisted(() => ({
  fetchInvitationSpy: vi.fn(async () => null),
  submitRsvpCloudSpy: vi.fn(async () => false),
}))

vi.mock('./lib/config', () => ({
  cloudEnabled: true,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
}))

vi.mock('./lib/supabase', () => ({
  cloudEnabled: true,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signInWithPassword: async () => ({ data: { session: null }, error: null }),
      signUp: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
    },
    rpc: async () => ({ data: null, error: null }),
  },
  fetchInvitation: fetchInvitationSpy,
  submitRsvpCloud: submitRsvpCloudSpy,
  fetchOpens: async () => ({}),
  newInviteToken: () => 'inv-testtoken1',
}))

import App from './App'

/** jsdom では location.hash の連続代入が非同期に潰れることがあるため pushState で同期的に切り替える */
function setHash(hash: string) {
  window.history.pushState(null, '', hash || '#/')
}

function openDemoInvitation() {
  setHash('#/demo')
  render(<App />)
  fireEvent.click(screen.getByRole('tab', { name: '招待状' }))
}

async function openPreview() {
  openDemoInvitation()
  fireEvent.click(screen.getByRole('button', { name: 'ゲスト画面を見てみる' }))
  // 回答ページは遅延読み込みされるため、表示を待つ
  await screen.findByText(/高橋 誠 様/)
}

function guestRow(name: string) {
  const row = screen.getByText(name).closest('.guest-row')
  if (!row) throw new Error(`guest row not found: ${name}`)
  return within(row as HTMLElement)
}

describe('デモのゲスト画面プレビュー（F-1）', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchInvitationSpy.mockClear()
    submitRsvpCloudSpy.mockClear()
    setHash('#/')
  })
  afterEach(() => {
    cleanup()
    setHash('#/')
  })

  it('見本ボタンから回答ページが開き、招待状・席の案内・見本チップが表示される', async () => {
    await openPreview()
    // 招待状デザイン（式場・宛名）と、着席済みゲストの席ピル
    expect(screen.getByText(/青山ウェディングホール/)).toBeTruthy()
    expect(screen.getByText(/お席のご案内： A卓 1番席/)).toBeTruthy()
    // 見本であることの明示
    expect(screen.getByText('ゲスト画面の見本（デモ）')).toBeTruthy()
    expect(screen.getByText(/実際には送信されず、デモの中だけで反映されます/)).toBeTruthy()
    // サンプル（高橋 誠）は回答済みのため、前回回答が出席として選択されている
    expect(screen.getByRole('button', { name: '出席' }).getAttribute('aria-pressed')).toBe('true')
    // 本番データには触れず、クラウドも呼ばない
    expect(localStorage.getItem('sekiji-state-v2')).toBeNull()
    expect(fetchInvitationSpy).not.toHaveBeenCalled()
    expect(submitRsvpCloudSpy).not.toHaveBeenCalled()
  })

  it('回答すると確認画面（クレジット付き）が出て、デモのゲスト一覧に反映される', async () => {
    await openPreview()
    fireEvent.click(screen.getByRole('button', { name: '欠席' }))
    fireEvent.change(screen.getByLabelText('アレルギー'), { target: { value: '卵' } })
    fireEvent.click(screen.getByRole('button', { name: '送信する' }))

    expect(await screen.findByText('回答を受け付けました')).toBeTruthy()
    expect(screen.getByText(/この招待状は/)).toBeTruthy()
    expect(screen.getByText(/回答がデモに反映されました/)).toBeTruthy()
    // 送信してもクラウドは呼ばない（デモ内だけで完結）
    expect(submitRsvpCloudSpy).not.toHaveBeenCalled()
    expect(fetchInvitationSpy).not.toHaveBeenCalled()

    // デモに戻ると、ゲスト一覧で高橋 誠の回答が欠席に変わっている（連動）
    fireEvent.click(screen.getByRole('button', { name: 'デモに戻る' }))
    expect(screen.getByRole('button', { name: 'ゲスト画面を見てみる' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'ゲスト・出欠' }))
    expect(guestRow('高橋 誠').getByRole('button', { name: '欠席' }).getAttribute('aria-pressed')).toBe('true')
    expect(localStorage.getItem('sekiji-state-v2')).toBeNull()

    // 再読み込み（再マウント）するとデモは初期サンプルに戻る
    cleanup()
    setHash('#/demo')
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'ゲスト・出欠' }))
    expect(guestRow('高橋 誠').getByRole('button', { name: '出席' }).getAttribute('aria-pressed')).toBe('true')
    expect(localStorage.getItem('sekiji-state-v2')).toBeNull()
  })

  it('送信せずに戻ると回答は変わらない', async () => {
    await openPreview()
    fireEvent.click(screen.getByRole('button', { name: '欠席' }))
    fireEvent.click(screen.getByRole('button', { name: 'デモに戻る' }))
    fireEvent.click(screen.getByRole('tab', { name: 'ゲスト・出欠' }))
    expect(guestRow('高橋 誠').getByRole('button', { name: '出席' }).getAttribute('aria-pressed')).toBe('true')
    expect(submitRsvpCloudSpy).not.toHaveBeenCalled()
    expect(localStorage.getItem('sekiji-state-v2')).toBeNull()
  })
})
