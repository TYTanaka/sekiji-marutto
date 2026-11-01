import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * 描画例外でアプリ全体が白画面になるのを防ぐ。
 * データは自動保存されているため、再読み込みやトップへの移動で復旧できることを案内する。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // 診断用にコンソールへ残す（ユーザー向け表示はフォールバック側）
    console.error('sekiji-marutto render error', error);

    // デプロイ直後の古いタブでは、遅延読み込みチャンクが 404 になることがある。
    // その場合は一度だけ自動で再読み込みして新しいファイルを取り直す。
    const message = error instanceof Error ? error.message : String(error);
    if (/dynamically loaded|ChunkLoadError|Importing a module script failed|Failed to fetch/i.test(message)) {
      try {
        const KEY = 'sekiji-chunk-reload-at';
        const last = Number(sessionStorage.getItem(KEY) ?? 0);
        if (Date.now() - last > 30_000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        // sessionStorage が使えない環境では通常のフォールバック表示に任せる
      }
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="landing">
        <section className="card landing-card">
          <div className="landing-body">
            <h1 className="auth-page-title">画面を表示できませんでした</h1>
            <p className="muted">
              一時的な問題が発生しました。入力したデータは自動で保存されています。
              再読み込みするか、トップページから開き直してください。
            </p>
            <div className="auth-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.location.reload()}
              >
                再読み込みする
              </button>
              <a className="btn-ghost" href="#/">
                トップページへ戻る
              </a>
            </div>
          </div>
        </section>
      </main>
    );
  }
}
