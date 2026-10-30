import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppStateProvider, useAppState } from './store/appState';
import { supabase, cloudEnabled } from './lib/supabase';
import { Landing } from './components/Landing';
import { Dashboard } from './components/Dashboard';
import { GuestManager } from './components/GuestManager';
import { SeatingEditor } from './components/SeatingEditor';
import { Invitation } from './components/Invitation';
import { InviteLinks } from './components/InviteLinks';
import { PrintView } from './components/PrintView';
import RsvpPage from './components/RsvpPage';
import { CloudSync } from './store/cloudSync';
import { AuthPanel } from './components/AuthPanel';
import { TasksView } from './components/TasksView';
import { CheckinView } from './components/CheckinView';
import { UndoToast } from './components/UndoToast';
import { createLargeSeedState } from './lib/seedLarge';

type View = 'dashboard' | 'guests' | 'seating' | 'invitation' | 'tasks' | 'print' | 'checkin' | 'settings';

const tabs: { view: View; label: string }[] = [
  { view: 'dashboard', label: '概要' },
  { view: 'guests', label: 'ゲスト・出欠' },
  { view: 'seating', label: '席次表' },
  { view: 'invitation', label: '招待状' },
  { view: 'tasks', label: '準備' },
  { view: 'print', label: '印刷' },
  { view: 'checkin', label: '当日受付' },
  { view: 'settings', label: '設定' },
];

const ENTERED_KEY = 'sekiji-entered-v1';
const STATE_KEY = 'sekiji-state-v2';

