/**
 * ハッシュルーティング。
 * GitHub Pages のサブディレクトリ配信でも直接アクセス・再読み込みが壊れないよう、
 * 画面はすべて `#/...` で識別する（既存の `#/rsvp/<token>` と同方式）。
 */
export type Route =
  | { name: 'top' }
  | { name: 'demo'; large: boolean }
  | { name: 'login' }
  | { name: 'signup' }
  | { name: 'app' }
  | { name: 'rsvp'; token: string };

export function parseRoute(hash: string): Route {
  const rsvp = /^#\/rsvp\/(.+)$/.exec(hash);
  if (rsvp) return { name: 'rsvp', token: decodeURIComponent(rsvp[1]) };
  switch (hash) {
    case '#/demo':
      return { name: 'demo', large: false };
    case '#/demo/large':
      return { name: 'demo', large: true };
    case '#/login':
      return { name: 'login' };
    case '#/signup':
      return { name: 'signup' };
    case '#/app':
      return { name: 'app' };
    default:
      return { name: 'top' };
  }
}

export function navigateTo(path: string): void {
  if (window.location.hash === path) {
    // 同じハッシュへの遷移は hashchange が発火しないため、明示的に通知する
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = path;
}
