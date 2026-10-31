import { useState } from 'react';
import { useAppState } from '../store/appState';
import {
  assignedGuestAt,
  tableFill,
  unassignedAttending,
} from '../lib/seating';
import { GROUP_LABELS, RSVP_LABELS, SIDE_LABELS } from '../types';
import {
  takeSubmissionSnapshot,
  diffSubmission,
  type SubmissionSnapshot,
} from '../lib/submission';
import { buildGuestsCsv, buildSeatingCsv, downloadCsv } from '../lib/csv';

const SUBMISSION_KEY = 'sekiji-submission-v1';

function loadSnapshot(): SubmissionSnapshot | null {
  try {
    const raw = localStorage.getItem(SUBMISSION_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'at' in parsed &&
        'guests' in parsed &&
        'assignments' in parsed
      ) {
        return parsed as SubmissionSnapshot;
      }
    }
  } catch {
    // No usable snapshot.
  }
  return null;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PrintView() {
  const { state } = useAppState();
  const { groomName, brideName, date, venue } = state.info;
  const unassigned = unassignedAttending(state);
  const [mode, setMode] = useState<'chart' | 'pack'>('chart');
  const [snapshot, setSnapshot] = useState<SubmissionSnapshot | null>(loadSnapshot);
  const [confirmingRecord, setConfirmingRecord] = useState(false);

  function recordSnapshot() {
    const next = takeSubmissionSnapshot(state);
    setSnapshot(next);
    try {
      localStorage.setItem(SUBMISSION_KEY, JSON.stringify(next));
    } catch {
      // Snapshot persistence is best-effort.
    }
    setConfirmingRecord(false);
  }

  const packDiff = snapshot ? diffSubmission(snapshot, state) : null;

  return (
    <section className="view-enter print-area">
      <header className="print-head">
        <p className="print-kicker">Seating Chart</p>
        <h1 className="print-title">席次表</h1>
        <p className="print-meta">
          {groomName} ・ {brideName}　／　{date.replaceAll('-', '/')}　／　{venue}
        </p>
      </header>
      <div className="no-print pack-controls">
        <div className="segmented" role="group" aria-label="印刷の種類">
          <button
            type="button"
            className={mode === 'chart' ? 'active' : ''}
            aria-pressed={mode === 'chart'}
            onClick={() => setMode('chart')}
          >
            席次表のみ
          </button>
          <button
            type="button"
            className={mode === 'pack' ? 'active' : ''}
            aria-pressed={mode === 'pack'}
            onClick={() => setMode('pack')}
          >
            式場提出パック
          </button>
        </div>
        {mode === 'pack' && (
          <div className="pack-record">
            {snapshot ? (
              <p className="muted">
                前回の提出版： {formatDateTime(snapshot.at)} に記録
              </p>
            ) : (
              <p className="muted">
                提出版はまだ記録されていません。式場へ提出したら、その時点の内容を記録しておくと、次回から変更差分が自動で付きます。
              </p>
            )}
            {confirmingRecord ? (
              <span className="sample-confirm">
                <span>現在の内容を提出版として記録しますか？（前回の記録は上書きされます）</span>
                <button type="button" className="btn btn-primary" onClick={recordSnapshot}>
                  記録する
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmingRecord(false)}>
                  やめる
                </button>
              </span>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmingRecord(true)}>
                現在の内容を提出版として記録
              </button>
            )}
            <div className="pack-csv">
              <span className="muted">式場がExcelで受け取りたい場合：</span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => downloadCsv('ゲスト一覧.csv', buildGuestsCsv(state))}
              >
                ゲスト一覧をCSVでダウンロード
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => downloadCsv('席次表.csv', buildSeatingCsv(state))}
              >
                席次表をCSVでダウンロード
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        className="no-print primary print-action"
        onClick={() => window.print()}
      >
        印刷する
      </button>

      <div className="print-tables">
      {state.tables.map((table) => {
        const fill = tableFill(state, table.id);

        return (
          <div className="card print-table" key={table.id}>
            <h2>
              {table.name}（{fill.seated}/{fill.seats}）
            </h2>
            <ol className="print-seats">
              {Array.from({ length: table.seats }, (_, index) => {
                const occupant = assignedGuestAt(state, table.id, index);
                if (!occupant && index !== 0) {
                  const laterOccupied = Array.from(
                    { length: table.seats - index - 1 },
                    (_, k) => assignedGuestAt(state, table.id, index + 1 + k),
                  ).some(Boolean);
                  if (laterOccupied) return null;
                  // 末尾の空席の並びは、先頭の1席だけに集約行を出す（残りは出さない）
                  if (!assignedGuestAt(state, table.id, index - 1)) return null;
                  const emptyCount = table.seats - index;
                  return (
                    <li key={index} className="muted print-seat-row">
                      （空席 ×{emptyCount}）
                    </li>
                  );
                }
                if (!occupant && index === 0) {
                  const anyOccupied = Array.from({ length: table.seats }, (_, k) =>
                    assignedGuestAt(state, table.id, k),
                  ).some(Boolean);
                  if (!anyOccupied) {
                    return (
                      <li key={index} className="muted print-seat-row">
                        （全席 空席 ×{table.seats}）
                      </li>
                    );
                  }
                }

                return (
                  <li key={index} className="print-seat-row">
                    <span className="print-seat-no">{index + 1}</span>
                    {index === 0 && (
                      <>
                        <span className="badge-kamiza">上座</span>{' '}
                      </>
                    )}
                    {occupant ? (
                      <span className="print-seat-main">
                        <span>{`${occupant.name} 様（${occupant.title}）`}</span>
                        <span className="print-seat-sub">
                          {SIDE_LABELS[occupant.side]}
                          {occupant.allergy && ` ／ アレルギー：${occupant.allergy}`}
                        </span>
                      </span>
                    ) : (
                      <span className="muted">（空席）</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
      </div>

      {mode === 'pack' && (
        <>
          <section className="pack-section">
            <h2 className="pack-title">ゲスト一覧（式場確認用）</h2>
            <table className="pack-table">
              <thead>
                <tr>
                  <th>お名前</th>
                  <th>区分</th>
                  <th>出欠</th>
                  <th>同伴者</th>
                  <th>アレルギー</th>
                </tr>
              </thead>
              <tbody>
                {state.guests.map((guest) => (
                  <tr key={guest.id}>
                    <td>{guest.name} 様</td>
                    <td>
                      {SIDE_LABELS[guest.side]}・{GROUP_LABELS[guest.group]}
                    </td>
                    <td>{RSVP_LABELS[guest.rsvp]}</td>
                    <td>{guest.rsvp === 'attending' ? `${guest.companions}名` : '—'}</td>
                    <td>{guest.allergy || 'なし'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="pack-section">
            <h2 className="pack-title">前回提出からの変更</h2>
            {!snapshot && (
              <p>提出版が記録されていないため、差分はありません。提出時に「提出版として記録」すると、次回から変更点がここに表示されます。</p>
            )}
            {snapshot && packDiff && (
              <>
                <p className="muted">前回提出： {formatDateTime(snapshot.at)}</p>
                {packDiff.guestChanges.length === 0 && packDiff.seatChanges.length === 0 ? (
                  <p>前回提出からの変更はありません。</p>
                ) : (
                  <ul className="pack-changes">
                    {packDiff.guestChanges.map((change) => (
                      <li key={change.id}>
                        <strong>{change.guestName}</strong> さん：{change.text}
                      </li>
                    ))}
                    {packDiff.seatChanges.map((change) => (
                      <li key={change.guestId}>
                        <strong>{change.guestName}</strong> さん：席 {change.from} → {change.to}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </>
      )}

      <footer>
        {unassigned.length > 0 && (
          <p className="hint" role="alert">
            未配置の出席ゲストが{unassigned.length}名います：{unassigned.map((g) => g.name).join('、')}
          </p>
        )}
      </footer>
    </section>
  );
}
