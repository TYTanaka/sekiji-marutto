import { useState } from 'react';
import { useAppState } from '../store/appState';
import { summarize, nextActionHint } from '../lib/stats';
import { tableFill } from '../lib/seating';
import { buildReminderMessage, inviteUrlFor } from '../lib/reminder';
import heroUrl from '../assets/hero.jpg';

function daysUntil(iso: string): number | null {
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function Dashboard({ onShowPending }: { onShowPending?: () => void }) {
  const { state, changes, clearChanges } = useAppState();
  const sum = summarize(state);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const pendingGuests = state.guests.filter((g) => g.rsvp === 'pending');
  const days = daysUntil(state.info.date);

  async function copyReminder(guestId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(guestId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <section className="view-enter">
      <div className="hero-band">
        <img className="hero-band-img" src={heroUrl} alt="" aria-hidden="true" />
        <div className="hero-band-body">
          <p className="hero-kicker">Wedding Day</p>
          <p className="hero-names">{state.info.groomName} ＆ {state.info.brideName}</p>
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
          <p className="muted">そのまま送れる丁寧な文面を用意しました。コピーして普段の連絡手段で送るか、LINEで直接送れます。</p>
          {pendingGuests.map((guest) => {
            const url = inviteUrlFor(guest.inviteToken);
            const text = buildReminderMessage(guest, state.info, url);
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
          })}
        </div>
      )}
    </section>
  );
}
