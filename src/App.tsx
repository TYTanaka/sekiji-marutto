import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AppStateProvider, useAppState } from './store/appState';
import { supabase, cloudEnabled } from './lib/supabase';
import { parseRoute, navigateTo, type Route } from './lib/route';
import { clearDeviceScopedKeys } from './lib/deviceKeys';
import { Landing } from './components/Landing';
import { AuthPage } from './components/AuthPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './components/Dashboard';
import { GuestManager } from './components/GuestManager';
import { SeatingEditor } from './components/SeatingEditor';
import { Invitation } from './components/Invitation';
import { CloudSync } from './store/cloudSync';
import { UndoToast } from './components/UndoToast';

// 重い画面はルート/タブ単位で分割し、必要なときにだけ読み込む
const InviteLinks = lazy(() =>
  import('./components/InviteLinks').then((m) => ({ default: m.InviteLinks })),
);
const PrintView = lazy(() =>
  import('./components/PrintView').then((m) => ({ default: m.PrintView })),
);
const CheckinView = lazy(() =>
  import('./components/CheckinView').then((m) => ({ default: m.CheckinView })),
);
const TasksView = lazy(() =>
  import('./components/TasksView').then((m) => ({ default: m.TasksView })),
);
const RsvpPage = lazy(() => import('./components/RsvpPage'));

function ViewLoading() {
  return <p role="status">読み込んでいます…</p>;
}
import { createSeedState } from './lib/seed';
import { createLargeSeedState } from './lib/seedLarge';
import { downloadBackup, parseBackup } from './lib/backup';
import type { AppState } from './types';

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

/** スマホの下部バーに出す主要タブ（残りは「その他」にまとめる） */
const mobilePrimaryViews: View[] = ['dashboard', 'guests', 'seating', 'invitation', 'checkin'];
const mobileMoreViews: View[] = ['tasks', 'print', 'settings'];

const MOBILE_LABELS: Record<View, string> = {
  dashboard: '概要',
  guests: 'ゲスト',
  seating: '席次',
  invitation: '招待状',
  tasks: '準備',
  print: '印刷',
  checkin: '受付',
  settings: '設定',
};

