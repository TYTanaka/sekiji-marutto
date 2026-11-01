import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// 認証ページの分離を検証するため、クラウド有効・未ログインとして supabase を差し替える
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
  fetchInvitation: async () => null,
  submitRsvpCloud: async () => false,
  fetchOpens: async () => ({}),
  newInviteToken: () => 'inv-testtoken1',
}))

import App from './App'

const STORED_STATE = JSON.stringify({
  version: 2,
  guests: [],
  tables: [],
  assignments: {},
  info: { groomName: 'A', brideName: 'B', date: '2027-04-18', venue: 'V', message: '' },
  tasks: [],
})

/** jsdom では location.hash の連続代入が非同期に潰れることがあるため pushState で同期的に切り替える */
function setHash(hash: string) {
  window.history.pushState(null, '', hash || '#/')
}

describe('画面分離（トップ/デモ/ログイン/本番）', () => {
  beforeEach(() => {
    localStorage.clear()
    setHash('#/')
  })
  afterEach(() => {
    cleanup()
    setHash('#/')
  })

  it('トップは常に表示され、見るだけで本番データは保存されない', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: '席次表とWeb招待状を、ひとつに。' })).toBeTruthy()
    expect(screen.getByText('ゲスト別リンクで出欠収集')).toBeTruthy()
    expect(screen.queryByRole('tab', { name: '概要' })).toBeNull()
    // トップを見ただけでサンプルが本番保存領域に書かれない
    expect(localStorage.getItem('sekiji-state-v2')).toBeNull()
  })

  it('保存データがある再訪でも、トップURLでは説明ページが出る', () => {
    localStorage.setItem('sekiji-state-v2', STORED_STATE)
    render(<App />)
    expect(screen.getByRole('heading', { name: '席次表とWeb招待状を、ひとつに。' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: '概要' })).toBeNull()
    // 旧データは消されず保持される
    expect(localStorage.getItem('sekiji-state-v2')).toBe(STORED_STATE)
  })

  it('デモはURLで開け、操作しても本番保存領域に書き込まれない', () => {
    render(<App />)
    const demoLink = screen.getAllByRole('link', { name: 'デモで試してみる' })[0]
    expect(demoLink.getAttribute('href')).toBe('#/demo')
    setHash('#/demo')
    fireEvent(window, new Event('hashchange'))
    expect(screen.getByRole('tab', { name: '概要' })).toBeTruthy()
    expect(screen.getByText(/架空のサンプルデータを使用しています/)).toBeTruthy()
    expect(localStorage.getItem('sekiji-state-v2')).toBeNull()

    // デモでは式の基本情報は編集できない
    fireEvent.click(screen.getByRole('tab', { name: '設定' }))
    const groom = screen.getByLabelText('新郎のお名前') as HTMLInputElement
    expect(groom.disabled).toBe(true)
    expect(groom.value).toBe('佐藤 健太')
    expect(localStorage.getItem('sekiji-state-v2')).toBeNull()
  })

  it('デモバナーは概要で展開・他画面でスリムが初期状態になり、手動切替が優先される', () => {
    setHash('#/demo')
    render(<App />)
    // 概要では説明パネルが展開されている
    expect(screen.getByText(/再読み込みすると元のサンプルに戻ります/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '小さく表示' })).toBeTruthy()

    // ゲスト画面へ移動するとスリムバーになる
    fireEvent.click(screen.getByRole('tab', { name: 'ゲスト・出欠' }))
    expect(screen.queryByText(/再読み込みすると元のサンプルに戻ります/)).toBeNull()
    expect(screen.getByText(/デモ：架空のサンプルデータ（保存されません）/)).toBeTruthy()

    // 招待状でもスリムのまま、概要に戻ると再び展開される
    fireEvent.click(screen.getByRole('tab', { name: '招待状' }))
    expect(screen.queryByText(/再読み込みすると元のサンプルに戻ります/)).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: '概要' }))
    expect(screen.getByText(/再読み込みすると元のサンプルに戻ります/)).toBeTruthy()

    // 概要で手動で畳むと、画面を往復してもスリムのまま
    fireEvent.click(screen.getByRole('button', { name: '小さく表示' }))
    fireEvent.click(screen.getByRole('tab', { name: 'ゲスト・出欠' }))
    fireEvent.click(screen.getByRole('tab', { name: '概要' }))
    expect(screen.queryByText(/再読み込みすると元のサンプルに戻ります/)).toBeNull()
    expect(screen.getByText(/デモ：架空のサンプルデータ（保存されません）/)).toBeTruthy()

    // スリムな画面で手動で広げると、画面を移動しても展開のまま
    fireEvent.click(screen.getByRole('tab', { name: 'ゲスト・出欠' }))
    fireEvent.click(screen.getByRole('button', { name: '詳しく' }))
    expect(screen.getByText(/再読み込みすると元のサンプルに戻ります/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '招待状' }))
    expect(screen.getByText(/再読み込みすると元のサンプルに戻ります/)).toBeTruthy()
  })

  it('デモの招待状タブでは招待リンクを発行しない', () => {
    setHash('#/demo')
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: '招待状' }))
    expect(screen.getByText(/デモでは、本番用の招待リンクの発行・公開や、外部への送信はできません/)).toBeTruthy()
    expect(screen.queryByText('ゲスト別 招待リンク')).toBeNull()
  })

  it('ログイン専用ページがURLで開ける', async () => {
    setHash('#/login')
    render(<App />)
    // 認証ページは遅延読み込みされるため、表示を待つ
    expect(await screen.findByRole('heading', { name: 'ログイン' })).toBeTruthy()
    expect(await screen.findByRole('link', { name: '新規登録' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'トップページへ戻る' })).toBeTruthy()
    // 認証フォームはこの専用ページにだけある
    expect(screen.getByLabelText('メールアドレス')).toBeTruthy()
    expect(screen.getByLabelText('パスワード')).toBeTruthy()
  })

  it('新規登録専用ページがURLで開ける', async () => {
    setHash('#/signup')
    render(<App />)
    expect(await screen.findByRole('heading', { name: '新規登録' })).toBeTruthy()
    expect(await screen.findByRole('link', { name: 'ログイン' })).toBeTruthy()
  })
})
