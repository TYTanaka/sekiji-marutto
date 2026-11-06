import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import App from './App'
import { createSeedState } from './lib/seed'

const TOKEN = 'inv-1gx8qe64'

function seedWithDeadline(rsvpDeadline: string) {
  const seed = createSeedState()
  localStorage.setItem(
    'sekiji-state-v2',
    JSON.stringify({ ...seed, info: { ...seed.info, rsvpDeadline } }),
  )
}

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

  it('回答期限が設定されていれば、招待ページに期限が表示されフォームは開いている', async () => {
    seedWithDeadline('2099-12-31')
    window.location.hash = `#/rsvp/${TOKEN}`
    render(<App />)
    expect(
      await screen.findByText(/回答期限： 2099年12月31日.*までにご回答ください/),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: '送信する' })).toBeTruthy()
  })

  it('回答期限を過ぎていたらフォームは閉じられ、主催者への連絡が案内される', async () => {
    seedWithDeadline('2000-01-01')
    window.location.hash = `#/rsvp/${TOKEN}`
    render(<App />)
    expect(await screen.findByText('回答の受付は終了しました')).toBeTruthy()
    expect(
      screen.getByText(/主催者（新郎新婦）へ直接ご連絡ください/),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: '送信する' })).toBeNull()
    expect(screen.queryByRole('button', { name: '出席' })).toBeNull()
  })

  it('未送信の入力は下書きとして端末に残り、再訪時に復元される', async () => {
    localStorage.setItem(
      `sekiji-rsvp-draft-v1:${TOKEN}`,
      JSON.stringify({
        choice: 'attending',
        companions: 2,
        allergy: '小麦',
        memo: '下書きのメモ',
      }),
    )
    window.location.hash = `#/rsvp/${TOKEN}`
    render(<App />)
    expect(await screen.findByText(/下書きを復元しました/)).toBeTruthy()
    const attending = screen.getByRole('button', { name: '出席' })
    expect(attending.getAttribute('aria-pressed')).toBe('true')
    expect(
      (screen.getByLabelText(/アレルギー/) as HTMLInputElement).value,
    ).toBe('小麦')
    expect(
      (screen.getByLabelText(/メッセージ/) as HTMLTextAreaElement).value,
    ).toBe('下書きのメモ')
  })

  it('入力すると下書きが保存され、送信完了で下書きが消える', async () => {
    window.location.hash = `#/rsvp/${TOKEN}`
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '出席' }))
    fireEvent.change(screen.getByLabelText(/アレルギー/), {
      target: { value: '甲殻類' },
    })
    await vi.waitFor(() => {
      const raw = localStorage.getItem(`sekiji-rsvp-draft-v1:${TOKEN}`)
      expect(raw).toBeTruthy()
      expect(JSON.parse(raw!).allergy).toBe('甲殻類')
    })

    fireEvent.click(screen.getByRole('button', { name: '送信する' }))
    expect(await screen.findByText('回答を受け付けました')).toBeTruthy()
    expect(localStorage.getItem(`sekiji-rsvp-draft-v1:${TOKEN}`)).toBeNull()
  })
})
