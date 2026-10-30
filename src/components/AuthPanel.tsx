import { useEffect, useState } from 'react';
import { supabase, cloudEnabled } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

function japaneseError(error: { message: string }): string {
  if (/invalid login credentials|invalid credentials/i.test(error.message)) {
    return 'メールアドレスまたはパスワードが違います';
  }
  return `エラーが発生しました：${error.message}`;
}

export function AuthPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!cloudEnabled || !supabase) return;
    let active = true;
    let authChanged = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        authChanged = true;
        if (!active) return;
        setSession(nextSession);
        setLoading(false);
      },
    );
    void supabase.auth.getSession().then(
      ({ data, error: sessionError }) => {
        if (!active || authChanged) return;
        setSession(data.session);
        if (sessionError) setError(japaneseError(sessionError));
        setLoading(false);
      },
      (cause: unknown) => {
        if (!active || authChanged) return;
        setError(japaneseError({
          message: cause instanceof Error ? cause.message : String(cause),
        }));
        setLoading(false);
      },
    );
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!cloudEnabled) return null;

  async function authenticate(action: 'login' | 'signup') {
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const credentials = { email: email.trim(), password };
      const { data, error: authError } = action === 'login'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);
      if (authError) {
        setError(japaneseError(authError));
        return;
      }
      setSession(data.session);
      setPassword('');
      if (action === 'signup' && !data.session) {
        setNotice('確認メールを送信しました。メール内のリンクを開いてからログインしてください。');
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
    setError('');
    setNotice('');
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) setError(japaneseError(signOutError));
      else setSession(null);
    } catch (cause: unknown) {
      setError(japaneseError({
        message: cause instanceof Error ? cause.message : String(cause),
      }));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div role="status">ログイン状態を確認しています…</div>;

  if (session) {
    return (
      <div className="card" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span>ログイン中：{session.user.email}</span>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => void logout()}>
            ログアウト
          </button>
          <small>データは自動でクラウドに保存されます。</small>
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <section className="card" aria-labelledby="auth-panel-title">
      <h2 id="auth-panel-title">クラウド保存（ログイン）</h2>
      <p>ログインすると、データがクラウドに保存され、別の端末でも同じ内容を編集できます。ゲストへの招待リンクも本物になります。</p>
      <form onSubmit={(event) => { event.preventDefault(); void authenticate('login'); }}>
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
          <label htmlFor="auth-email">メールアドレス</label>
          <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="auth-password">パスワード</label>
          <input id="auth-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="submit" className="btn-primary">ログイン</button>
            <button type="submit" className="btn-ghost" onClick={(event) => {
              if (!event.currentTarget.form?.reportValidity()) return;
              event.preventDefault();
              void authenticate('signup');
            }}>新規登録</button>
          </div>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
