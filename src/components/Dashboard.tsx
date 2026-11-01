import { useState } from 'react';
import { useAppState, openedAtFor } from '../store/appState';
import { summarize, nextActionHint } from '../lib/stats';
import { tableFill } from '../lib/seating';
import {
  buildReminderMessage,
  buildOpenedReminderMessage,
  inviteUrlFor,
} from '../lib/reminder';
import { createDefaultTasks } from '../lib/tasks';
import { scopedDeviceKey } from '../lib/deviceKeys';
import type { Guest } from '../types';
import heroUrl from '../assets/hero.webp';

const SETUP_DONE_KEY = 'sekiji-setup-done-v1';
const SAMPLE_GROOM = '佐藤 健太';
const SAMPLE_BRIDE = '鈴木 美咲';

function daysUntil(iso: string): number | null {
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function Dashboard({ onShowPending, onShowPrint }: { onShowPending?: () => void; onShowPrint?: () => void }) {
  const { state, changes, clearChanges, opens, dispatch, dispatchWithUndo, mode } = useAppState();
  const isDemo = mode === 'demo';
  const sum = summarize(state);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const pendingGuests = state.guests.filter((g) => g.rsvp === 'pending');
  const openedPending = pendingGuests.filter((g) => openedAtFor(opens, g));
  const unopenedPending = pendingGuests.filter((g) => !openedAtFor(opens, g));
  const days = daysUntil(state.info.date);

  function reminderRow(guest: Guest, text: string) {
    if (isDemo) {
      // デモでは外部への送信・共有を行わない（名前の表示のみ）
      return (
        <div key={guest.id} className="guest-row">
          <span>{guest.name} 様</span>
        </div>
      );
    }
    return (
      <div key={guest.id} className="guest-row">
        <span>{guest.name} 様</span>
        <span className="row-actions">
          <button type="button" className="btn btn-ghost" onClick={() => void copyReminder(guest.id, text)}>
            {copiedId === guest.id ? 'コピーしました' : '催促文をコピー'}
          </button>
          <a className="btn line-btn" href={`https://line.me/R/msg/text/?${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
            LINEで送る
          </a>
        </span>
      </div>
    );
  }

  async function copyReminder(guestId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(guestId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  }

  // 初期設定カード： まだサンプルの式情報のままなら、自分の式で始める導線を出す
  const isSampleInfo =
    state.info.groomName === SAMPLE_GROOM && state.info.brideName === SAMPLE_BRIDE;
  const setupKey = scopedDeviceKey(SETUP_DONE_KEY, state);
  const [setupDone, setSetupDone] = useState<boolean>(() => {
    try {
      return localStorage.getItem(scopedDeviceKey(SETUP_DONE_KEY, state)) === '1';
    } catch {
      return false;
    }
  });
  const [setupForm, setSetupForm] = useState({
    groomName: '',
    brideName: '',
    date: '',
    venue: '',
  });
  const setupReady =
    setupForm.groomName.trim() !== '' &&
    setupForm.brideName.trim() !== '' &&
    setupForm.date !== '';
  // デモでは自分の式の情報を入れさせない（初期設定カードは本番専用）
  const showSetup = !isDemo && isSampleInfo && !setupDone;

  function setupInfo() {
    return {
      ...state.info,
      groomName: setupForm.groomName.trim(),
      brideName: setupForm.brideName.trim(),
      date: setupForm.date,
      venue: setupForm.venue.trim() || state.info.venue,
    };
  }

  function markSetupDone() {
    setSetupDone(true);
    try {
      localStorage.setItem(setupKey, '1');
    } catch {
      // Ignore storage failures.
    }
  }

  function startWithInfo() {
    dispatch({
      type: 'setInfo',
      info: setupInfo(),
    });
    markSetupDone();
  }

  function startFresh() {
    dispatchWithUndo(
      {
        type: 'hydrate',
        state: {
          ...state,
          info: setupInfo(),
          guests: [],
          assignments: {},
          tasks: createDefaultTasks(setupForm.date || state.info.date),
        },
      },
      '自分の式の情報で開始しました（ゲストは空です）',
    );
    markSetupDone();
  }

  return (
    <section className="view-enter">
      {showSetup && (
        <div className="card setup-card">
          <h2>自分の式の情報で始めましょう</h2>
          <p className="muted">
            いま表示されているのはサンプルの式です。お二人の情報を入れると、そのまま自分の準備データとして使い始められます。
          </p>
          <div className="setup-grid">
            <div className="field">
              <label htmlFor="setup-groom">新郎のお名前</label>
              <input
                id="setup-groom"
                className="input"
                placeholder="例：佐藤 健太"
                value={setupForm.groomName}
                onChange={(e) => setSetupForm({ ...setupForm, groomName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="setup-bride">新婦のお名前</label>
              <input
                id="setup-bride"
                className="input"
                placeholder="例：鈴木 美咲"
                value={setupForm.brideName}
                onChange={(e) => setSetupForm({ ...setupForm, brideName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="setup-date">挙式日</label>
              <input
                id="setup-date"
                className="input"
                type="date"
                value={setupForm.date}
                onChange={(e) => setSetupForm({ ...setupForm, date: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="setup-venue">会場</label>
              <input
                id="setup-venue"
                className="input"
                placeholder="例：青山ウェディングホール"
                value={setupForm.venue}
                onChange={(e) => setSetupForm({ ...setupForm, venue: e.target.value })}
              />
            </div>
          </div>
          <div className="setup-actions">
            <button type="button" className="btn btn-primary" onClick={startWithInfo} disabled={!setupReady}>
              この内容で始める（ゲストはサンプルのまま）
            </button>
            <button type="button" className="btn btn-ghost" onClick={startFresh} disabled={!setupReady}>
              ゲストを空にして始める
            </button>
            <button type="button" className="btn-ghost" onClick={markSetupDone}>
              あとで
            </button>
          </div>
        </div>
      )}
      <div className="hero-band">
        <img className="hero-band-img" src={heroUrl} alt="" aria-hidden="true" />
        <div className="hero-band-body">
          <p className="hero-kicker">Wedding Day</p>
          <p className="hero-names"><span className="nb">{state.info.groomName}</span> ＆ <span className="nb">{state.info.brideName}</span></p>
          <p className="hero-meta">{state.info.date.replaceAll('-', '/')} ・ {state.info.venue}</p>
          {days !== null && days >= 0 && <p className="hero-chip">挙式まで あと {days} 日</p>}
          {days !== null && days < 0 && <p className="hero-chip">ご結婚おめでとうございます</p>}
        </div>
      </div>
      {sum.pending > 0 && onShowPending ? (
        <button type="button" className="hint hint-action" onClick={onShowPending}>
          {nextActionHint(state)}（タップで未回答のゲスト一覧へ）
        </button>
      ) : (
        <div className="hint">{nextActionHint(state)}</div>
      )}

      <div className="grid-stats">
        <div className="stat-card">
          <div className="stat-num">{sum.replyRate}%</div>
          <div className="stat-label">回答率</div>
          <div className="progress">
            <i style={{ width: sum.replyRate + '%' }} />
          </div>
          <div className="stat-sub">
            {`${sum.replied} / ${sum.total} 名が回答済み`}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-num">{sum.attending} 名</div>
          <div className="stat-label">出席</div>
          {sum.companions > 0 && (
            <div className="stat-sub">{`同伴者を含む延べ ${sum.attendingHeads} 名`}</div>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-num">{sum.declined} 名</div>
          <div className="stat-label">欠席</div>
        </div>

        <div className="stat-card">
          <div className="stat-num">{sum.pending} 名</div>
          <div className="stat-label">未回答</div>
        </div>
      </div>

      {changes.length > 0 && (
        <div className="card changes-card">
          <div className="changes-head">
            <h2>最近の変更</h2>
            <button type="button" className="btn-ghost" onClick={clearChanges}>
              すべて確認済みにする
            </button>
          </div>
          <p className="muted changes-note">
            ゲストの回答内容にあった変更です。席次や式場への連絡に影響がないか確認してください。
          </p>
          <ul className="changes-list">
            {changes.slice(0, 8).map((change) => (
              <li key={change.id}>
                <span className="changes-when">
                  {(() => {
                    const d = new Date(change.at);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                  })()}
                </span>
                <span>
                  <strong>{change.guestName}</strong> さん：{change.text}
                </span>
              </li>
            ))}
          </ul>
          {changes.length > 8 && (
            <p className="muted">{`ほか ${changes.length - 8} 件の変更があります`}</p>
          )}
        </div>
      )}

      <div className="card">
        <h2>卓ごとの充足状況</h2>
        {state.tables.map((table) => {
          const { seated, seats } = tableFill(state, table.id);
          const percentage =
            seats > 0 ? Math.min(100, Math.max(0, (seated / seats) * 100)) : 0;

          return (
            <div key={table.id} className="table-fill">
              <div>
                <span>{table.name}</span>
                <span>{` ${seated} / ${seats} 名`}</span>
              </div>
              <div className="progress">
                <i style={{ width: percentage + '%' }} />
              </div>
            </div>
          );
        })}
        {sum.allSeated && (
          <div className="celebration">全員の席が決まりました。</div>
        )}
      </div>

      {pendingGuests.length > 0 && (
        <div className="card">
          <h2>未回答のゲストへの催促サポート</h2>
          {isDemo ? (
            <p className="muted">デモでは催促文の送信・共有はできません。登録・ログイン後の本番では、文面のコピーやLINE送信が使えます。</p>
          ) : (
            <p className="muted">そのまま送れる丁寧な文面を用意しました。コピーして普段の連絡手段で送るか、LINEで直接送れます。</p>
          )}
          {openedPending.length > 0 && (
            <>
              <h3 className="pending-subhead">リンクを開いたのに未回答（回答まであと一歩）</h3>
              <p className="muted">案内は見てもらえています。見た前提の短い文面で、そっと後押しします。</p>
              {openedPending.map((guest) =>
                reminderRow(guest, buildOpenedReminderMessage(guest, state.info, inviteUrlFor(guest.inviteToken))),
              )}
              {unopenedPending.length > 0 && (
                <h3 className="pending-subhead">まだリンクを開いていないゲスト</h3>
              )}
            </>
          )}
          {unopenedPending.map((guest) =>
            reminderRow(guest, buildReminderMessage(guest, state.info, inviteUrlFor(guest.inviteToken))),
          )}
        </div>
      )}

      {onShowPrint && (
        <div className="card">
          <h2>席次表の印刷・式場への提出</h2>
          <p className="muted">完成した席次表はA4で印刷でき、式場提出パック（ゲスト一覧＋変更差分）も作れます。</p>
          <button type="button" className="btn btn-primary" onClick={onShowPrint}>
            印刷ビューを開く
          </button>
        </div>
      )}
    </section>
  );
}