function Shell({ demo, demoInitialState }: { demo: boolean; demoInitialState?: AppState }) {
  const { state, dispatch, dispatchWithUndo, savedAt, cloudPhase } = useAppState();
  const [view, setView] = useState<View>('dashboard');
  const [focusPending, setFocusPending] = useState(0);
  const { info } = state;

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // 画面を切り替えたら常に一番上から表示し、フォーカスも画面の先頭へ移す
  useEffect(() => {
    window.scrollTo(0, 0);
    panelRef.current?.focus({ preventScroll: true });
  }, [view]);

  // 本番モードではヘッダーにログイン中アカウントを表示する（認証フォームは置かない）
  useEffect(() => {
    if (demo || !cloudEnabled || !supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSessionEmail(data.session?.user.email ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSessionEmail(session?.user.email ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [demo]);

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    // 端末に残る式単位の補助データ（受付チェック等）は次の利用者に見せない
    clearDeviceScopedKeys();
    navigateTo('#/');
  }

  function resetDemo() {
    if (!demoInitialState) return;
    dispatchWithUndo(
      { type: 'hydrate', state: demoInitialState },
      'サンプルを元に戻しました',
    );
  }

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

  const [pendingBackup, setPendingBackup] = useState<AppState | null>(null);
  const [backupError, setBackupError] = useState('');
  const backupFileRef = useRef<HTMLInputElement | null>(null);

  async function handleBackupFile(file: File) {
    setBackupError('');
    const parsed = parseBackup(await file.text());
    if (!parsed) {
      setPendingBackup(null);
      setBackupError(
        'バックアップファイルを読み取れませんでした。席次まるっとで書き出したJSONファイルか確認してください。',
      );
      return;
    }
    setPendingBackup(parsed);
  }

  function cancelBackup() {
    setPendingBackup(null);
    if (backupFileRef.current) backupFileRef.current.value = '';
  }

  function applyBackup() {
    if (!pendingBackup) return;
    dispatchWithUndo(
      { type: 'hydrate', state: pendingBackup },
      'バックアップから復元しました',
    );
    cancelBackup();
  }

  function selectView(next: View) {
    setView(next);
    setMoreOpen(false);
  }

  const timeText = savedAt
    ? `${savedAt.getHours()}:${String(savedAt.getMinutes()).padStart(2, '0')}`
    : '';
  const saveText = demo
    ? ''
    : cloudPhase === 'syncing'
      ? 'クラウドへ保存中…'
      : cloudPhase === 'error'
        ? 'クラウド保存に失敗（この端末には保存済み）'
        : cloudPhase === 'synced'
          ? `✓ クラウドに保存済み ${timeText}`
          : savedAt
            ? `✓ 保存済み ${timeText}`
            : '';

  return (
    <>
      <header className="app-header">
        <a className="brand brand-link" href="#/">
          席次まるっと
        </a>
        {demo && <span className="demo-badge">デモ</span>}
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
        {demo ? (
          <span className="header-actions">
            <a className="btn-ghost auth-toggle" href="#/login">
              ログイン
            </a>
            <a className="btn-ghost auth-toggle" href="#/signup">
              新規登録
            </a>
          </span>
        ) : cloudEnabled ? (
          <span className="header-actions">
            {sessionEmail && <span className="account-email">{sessionEmail}</span>}
            <button type="button" className="btn-ghost auth-toggle" onClick={() => void logout()}>
              ログアウト
            </button>
          </span>
        ) : null}
      </header>

      <main className="main">
        {demo && bannerOpen && (
          <section className="demo-banner" aria-label="デモの案内">
            <p>
              <strong>デモ</strong>：架空のサンプルデータを使用しています。
              操作内容は保存されず、本番データに影響しません。再読み込みすると元のサンプルに戻ります。
              ゲストは実在の人物ではないため、個人情報を入力する必要はありません。
            </p>
            <div className="demo-banner-actions">
              <button type="button" className="btn btn-ghost" onClick={resetDemo}>
                サンプルを元に戻す
              </button>
              <a className="btn btn-ghost" href="#/">
                デモを終了してトップへ戻る
              </a>
              <a className="btn btn-primary" href="#/signup">
                新規登録して利用を始める
              </a>
              <button type="button" className="btn btn-ghost" onClick={() => setBannerOpen(false)}>
                小さく表示
              </button>
            </div>
          </section>
        )}
        {demo && !bannerOpen && (
          <div className="demo-bar" role="note">
            <span>デモ：架空のサンプルデータ（保存されません）</span>
            <span className="demo-bar-actions">
              <button type="button" className="btn-ghost demo-bar-btn" onClick={resetDemo}>
                元に戻す
              </button>
              <button type="button" className="btn-ghost demo-bar-btn" onClick={() => setBannerOpen(true)}>
                詳しく
              </button>
              <a className="btn-ghost demo-bar-btn" href="#/">
                終了
              </a>
            </span>
          </div>
        )}
        <div
          id="active-view"
          role="tabpanel"
          aria-labelledby={`tab-${view}`}
          ref={panelRef}
          tabIndex={-1}
        >
          {view === 'dashboard' && (
            <Dashboard
              onShowPending={() => { setView('guests'); setFocusPending((n) => n + 1); }}
              onShowPrint={() => setView('print')}
            />
          )}
          {view === 'guests' && <GuestManager focusPendingSignal={focusPending} />}
          {view === 'seating' && <SeatingEditor />}
          {view === 'invitation' && demo && (
            <>
              <section className="card">
                <h2>招待リンクについて（デモ）</h2>
                <p className="muted">
                  デモでは、本番用の招待リンクの発行・公開や、外部への送信はできません。
                  登録・ログインすると、ゲストごとの本物の招待リンクを発行して送れるようになります。
                  招待状そのものの見た目は、下のプレビューで確認できます。
                </p>
                <h3>ゲスト別リンク一覧の見本</h3>
                <div className="guest-row invite-row demo-sample-row">
                  <div>
                    <strong>高橋 誠</strong>{' '}
                    <span className="badge attending">出席</span>
                  </div>
                  <input
                    className="input"
                    type="text"
                    value="https://…/sekiji-marutto/#/rsvp/（ゲストごとの専用リンク）"
                    readOnly
                    aria-label="招待リンクの見本"
                  />
                  <p className="muted">
                    見本です。実際にはゲストごとに違うURLとQRコードが発行され、開封したかどうかも分かります。
                  </p>
                </div>
              </section>
              <Invitation />
            </>
          )}
          {view === 'invitation' && !demo && (
            <Suspense fallback={<ViewLoading />}>
              <InviteLinks />
              <Invitation />
            </Suspense>
          )}
          {view === 'tasks' && (
            <Suspense fallback={<ViewLoading />}>
              <TasksView />
            </Suspense>
          )}
          {view === 'print' && (
            <Suspense fallback={<ViewLoading />}>
              <PrintView />
            </Suspense>
          )}
          {view === 'checkin' && (
            <Suspense fallback={<ViewLoading />}>
              <CheckinView />
            </Suspense>
          )}
        </div>

        {view === 'settings' && (
          <section className="card settings-card" aria-labelledby="settings-title">
            <h2 id="settings-title">式の情報</h2>
            {demo && (
              <p className="muted">
                デモでは式の基本情報（新郎新婦名・挙式日・会場など）は固定で、編集できません。
                自分の結婚式の情報は、登録・ログイン後に設定できます。
              </p>
            )}
            <form onSubmit={(event) => event.preventDefault()}>
              <div className="form-grid">
                <label htmlFor="groom-name">
                  新郎のお名前
                  <input
                    id="groom-name"
                    type="text"
                    disabled={demo}
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
                    disabled={demo}
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
                    disabled={demo}
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
                    disabled={demo}
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
                    disabled={demo}
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
            {!demo && (
              <>
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
                    <button type="button" className="btn btn-ghost btn-block" onClick={() => setConfirmingLoad(true)}>
                      120名の大規模サンプルを読み込む
                    </button>
                  )}
                </div>
                <div className="backup-zone">
                  <h3>データのバックアップ</h3>
                  <p className="muted">
                    いまの準備データをJSONファイルに書き出しておくと、端末やブラウザを変えても復元できます。読み込むと現在のデータと置き換わりますが、実行直後であれば「元に戻す」で取り消せます。
                  </p>
                  <div className="backup-actions">
                    <button type="button" className="btn btn-ghost btn-block" onClick={() => downloadBackup(state)}>
                      バックアップを書き出す
                    </button>
                    <label className="btn btn-ghost btn-block backup-file-label">
                      バックアップを読み込む
                      <input
                        ref={backupFileRef}
                        type="file"
                        accept=".json,application/json"
                        hidden
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleBackupFile(file);
                        }}
                      />
                    </label>
                  </div>
                  {backupError && (
                    <p className="backup-error" role="alert">{backupError}</p>
                  )}
                  {pendingBackup && (
                    <div className="sample-confirm">
                      <span>{`「${pendingBackup.info.groomName} ・ ${pendingBackup.info.brideName}」のバックアップです。現在のデータは置き換わります。本当に読み込みますか？`}</span>
                      <button type="button" className="btn btn-primary" onClick={applyBackup}>
                        読み込む
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={cancelBackup}>
                        やめる
                      </button>
                    </div>
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
              </>
            )}
          </section>
        )}
      </main>

      <footer className="app-footer">
        <small className="muted">
          席次まるっと — ゲスト名簿・出欠・席次表をひとつに。
        </small>
      </footer>

      <nav className="mobile-tabbar" aria-label="メインメニュー（モバイル）">
        {mobilePrimaryViews.map((v) => (
          <button
            key={v}
            type="button"
            className={`mtab${view === v ? ' active' : ''}`}
            aria-current={view === v ? 'page' : undefined}
            onClick={() => selectView(v)}
          >
            {MOBILE_LABELS[v]}
          </button>
        ))}
        <button
          type="button"
          className={`mtab${mobileMoreViews.includes(view) ? ' active' : ''}`}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
        >
          その他
        </button>
        {moreOpen && (
          <div className="mobile-more">
            {mobileMoreViews.map((v) => (
              <button
                key={v}
                type="button"
                className={view === v ? 'active' : ''}
                onClick={() => selectView(v)}
              >
                {MOBILE_LABELS[v]}
              </button>
            ))}
          </div>
        )}
      </nav>
      <UndoToast />
    </>
  );
}

/** 本番管理画面（#/app）：未ログインならログインページへ案内する */
function AppGate() {
  const [status, setStatus] = useState<'loading' | 'in' | 'out'>(
    cloudEnabled ? 'loading' : 'in',
  );

  useEffect(() => {
    if (!cloudEnabled || !supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setStatus(data.session ? 'in' : 'out');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setStatus(session ? 'in' : 'out');
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status === 'out') navigateTo('#/login');
  }, [status]);

  if (status === 'loading') {
    return (
      <main className="landing">
        <p role="status">ログイン状態を確認しています…</p>
      </main>
    );
  }
  if (status === 'out') {
    return (
      <main className="landing">
        <p>
          本番の管理画面にはログインが必要です。ログインページへ移動します…
          <a href="#/login">ログイン</a>
        </p>
      </main>
    );
  }
  return (
    <AppStateProvider mode="app">
      <CloudSync />
      <Shell demo={false} />
    </AppStateProvider>
  );
}

function DemoRoute({ large }: { large: boolean }) {
  const [initial] = useState<AppState>(() =>
    large ? createLargeSeedState() : createSeedState(),
  );
  return (
    <AppStateProvider mode="demo" demoInitialState={initial}>
      <Shell demo demoInitialState={initial} />
    </AppStateProvider>
  );
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

const ROUTE_TITLES: Record<Route['name'], string> = {
  top: '席次まるっと | ゲスト名簿・出欠・席次表',
  demo: 'デモ | 席次まるっと',
  login: 'ログイン | 席次まるっと',
  signup: '新規登録 | 席次まるっと',
  app: '管理画面 | 席次まるっと',
  rsvp: 'ご招待 | 席次まるっと',
};

export default function App() {
  const route = useRoute();

  useEffect(() => {
    document.title = ROUTE_TITLES[route.name];
  }, [route.name]);

  let content: React.ReactNode;
  switch (route.name) {
    case 'rsvp':
      // ゲスト回答リンクは従来どおり維持する（発行済みリンクを壊さない）
      content = (
        <AppStateProvider mode="app">
          <CloudSync />
          <Suspense fallback={<ViewLoading />}>
            <RsvpPage token={route.token} />
          </Suspense>
        </AppStateProvider>
      );
      break;
    case 'demo':
      content = <DemoRoute key={route.large ? 'large' : 'normal'} large={route.large} />;
      break;
    case 'login':
      content = <AuthPage mode="login" />;
      break;
    case 'signup':
      content = <AuthPage mode="signup" />;
      break;
    case 'app':
      content = <AppGate />;
      break;
    default:
      content = <Landing />;
  }

  return <ErrorBoundary key={route.name}>{content}</ErrorBoundary>;
}
