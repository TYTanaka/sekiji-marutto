import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// 認証ページ（同意文）まで検証するため、クラウド有効・未ログインとして差し替える
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

/** jsdom では location.hash の連続代入が非同期に潰れることがあるため pushState で同期的に切り替える */
function setHash(hash: string) {
  window.history.pushState(null, '', hash || '#/')
}

describe('法務ページと公開導線', () => {
  beforeEach(() => {
    localStorage.clear()
    setHash('#/')
  })
  afterEach(() => {
    cleanup()
    setHash('#/')
  })

  it('トップのフッターにポリシー・規約・問い合わせのリンクがある', () => {
    render(<App />)
    const privacy = screen.getByRole('link', { name: 'プライバシーポリシー' })
    expect(privacy.getAttribute('href')).toBe('#/privacy')
    const terms = screen.getByRole('link', { name: '利用規約' })
    expect(terms.getAttribute('href')).toBe('#/terms')
    const contact = screen.getByRole('link', { name: 'お問い合わせ' })
    expect(contact.getAttribute('href')).toBe('mailto:yuuki20170731@gmail.com')
  })

  it('プライバシーポリシーがURLで開け、収集情報と削除の案内が載っている', async () => {
    setHash('#/privacy')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'プライバシーポリシー' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '1. 取得する情報' })).toBeTruthy()
    expect(screen.getByText(/アレルギー情報/)).toBeTruthy()
    expect(screen.getByText(/招待リンクの開封記録/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: '5. 保存期間と削除' })).toBeTruthy()
    // アカウント削除はアプリ内で完結せず、窓口経由であることが明記されている
    expect(screen.getByText(/アカウント自体の削除/)).toBeTruthy()
    expect(screen.getByText(/アクセス解析ツールや広告を目的としたトラッキングは使用していません/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'トップページへ戻る' }).getAttribute('href')).toBe('#/')
  })

  it('利用規約がURLで開け、禁止事項・免責・準拠法が載っている', async () => {
    setHash('#/terms')
    render(<App />)
    expect(await screen.findByRole('heading', { name: '利用規約' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '5. 禁止事項' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '6. 免責事項' })).toBeTruthy()
    expect(screen.getByText(/日本法に準拠/)).toBeTruthy()
    expect(screen.getByText(/本サービスは無料で提供します/)).toBeTruthy()
    // 規約からポリシーへ辿れる（本文リンク＋フッター）
    const privacyLinks = screen.getAllByRole('link', { name: 'プライバシーポリシー' })
    expect(privacyLinks.some((a) => a.getAttribute('href') === '#/privacy')).toBe(true)
  })

  it('新規登録には同意文が、ログインには同意文がない', async () => {
    setHash('#/signup')
    render(<App />)
    expect(await screen.findByRole('heading', { name: '新規登録' })).toBeTruthy()
    expect(await screen.findByText(/登録することで、/)).toBeTruthy()
    expect(screen.getByText(/に同意したものとみなします/)).toBeTruthy()
    // 認証ページにもフッターの法務リンクがある
    expect(screen.getByRole('link', { name: 'お問い合わせ' }).getAttribute('href')).toBe(
      'mailto:yuuki20170731@gmail.com',
    )
  })

  it('ログイン画面には同意文は出ない', async () => {
    setHash('#/login')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'ログイン' })).toBeTruthy()
    expect(screen.queryByText(/に同意したものとみなします/)).toBeNull()
    expect(screen.getByRole('link', { name: 'プライバシーポリシー' }).getAttribute('href')).toBe('#/privacy')
  })
})
