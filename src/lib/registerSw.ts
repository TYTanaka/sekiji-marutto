/**
 * Service Worker の登録。
 * 本番ビルドでのみ登録する（開発サーバーでは登録しない）。
 * 登録に失敗してもアプリの動作には影響させない。
 */
export type ServiceWorkerContainerLike = {
  register: (scriptURL: string) => Promise<unknown>;
};

export function registerServiceWorker(options: {
  isProd: boolean;
  base: string;
  container?: ServiceWorkerContainerLike | null;
}): void {
  const { isProd, base, container } = options;
  if (!isProd || !container) return;
  try {
    void container.register(`${base}sw.js`).catch(() => undefined);
  } catch {
    // 登録できない環境でもアプリ自体は通常どおり動く
  }
}