function Shell() {
  const { state, dispatch, dispatchWithUndo, savedAt, cloudPhase } = useAppState();
  const [view, setView] = useState<View>('dashboard');
  const [focusPending, setFocusPending] = useState(0);
  const { info } = state;

  const [entered, setEntered] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem(ENTERED_KEY) === '1' ||
        localStorage.getItem(STATE_KEY) !== null
      );
    } catch {
      return true;
    }
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const enterApp = useCallback(() => {
    try {
      localStorage.setItem(ENTERED_KEY, '1');
    } catch {
      // Storage unavailable; the in-memory state still enters the app.
    }
    setEntered(true);
  }, []);

  const handleSession = useCallback(
    (session: Session | null) => {
      setSessionEmail(session?.user.email ?? null);
      if (session) enterApp();
    },
    [enterApp],
  );

  useEffect(() => {
    if (entered || !cloudEnabled || !supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) handleSession(data.session);
    });
    return () => {
      active = false;
    };
  }, [entered, handleSession]);

  const [confirmingReset, setConfirmingReset] = useState(false);

  function resetData() {
    dispatchWithUndo({ type: 'reset' }, 'データを初期化しました');
    setConfirmingReset(false);
  }

  const [confirmingLoad, setConfirmingLoad] = useState(false);

  function loadLargeSample() {
    dispatchWithUndo(
      { type: 'hydrate', state: createLargeSeedState() },
      '120名の大規模サンプルを読み込みました',
    );
    setConfirmingLoad(false);
  }

  const timeText = savedAt
    ? `${savedAt.getHours()}:${String(savedAt.getMinutes()).padStart(2, '0')}`
    : '';
  const saveText =
    cloudPhase === 'syncing'
      ? 'クラウドへ保存中…'
      : cloudPhase === 'error'
        ? 'クラウド保存に失敗（この端末には保存済み）'
        : cloudPhase === 'synced'
          ? `✓ クラウドに保存済み ${timeText}`
          : savedAt
            ? `✓ 保存済み ${timeText}`
            : '';

  if (!entered) {
    return <Landing onTrySample={enterApp} onSessionChange={handleSession} />;
  }

  return (
    <>
      <header className="app-header">
        <span className="brand">席次まるっと</span>
        {saveText && (
          <span className="save-status" role="status">
            {saveText}
          </span>
        )}
        <nav className="tabs" role="tablist" aria-label="メインメニュー">
          {tabs.map((tab) => (
            <button
              key={tab.view}
              id={`tab-${tab.view}`}
              className="tab"
              type="button"
              role="tab"
              aria-selected={view === tab.view}
              aria-controls="active-view"
              onClick={() => setView(tab.view)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        {cloudEnabled && (
          <button
            type="button"
            className="btn-ghost auth-toggle"
            aria-expanded={authOpen}
            onClick={() => setAuthOpen((open) => !open)}
          >
            {sessionEmail ? 'アカウント' : 'ログイン / 新規登録'}
          </button>
        )}
      </header>

      <main className="main">
        {authOpen && cloudEnabled && (
          <div className="auth-popover">
            <AuthPanel onSessionChange={handleSession} />
          </div>
        )}
        <div
          id="active-view"
          role="tabpanel"
          aria-labelledby={`tab-${view}`}
        >
          {view === 'dashboard' && (<Dashboard onShowPending={() => { setView('guests'); setFocusPending((n) => n + 1); }} />)}
          {view === 'guests' && <GuestManager focusPendingSignal={focusPending} />}
          {view === 'seating' && <SeatingEditor />}
          {view === 'invitation' && (<><Invitation /><InviteLinks /></>)}
          {view === 'tasks' && <TasksView />}
          {view === 'print' && <PrintView />}
          {view === 'checkin' && <CheckinView />}
        </div>

        {view === 'settings' && (
          <section className="card settings-card" aria-labelledby="settings-title">
            <h2 id="settings-title">式の情報</h2>
            <form onSubmit={(event) => event.preventDefault()}>
              <div className="form-grid">
                <label htmlFor="groom-name">
                  新郎のお名前
                  <input
                    id="groom-name"
                    type="text"
                    value={info.groomName}
                    onChange={(event) =>
                      dispatch({
                        type: 'setInfo',
                        info: { ...info, groomName: event.target.value },
                      })
                    }
                  />
                </label>
                <label htmlFor="bride-name">
                  新婦のお名前
                  <input
                    id="bride-name"
                    type="text"
                    value={info.brideName}
                    onChange={(event) =>
                      dispatch({
                        type: 'setInfo',
                        info: { ...info, brideName: event.target.value },
                      })
                    }
                  />
                </label>
                <label htmlFor="wedding-date">
                  挙式日
                  <input
                    id="wedding-date"
                    type="date"
                    value={info.date}
                    onChange={(event) =>
                      dispatch({
                        type: 'setInfo',
                        info: { ...info, date: event.target.value },
                      })
                    }
                  />
                </label>
                <label htmlFor="wedding-venue">
                  会場
                  <input
                    id="wedding-venue"
                    type="text"
                    value={info.venue}
                    onChange={(event) =>
                      dispatch({
                        type: 'setInfo',
                        info: { ...info, venue: event.target.value },
                      })
                    }
                  />
                </label>
                <label htmlFor="wedding-message" className="field-wide">
                  メッセージ
                  <textarea
                    id="wedding-message"
                    rows={4}
                    value={info.message}
                    onChange={(event) =>
                      dispatch({
                        type: 'setInfo',
                        info: { ...info, message: event.target.value },
                      })
                    }
                  />
                </label>
              </div>
            </form>
            <div className="sample-zone">
              <h3>大規模サンプルの確認</h3>
              <p className="muted">
                120名・15卓の披露宴データを読み込んで、表示や席次の動作を確認できます。出席者は自動配置済みの状態で読み込まれます。
              </p>
              {confirmingLoad ? (
                <div className="sample-confirm">
                  <span>現在のデータは置き換わります（クラウド保存も同様）。本当に読み込みますか？</span>
                  <button type="button" className="btn btn-primary" onClick={loadLargeSample}>
                    読み込む
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmingLoad(false)}>
                    やめる
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmingLoad(true)}>
                  120名の大規模サンプルを読み込む
                </button>
              )}
            </div>
            <div className="danger-zone">
              <h3>データの初期化</h3>
              <p className="muted">
                すべてのゲスト・席次・式の情報が最初のサンプルに戻ります。クラウド保存している場合はそちらも初期化されます。実行直後であれば「元に戻す」で取り消せます。
              </p>
              {confirmingReset ? (
                <div className="sample-confirm">
                  <span>本当に初期状態に戻しますか？</span>
                  <button type="button" className="btn-danger" onClick={resetData}>
                    初期状態に戻す
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmingReset(false)}>
                    やめる
                  </button>
                </div>
              ) : (
                <button type="button" className="btn-danger-ghost" onClick={() => setConfirmingReset(true)}>
                  データを初期状態に戻す
                </button>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <small className="muted">
          席次まるっと — ゲスト名簿・出欠・席次表をひとつに。
        </small>
      </footer>
      <UndoToast />
    </>
  );
}

function useRsvpToken(): string | null {
  const [token, setToken] = useState<string | null>(() => parseRsvpToken());
  useEffect(() => {
    const onChange = () => setToken(parseRsvpToken());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return token;
}

function parseRsvpToken(): string | null {
  const match = /^#\/rsvp\/(.+)$/.exec(window.location.hash);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function App() {
  const rsvpToken = useRsvpToken();
  return (
    <AppStateProvider>
      <CloudSync />
      {rsvpToken ? <RsvpPage token={rsvpToken} /> : <Shell />}
    </AppStateProvider>
  );
}
