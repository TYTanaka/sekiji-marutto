import { useMemo, useState } from 'react';
import { useAppState } from '../store/appState';
import type { Guest } from '../types';

const CHECKIN_KEY = 'sekiji-checkin-v1';

function loadCheckins(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CHECKIN_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, boolean>;
      }
    }
  } catch {
    // Storage unavailable: check-ins just won't persist.
  }
  return {};
}

interface Row {
  guest: Guest;
  tableName: string | null;
  seatIndex: number | null;
}

/** 当日受付モード： 出席ゲストを卓順に並べ、タップで到着チェックする */
export function CheckinView() {
  const { state } = useAppState();
  const [checkins, setCheckins] = useState<Record<string, boolean>>(loadCheckins);
  const [query, setQuery] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const tableOrder = new Map(state.tables.map((t, i) => [t.id, i]));
    const attending = state.guests.filter((g) => g.rsvp === 'attending');
    return attending
      .map((guest) => {
        const assignment = state.assignments[guest.id];
        const table = assignment
          ? state.tables.find((t) => t.id === assignment.tableId)
          : undefined;
        return {
          guest,
          tableName: table ? table.name : null,
          seatIndex: assignment ? assignment.seatIndex : null,
          order: table ? (tableOrder.get(table.id) ?? 999) : 999,
        };
      })
      .sort(
        (a, b) =>
          a.order - b.order ||
          (a.seatIndex ?? 999) - (b.seatIndex ?? 999) ||
          a.guest.name.localeCompare(b.guest.name, 'ja'),
      )
      .map(({ guest, tableName, seatIndex }) => ({ guest, tableName, seatIndex }));
  }, [state]);

  const arrivedCount = rows.filter((r) => checkins[r.guest.id]).length;
  const totalPeople = rows.reduce((sum, r) => sum + 1 + (r.guest.companions ?? 0), 0);
  const arrivedPeople = rows
    .filter((r) => checkins[r.guest.id])
    .reduce((sum, r) => sum + 1 + (r.guest.companions ?? 0), 0);

  const visible = rows.filter((row) => {
    if (onlyPending && checkins[row.guest.id]) return false;
    if (query && !row.guest.name.includes(query)) return false;
    return true;
  });

  function toggle(guestId: string) {
    setCheckins((current) => {
      const next = { ...current };
      if (next[guestId]) {
        delete next[guestId];
      } else {
        next[guestId] = true;
      }
      try {
        localStorage.setItem(CHECKIN_KEY, JSON.stringify(next));
      } catch {
        // Persistence is best-effort.
      }
      return next;
    });
  }

  function resetAll() {
    setCheckins({});
    try {
      localStorage.removeItem(CHECKIN_KEY);
    } catch {
      // Ignore storage failures.
    }
    setConfirmingReset(false);
  }

  return (
    <section className="view-enter">
      <div className="card checkin-head">
        <h2>当日受付</h2>
        <p className="muted">
          出席ゲストを卓順に表示しています。受付で到着を確認したらタップしてください。アレルギーのある方は目印つきで表示されます。
        </p>
        <div className="checkin-progress" role="status">
          到着 {arrivedCount} / {rows.length} 組（{arrivedPeople} / {totalPeople} 名・同伴者含む）
        </div>
        <div className="progress">
          <i style={{ width: rows.length > 0 ? `${(arrivedCount / rows.length) * 100}%` : '0%' }} />
        </div>
        <div className="checkin-controls">
          <input
            className="input"
            type="search"
            placeholder="名前で検索"
            aria-label="名前で検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="checkin-filter">
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
            />
            未到着のみ
          </label>
          {confirmingReset ? (
            <span className="sample-confirm">
              <span>チェックをすべて外しますか？</span>
              <button type="button" className="btn btn-primary" onClick={resetAll}>
                外す
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmingReset(false)}>
                やめる
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmingReset(true)}>
              チェックをリセット
            </button>
          )}
        </div>
      </div>

      <div className="checkin-list">
        {visible.map(({ guest, tableName, seatIndex }) => {
          const arrived = Boolean(checkins[guest.id]);
          return (
            <button
              key={guest.id}
              type="button"
              className={`checkin-row${arrived ? ' arrived' : ''}`}
              aria-pressed={arrived}
              onClick={() => toggle(guest.id)}
            >
              <span className="checkin-box" aria-hidden="true">{arrived ? '✓' : ''}</span>
              <span className="checkin-seat">
                {tableName ? `${tableName} ${seatIndex !== null ? seatIndex + 1 : ''}番` : '席未定'}
              </span>
              <span className="checkin-main">
                <span className="checkin-name">{guest.name} 様</span>
                <span className="checkin-sub">
                  {guest.title}
                  {guest.companions > 0 && ` ／ 同伴者 ${guest.companions}名`}
                </span>
              </span>
              {guest.allergy && <span className="checkin-allergy">アレルギー：{guest.allergy}</span>}
            </button>
          );
        })}
        {visible.length === 0 && (
          <p className="muted">表示できるゲストがいません。</p>
        )}
      </div>
    </section>
  );
}
