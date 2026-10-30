import { useEffect, useState } from 'react';
import { AppStateProvider, useAppState } from './store/appState';
import { Dashboard } from './components/Dashboard';
import { GuestManager } from './components/GuestManager';
import { SeatingEditor } from './components/SeatingEditor';
import { Invitation } from './components/Invitation';
import { InviteLinks } from './components/InviteLinks';
import { PrintView } from './components/PrintView';
import RsvpPage from './components/RsvpPage';
import { CloudSync } from './store/cloudSync';
import { AuthPanel } from './components/AuthPanel';

type View = 'dashboard' | 'guests' | 'seating' | 'invitation' | 'print';

const tabs: { view: View; label: string }[] = [
  { view: 'dashboard', label: '概要' },
  { view: 'guests', label: 'ゲスト・出欠' },
  { view: 'seating', label: '席次表' },
  { view: 'invitation', label: '招待状' },
  { view: 'print', label: '印刷' },
];

function Shell() {
  const { state, dispatch } = useAppState();
  const [view, setView] = useState<View>('dashboard');
  const { info } = state;

  function resetData() {
    if (window.confirm('すべてのデータを初期状態に戻します。よろしいですか？')) {
      dispatch({ type: 'reset' });
    }
  }

  return (
    <>
      <header className="app-header">
        <span className="brand">席次まるっと</span>
        <nav className="tabs" role="tablist" aria-label="メインメニュー">
          {tabs.map((tab) => (
            <button
              key={tab.view}
              id={`tab-${tab.view}`}
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
      </header>

      <main className="main">
        <AuthPanel />
        <div
          id="active-view"
          role="tabpanel"
          aria-labelledby={`tab-${view}`}
        >
          {view === 'dashboard' && <Dashboard />}
          {view === 'guests' && <GuestManager />}
          {view === 'seating' && <SeatingEditor />}
          {view === 'invitation' && (<><Invitation /><InviteLinks /></>)}
          {view === 'print' && <PrintView />}
        </div>

        {view !== 'print' && (
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
                <label htmlFor="wedding-message">
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
            <div className="danger-zone">
              <button type="button" className="btn-danger-ghost" onClick={resetData}>
                データを初期状態に戻す
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <small className="muted">
          席次まるっと — ゲスト名簿・出欠・席次表をひとつに。
        </small>
      </footer>
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
