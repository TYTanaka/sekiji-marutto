import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { cloudEnabled } from '../lib/config';
import { navigateTo } from '../lib/route';
import { SiteFooter } from './SiteFooter';

function japaneseError(error: { message: string }): string {
  if (/invalid login credentials|invalid credentials/i.test(error.message)) {
    return 'メールアドレスまたはパスワードが違います';
  }
  if (/already registered|already exists/i.test(error.message)) {
    return 'このメールアドレスはすでに登録されています。ログインをお試しください。';
  }
  return `エラーが発生しました：${error.message}`;
}

/**
 * ログイン / 新規登録の専用ページ。
 * 認証フォームはこのページにだけ置き、成功したら本番管理画面（#/app）へ進む。
 */
export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const isLogin = mode === 'login';
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!cloudEnabled || !supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function authenticate() {
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const credentials = { email: email.trim(), password };
      const { data, error: authError } = isLogin
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);
      if (authError) {
        setError(japaneseError(authError));
        return;
      }
      setPassword('');
      if (data.session) {
        setSession(data.session);
        navigateTo('#/app');
      } else if (!isLogin) {
        setNotice('確認メールを送信しました。メール内のリンクを開いてから、ログインページでログインしてください。');
      }
    } catch (cause: unknown) {
      setError(japaneseError({
        message: cause instanceof Error ? cause.message : String(cause),
      }));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!supabase || busy) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="landing">
      <section className="card landing-card auth-page-card">
        <div className="landing-body">
          <p className="inv-kicker">Wedding Preparation</p>
          <h1 className="auth-page-title">{isLogin ? 'ログイン' : '新規登録'}</h1>

          {!cloudEnabled ? (
            <p className="muted">
              この環境ではクラウド保存が設定されていないため、ログインは利用できません。
            </p>
          ) : loading ? (
            <p role="status">ログイン状態を確認しています…</p>
          ) : session ? (
            <div>
              <p>ログイン中：{session.user.email}</p>
              <p className="muted">データは自動でクラウドに保存されます。</p>
              <div className="auth-actions">
                <a className="btn-primary" href="#/app">管理画面を開く</a>
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => void logout()}>
                  ログアウト
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="muted">
                {isLogin
                  ? 'ログインすると、あなたの結婚式の準備データ（本番データ）が開きます。デモの内容は引き継がれません。'
                  : '登録すると、自分の結婚式の情報を入れて本番データを作れます。デモの内容は引き継がれません。'}
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void authenticate();
                }}
              >
                <fieldset disabled={busy} className="auth-fields">
                  <div className="field">
                    <label htmlFor="auth-email">メールアドレス</label>
                    <input
                      id="auth-email"
                      className="input"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="auth-password">パスワード</label>
                    <input
                      id="auth-password"
                      className="input"
                      type="password"
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                  <div className="auth-actions">
                    <button type="submit" className="btn-primary">
                      {busy ? '処理中…' : isLogin ? 'ログイン' : '新規登録'}
                    </button>
                  </div>
                  {!isLogin && (
                    <p className="auth-consent">
                      登録することで、<a href="#/terms">利用規約</a>と
                      <a href="#/privacy">プライバシーポリシー</a>
                      に同意したものとみなします。
                    </p>
                  )}
                </fieldset>
              </form>
              {error && <p role="alert">{error}</p>}
              {notice && <p role="status">{notice}</p>}
              <p className="auth-switch">
                {isLogin ? (
                  <>アカウントがない方は <a href="#/signup">新規登録</a></>
                ) : (
                  <>すでに登録済みの方は <a href="#/login">ログイン</a></>
                )}
              </p>
            </>
          )}

          <p className="auth-switch">
            <a href="#/">トップページへ戻る</a>
            {' ・ '}
            <a href="#/demo">登録せずデモで試す</a>
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
