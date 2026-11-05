import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// クラウド有効の本番相当で、招待の読み込みが通信エラーになるケースを検証する
const { fetchInvitationSpy, submitRsvpCloudSpy } = vi.hoisted(() => ({
  fetchInvitationSpy: vi.fn(),
  submitRsvpCloudSpy: vi.fn(async () => true),
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

const invitationData = {
  info: {
    groomName: '新郎',
    brideName: '新婦',
    date: '2027-05-01',
    venue: '青山ウェディングホール',
    message: 'ご出席をお待ちしております',
  },
  guest: {
    id: 'g-test',
    name: '山田 太郎',
    title: '',
    side: 'groom',
    group: 'friends',
    rsvp: 'pending',
    allergy: '',
    companions: 0,
    memo: '',
    inviteToken: 'inv-testtoken1',
  },
  seat: null,
}

describe('RSVP public page (cloud mode, load failure)', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchInvitationSpy.mockReset()
    window.history.pushState(null, '', '#/rsvp/inv-testtoken1')
  })
  afterEach(() => { cleanup(); window.history.pushState(null, '', '#/') })

  it('通信エラーでは「見つかりません」ではなく失敗文言と再読み込みボタンを出す', async () => {
    fetchInvitationSpy.mockRejectedValue(new Error('network'))
    render(<App />)
    expect(await screen.findByText(/読み込みに失敗しました/)).toBeTruthy()
    expect(screen.queryByText(/招待が見つかりませんでした/)).toBeNull()
    expect(screen.getByRole('button', { name: 'もう一度読み込む' })).toBeTruthy()
  })

  it('再読み込みボタンで読み込みを再実行し、成功すれば招待が表示される', async () => {
    fetchInvitationSpy
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(invitationData)
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'もう一度読み込む' }))
    expect(await screen.findByText(/青山ウェディングホール/)).toBeTruthy()
    expect(fetchInvitationSpy).toHaveBeenCalledTimes(2)
  })

  it('招待データが無い場合だけ「見つかりません」を出す', async () => {
    fetchInvitationSpy.mockResolvedValue(null)
    render(<App />)
    expect(await screen.findByText(/招待が見つかりませんでした/)).toBeTruthy()
    expect(screen.queryByText(/読み込みに失敗しました/)).toBeNull()
  })
})
