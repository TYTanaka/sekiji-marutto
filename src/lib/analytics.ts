/**
 * 軽量アクセス計測（GoatCounter）。
 * エンドポイント（自分の計測コード）を設定するまでは何も送信しない。
 * 設定方法： goatcounter.com で無料登録し、発行されたエンドポイント
 * （例 https://<code>.goatcounter.com/count）を下記に貼る。
 */
export const GOATCOUNTER_ENDPOINT = '';

interface GoatCounter {
  count: (opts: { path: string }) => void;
}

declare global {
  interface Window {
    goatcounter?: GoatCounter;
  }
}

let loading = false;

export function loadAnalytics(): void {
  if (!GOATCOUNTER_ENDPOINT || loading) return;
  loading = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = '//gc.zgo.at/count.js';
  script.dataset.goatcounter = GOATCOUNTER_ENDPOINT;
  // 自動カウントは止め、ルート遷移に合わせて自前で数える（ハッシュルーティングのため）
  script.dataset.goatcounterSettings = JSON.stringify({ no_onload: true });
  document.head.appendChild(script);
}

export function trackPageView(): void {
  if (!GOATCOUNTER_ENDPOINT) return;
  const path = (window.location.hash || '#/') + window.location.search;
  let attempts = 0;
  const tryCount = () => {
    if (window.goatcounter) {
      window.goatcounter.count({ path });
    } else if (attempts < 10) {
      attempts += 1;
      window.setTimeout(tryCount, 300);
    }
  };
  tryCount();
}
