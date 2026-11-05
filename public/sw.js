/* 席次まるっと Service Worker
 *
 * 役割は「オフラインでもアプリの画面（シェル）が開く」ことに限る。
 * - 遷移（HTML）: network-first。オンライン時は常に最新を取りに行き、
 *   取得できたらキャッシュを更新。失敗時のみキャッシュで応答する。
 * - ハッシュ付きアセット（JS/CSS/画像/フォント）: cache-first。
 *   ファイル名にハッシュが入るため、古い版が居座る心配がない。
 * - 別オリジン（フォントCDN・Supabase API等）と GET 以外は一切関与しない。
 *
 * キャッシュを捨てたいときは CACHE_NAME のバージョンを上げること。
 */
const CACHE_NAME = 'sekiji-shell-v1';
const CACHE_PREFIX = 'sekiji-';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // スコープ直下（= アプリの入口HTML）を先読みしておく
      await cache.add(self.registration.scope);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(self.registration.scope, response.clone());
    }
    return response;
  } catch {
    const cached =
      (await cache.match(self.registration.scope)) ??
      (await cache.match(new URL('./index.html', self.registration.scope).href));
    if (cached) return cached;
    throw new Error('offline and no cached shell');
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  const isAsset =
    url.pathname.includes('/assets/') ||
    ['script', 'style', 'image', 'font'].includes(request.destination);
  if (isAsset) {
    event.respondWith(cacheFirst(request));
  }
});
