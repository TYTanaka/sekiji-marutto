import { describe, it, expect, vi } from 'vitest'
import { registerServiceWorker } from './registerSw'

/** 型定義のない Node 組み込みモジュール経由で public/sw.js を読む（テスト実行時のみ） */
async function readSwSource(): Promise<string> {
  const specifier: string = 'node:fs'
  const fs = (await import(specifier)) as {
    readFileSync: (path: string, encoding: string) => string
  }
  return fs.readFileSync('public/sw.js', 'utf8')
}

describe('registerServiceWorker', () => {
  it('本番ビルドでは base 配下の sw.js を登録する', () => {
    const register = vi.fn(async () => ({}))
    registerServiceWorker({
      isProd: true,
      base: '/sekiji-marutto/',
      container: { register },
    })
    expect(register).toHaveBeenCalledWith('/sekiji-marutto/sw.js')
  })

  it('相対 base（./）でもそのまま sw.js を指す', () => {
    const register = vi.fn(async () => ({}))
    registerServiceWorker({ isProd: true, base: './', container: { register } })
    expect(register).toHaveBeenCalledWith('./sw.js')
  })

  it('開発ビルドでは登録しない', () => {
    const register = vi.fn(async () => ({}))
    registerServiceWorker({ isProd: false, base: './', container: { register } })
    expect(register).not.toHaveBeenCalled()
  })

  it('Service Worker 非対応環境では何もしない', () => {
    expect(() =>
      registerServiceWorker({ isProd: true, base: './', container: null }),
    ).not.toThrow()
    expect(() =>
      registerServiceWorker({ isProd: true, base: './', container: undefined }),
    ).not.toThrow()
  })

  it('登録が失敗しても例外を投げない', async () => {
    const register = vi.fn(async () => {
      throw new Error('registration failed')
    })
    expect(() =>
      registerServiceWorker({ isProd: true, base: './', container: { register } }),
    ).not.toThrow()
    // 非同期の reject も飲み込む（unhandled rejection にしない）
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})

describe('public/sw.js の方針', () => {
  it('キャッシュ名にバージョンを持ち、旧キャッシュを activate で破棄する', async () => {
    const swSource = await readSwSource()
    expect(swSource).toMatch(/const CACHE_NAME = 'sekiji-shell-v\d+'/)
    expect(swSource).toContain("addEventListener('activate'")
    expect(swSource).toContain('caches.delete')
  })

  it('遷移は network-first、アセットは cache-first で処理する', async () => {
    const swSource = await readSwSource()
    expect(swSource).toContain("request.mode === 'navigate'")
    expect(swSource).toContain('networkFirstNavigation')
    expect(swSource).toContain('cacheFirst')
  })

  it('別オリジンと GET 以外には関与しない', async () => {
    const swSource = await readSwSource()
    expect(swSource).toContain("request.method !== 'GET'")
    expect(swSource).toContain('url.origin !== self.location.origin')
  })
})
