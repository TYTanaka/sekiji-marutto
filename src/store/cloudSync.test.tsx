import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

// Supabase クライアントのモック：weddings テーブルの行・挿入・認証セッションを差し替える
const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  insertCalls: [] as { owner_id: string; state: unknown }[],
  session: null as null | { user: { id: string; email: string } },
}))

vi.mock('../lib/supabase', () => {
  const channelObj: Record<string, unknown> = {}
  channelObj.on = () => channelObj
  channelObj.subscribe = () => channelObj
  return {
    cloudEnabled: true,
    fetchOpens: vi.fn(async () => ({})),
    newInviteToken: () =>
      'inv-new' + Math.random().toString(36).slice(2, 10),
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: h.session },
          error: null,
        })),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: () => undefined } },
        })),
        signOut: vi.fn(async () => ({})),
      },
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: h.rows, error: null }),
            }),
          }),
        }),
        insert: (payload: { owner_id: string; state: unknown }) => {
          h.insertCalls.push(payload)
          return {
            select: () => ({
              single: async () => ({ data: { id: 'row-new' }, error: null }),
            }),
          }
        },
        update: () => ({ eq: async () => ({ error: null }) }),
      })),
      channel: vi.fn(() => channelObj),
      removeChannel: vi.fn(async () => ({})),
      rpc: vi.fn(async () => ({ data: null, error: null })),
    },
  }
})

import App from '../App'
import { createSeedState, createEmptyState } from '../lib/seed'
import type { AppState } from '../types'

const USER = { user: { id: 'user-1', email: 'couple@example.com' } }

describe('CloudSync（クラウド保存の分岐）', () => {
  beforeEach(() => {
    localStorage.clear()
    h.rows = []
    h.insertCalls = []
    h.session = USER
    window.location.hash = '#/app'
  })
  afterEach(() => {
    cleanup()
    window.location.hash = ''
  })

  it('クラウドに行がある場合はそのデータを読み込み、新規作成しない', async () => {
    const cloudState: AppState = {
      ...createEmptyState(),
      info: { ...createEmptyState().info, groomName: 'クラウド新郎', brideName: 'クラウド新婦' },
    }
    h.rows = [{ id: 'row-9', state: cloudState, updated_at: '2026-11-01T00:00:00Z' }]

    render(<App />)

    expect(await screen.findByText(/クラウド新郎/)).toBeTruthy()
    expect(h.insertCalls).toHaveLength(0)
    expect(screen.queryByText('この端末に保存されたデータがあります')).toBeNull()
  })

  it('行が無く端末に旧データがある場合は、勝手にアップロードせず取り込み確認を出す', async () => {
    const seed = createSeedState()
    localStorage.setItem('sekiji-state-v2', JSON.stringify(seed))

    render(<App />)

    expect(
      await screen.findByText('この端末に保存されたデータがあります'),
    ).toBeTruthy()
    // 本人が選ぶまでは挿入しない
    expect(h.insertCalls).toHaveLength(0)
  })

  it('取り込むと、サンプルの既知トークンは再発行されてから保存される', async () => {
    const seed = createSeedState()
    const seedToken = seed.guests[0].inviteToken
    localStorage.setItem('sekiji-state-v2', JSON.stringify(seed))

    render(<App />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'この端末のデータをクラウドに取り込む' }),
    )

    await vi.waitFor(() => expect(h.insertCalls).toHaveLength(1))
    const inserted = h.insertCalls[0].state as AppState
    expect(inserted.guests.length).toBe(seed.guests.length)
    expect(inserted.guests[0].inviteToken).not.toBe(seedToken)
    expect(inserted.guests[0].inviteToken.startsWith('inv-new')).toBe(true)
  })

  it('空ではじめると旧データは別名キーへ退避され、空の状態が保存される', async () => {
    const seed = createSeedState()
    const raw = JSON.stringify(seed)
    localStorage.setItem('sekiji-state-v2', raw)

    render(<App />)
    fireEvent.click(
      await screen.findByRole('button', { name: '空の状態ではじめる' }),
    )

    await vi.waitFor(() => expect(h.insertCalls).toHaveLength(1))
    const inserted = h.insertCalls[0].state as AppState
    expect(inserted.guests).toHaveLength(0)
    // 退避先には元の端末データ（内容）が残っていること
    const backup = JSON.parse(
      localStorage.getItem('sekiji-legacy-backup-v1') ?? 'null',
    ) as AppState | null
    expect(backup?.guests).toHaveLength(seed.guests.length)
    expect(backup?.info.groomName).toBe(seed.info.groomName)
    expect(raw).toContain('佐藤 健太')
  })

  it('行も端末データも無い新規ユーザーは、空の状態が自動で作られる', async () => {
    render(<App />)

    await vi.waitFor(() => expect(h.insertCalls).toHaveLength(1))
    const inserted = h.insertCalls[0].state as AppState
    expect(inserted.guests).toHaveLength(0)
    expect(screen.queryByText('この端末に保存されたデータがあります')).toBeNull()
  })
})

describe('AppGate（未ログインの振り分け）', () => {
  beforeEach(() => {
    localStorage.clear()
    h.rows = []
    h.insertCalls = []
    h.session = null
    window.location.hash = '#/app'
  })
  afterEach(() => {
    cleanup()
    window.location.hash = ''
  })

  it('未ログインで #/app を開くとログインページへ案内される', async () => {
    render(<App />)
    expect(
      await screen.findByRole('heading', { name: 'ログイン' }),
    ).toBeTruthy()
    expect(window.location.hash).toBe('#/login')
  })
})
