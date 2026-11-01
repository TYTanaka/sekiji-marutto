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
