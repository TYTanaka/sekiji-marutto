import { useRef, useState } from 'react';
import { proposeAssignmentsWithReasons } from '../lib/autoSeat';
import { checkSeatingEtiquette } from '../lib/etiquette';
import { useAppState } from '../store/appState';
import {
  seatPosition,
  assignedGuestAt,
  unassignedAttending,
  tableFill,
} from '../lib/seating';
import { summarize } from '../lib/stats';
import type { Guest, TableDef } from '../types';

function tableSuggestion(tables: TableDef[]): string {
  const letters = tables
    .map((t) => /^([A-Z])卓$/.exec(t.name)?.[1])
    .filter((c): c is string => Boolean(c))
    .sort();
  if (letters.length === 0) return 'A卓';
  const next = String.fromCharCode(letters[letters.length - 1].charCodeAt(0) + 1);
  return `${next}卓`;
}

export function SeatingEditor() {
  const { state, dispatch, dispatchWithUndo } = useAppState();
  const [confirmingTableId, setConfirmingTableId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [armedSeat, setArmedSeat] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const suppressClick = useRef(false);
  const stopDrag = useRef<(() => void) | null>(null);
  const [newTableName, setNewTableName] = useState('');
  const [newTableSeats, setNewTableSeats] = useState(8);
  const [autoNotice, setAutoNotice] = useState('');

  const unassigned = unassignedAttending(state);
  const suggestion = tableSuggestion(state.tables);
  const summary = summarize(state);

  function beginDrag(
    guest: Guest,
    pointerId: number,
    startX: number,
    startY: number,
    originSeat?: string,
  ) {
    stopDrag.current?.();
    suppressClick.current = false;
    dragId.current = guest.id;
    setDraggingId(guest.id);

    function cleanup() {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      dragId.current = null;
      setDraggingId(null);
      stopDrag.current = null;
    }

    function finish(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;

      const guestId = dragId.current;
      const moved = Math.hypot(
        event.clientX - startX,
        event.clientY - startY,
      ) > 6;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-seat]');
      const seatKey = target?.dataset.seat;
      cleanup();

      if (moved) suppressClick.current = true;
      if (!guestId || !seatKey || seatKey === originSeat) return;

      const separator = seatKey.lastIndexOf(':');
      if (separator < 1) return;

      const tableId = seatKey.slice(0, separator);
      const seatIndex = Number(seatKey.slice(separator + 1));
      const table = state.tables.find((item) => item.id === tableId);

      if (
        !table ||
        !Number.isInteger(seatIndex) ||
        seatIndex < 0 ||
        seatIndex >= table.seats ||
        assignedGuestAt(state, tableId, seatIndex)
      ) {
        return;
      }

      suppressClick.current = true;
      dispatch({ type: 'assign', guestId, tableId, seatIndex });
      setSelectedId(null);
    }

    function cancel(event: PointerEvent) {
      if (event.pointerId === pointerId) cleanup();
    }

    stopDrag.current = cleanup;
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
  }

  function consumeDragClick(): boolean {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  }

  function addTable() {
    const name = newTableName.trim() || suggestion;
    const table: TableDef = {
      id: 'table-' + Date.now(),
      name,
      seats: newTableSeats,
    };

    dispatch({ type: 'addTable', table });
    setNewTableName('');
  }

  const [lastProposal, setLastProposal] = useState<{
    assignments: Record<string, { tableId: string; seatIndex: number }>;
    reasons: Record<string, string[]>;
  } | null>(null);

  function applyAutoSeat() {
    const { assignments: proposal, reasons } = proposeAssignmentsWithReasons(state);
    const entries = Object.entries(proposal);
    entries.forEach(([guestId, a]) => {
      dispatch({ type: 'assign', guestId, tableId: a.tableId, seatIndex: a.seatIndex });
    });
    setAutoNotice(entries.length > 0 ? `${entries.length}名を仮配置しました。ドラッグやタップで調整できます。` : '仮配置できるゲストはいませんでした。');
    setLastProposal(entries.length > 0 ? { assignments: proposal, reasons } : null);
  }

  return (
    <div className="seating-editor">
      {unassigned.length > 0 && (
        <div className="table-controls">
          <button type="button" className="btn btn-primary" onClick={applyAutoSeat}>
            席次を自動で提案する
          </button>
          <span className="muted">同じ側・同じグループの方が同じ卓になるよう、上座を配慮して仮配置します</span>
        </div>
      )}
      {autoNotice && <div className="hint" role="status">{autoNotice}</div>}
      {lastProposal && (
        <div className="card reasons-panel">
          <div className="changes-head">
            <h3>配置の理由</h3>
            <button type="button" className="btn-ghost" onClick={() => setLastProposal(null)}>
              閉じる
            </button>
          </div>
          {state.tables.map((table) => {
            const rows = Object.entries(lastProposal.assignments)
              .filter(([, a]) => a.tableId === table.id)
              .sort(([, a], [, b]) => a.seatIndex - b.seatIndex)
              .map(([guestId, a]) => ({
                guest: state.guests.find((g) => g.id === guestId),
                seatIndex: a.seatIndex,
                reasons: lastProposal.reasons[guestId] ?? [],
              }))
              .filter((row) => row.guest);
            if (rows.length === 0) return null;
            return (
              <div key={table.id} className="reasons-table">
                <h4>{table.name}</h4>
                <ul className="reasons-list">
                  {rows.map((row) => (
                    <li key={row.guest!.id}>
                      <span>{`${row.seatIndex + 1}番席 ${row.guest!.name}さん`}</span>
                      <span className="muted">{row.reasons.join('／')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {summary.allSeated && (
        <div className="celebration">全員の席が決まりました。</div>
      )}

      {(() => {
        const notes = checkSeatingEtiquette(state);
        const seatedCount = Object.keys(state.assignments).length;
        if (seatedCount === 0) return null;
        return (
          <div className="card etiquette-panel">
            <h3>作法チェック</h3>
            {notes.length === 0 ? (
              <p className="muted">作法の観点で気になる点はありませんでした。</p>
            ) : (
              <ul className="etiquette-list">
                {notes.map((note) => (
                  <li key={note.id} className={note.level === 'warn' ? 'eq-warn' : 'eq-check'}>
                    <span className="eq-badge">{note.level === 'warn' ? '要確認' : '確認'}</span>
                    <span>{note.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted">上座・下座や親族の席など、日本の披露宴の作法から自動でチェックしています。</p>
          </div>
        );
      })()}

      <section aria-labelledby="unassigned-guests-heading">
        <h2 id="unassigned-guests-heading">
          未配置のゲスト（出席） <span>{unassigned.length}名</span>
        </h2>
        <div className="chips-row">
          {unassigned.map((guest: Guest) => (
            <button
              key={guest.id}
              type="button"
              className={'chip' + (selectedId === guest.id ? ' selected' : '')}
              aria-pressed={selectedId === guest.id}
              aria-label={`${guest.name}さんを配置するために選択`}
              data-dragging={draggingId === guest.id || undefined}
              style={{ touchAction: 'none' }}
              onClick={() => {
                if (consumeDragClick()) return;
                setSelectedId((current) =>
                  current === guest.id ? null : guest.id,
                );
              }}
              onPointerDown={(event) => {
                if (!event.isPrimary || event.button !== 0) return;
                beginDrag(
                  guest,
                  event.pointerId,
                  event.clientX,
                  event.clientY,
                );
              }}
            >
              <span>{guest.name}</span>
              <small>{guest.title}</small>
            </button>
          ))}
        </div>
        <p className="muted">
          チップを選んでから空席をタップすると配置できます。ドラッグでも移動できます。配置した席を外すときは、席をタップして確認表示を出してから、もう一度タップしてください。
        </p>
      </section>

      {armedSeat && (
        <p className="arm-hint">席を外すには、もう一度同じ席をタップしてください。</p>
      )}

      <nav className="table-nav" aria-label="卓へのジャンプ">
        {state.tables.map((table: TableDef) => {
          const fill = tableFill(state, table.id);
          return (
            <button
              key={table.id}
              type="button"
              className="table-nav-chip"
              onClick={() =>
                document
                  .getElementById(`table-card-${table.id}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              {table.name} <span>{`${fill.seated}/${fill.seats}`}</span>
            </button>
          );
        })}
      </nav>

      <div className="tables-grid">
        {state.tables.map((table: TableDef) => {
          const fill = tableFill(state, table.id);

          return (
            <section className="table-wrap" id={`table-card-${table.id}`} key={table.id}>
              <div className="table-heading">
                <h3>{table.name}</h3>
                <span>{`${fill.seated}/${fill.seats}`}</span>
                <label>
                  卓設定：
                  <select
                    value={table.seats}
                    aria-label={`${table.name}の席数`}
                    onChange={(event) =>
                      dispatch({
                        type: 'updateTable',
                        table: { ...table, seats: Number(event.target.value) },
                      })
                    }
                  >
                    {[6, 8, 10].map((seats) => (
                      <option key={seats} value={seats}>{seats}席</option>
                    ))}
                  </select>
                </label>
                {confirmingTableId === table.id ? (
                  <>
                    <span className="confirm-inline-text">{`${table.name}を削除しますか？`}</span>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => {
                        dispatchWithUndo(
                          { type: 'removeTable', tableId: table.id },
                          `${table.name}を削除しました`,
                        );
                        setConfirmingTableId(null);
                      }}
                    >
                      削除する
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setConfirmingTableId(null)}
                    >
                      やめる
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-danger-ghost"
                    disabled={state.tables.length === 1}
                    aria-label={`${table.name}を削除`}
                    onClick={() => setConfirmingTableId(table.id)}
                  >
                    削除
                  </button>
                )}
              </div>

              <div
                className="round-table"
                style={{ position: 'relative', aspectRatio: '1 / 1' }}
              >
                <div className="table-name">{table.name}</div>
                {Array.from({ length: table.seats }, (_, i) => {
                  const pos = seatPosition(i, table.seats);
                  const occupant = assignedGuestAt(state, table.id, i);

                  return (
                    <button
                      key={i}
                      type="button"
                      className={
                        'seat ' + (occupant ? 'filled' : 'empty') +
                        (selectedId && !occupant ? ' target' : '') +
                        (armedSeat === `${table.id}:${i}` ? ' armed' : '')
                      }
                      data-seat={`${table.id}:${i}`}
                      style={{
                        position: 'absolute',
                        left: pos.x + '%',
                        top: pos.y + '%',
                        touchAction: 'none',
                      }}
                      aria-label={
                        `${table.name}の${i === 0 ? '上座' : `${i + 1}番席`}` +
                        (occupant
                          ? `、${occupant.name}さん。タップで配置を解除`
                          : '、空席。選択したゲストを配置')
                      }
                      onPointerDown={(event) => {
                        if (!occupant || !event.isPrimary || event.button !== 0) return;
                        beginDrag(
                          occupant, event.pointerId, event.clientX,
                          event.clientY, `${table.id}:${i}`,
                        );
                      }}
                      onClick={() => {
                        if (consumeDragClick()) return;
                        if (occupant) {
                          const key = `${table.id}:${i}`;
                          if (armedSeat === key) {
                            dispatch({ type: 'unassign', guestId: occupant.id });
                            setArmedSeat(null);
                          } else {
                            setArmedSeat(key);
                          }
                        } else if (selectedId) {
                          dispatch({
                            type: 'assign', guestId: selectedId,
                            tableId: table.id, seatIndex: i,
                          });
                          setSelectedId(null);
                          setArmedSeat(null);
                        }
                      }}
                    >
                      {occupant ? (
                        <>
                          <span className="seat-no">{i + 1}</span>
                          {occupant.name.split(' ').map((part, k) => (
                            <span key={k} className="seat-name-line">{part}</span>
                          ))}
                          {armedSeat === `${table.id}:${i}` ? (
                            <span className="badge-kamiza" style={{ background: '#C0392B', color: '#fff' }}>外す？</span>
                          ) : (
                            i === 0 && <span className="badge-kamiza">上座</span>
                          )}
                        </>
                      ) : i === 0 ? '上座' : `${i + 1}`}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="add-table-controls">
        <input
          aria-label="追加する卓の名前"
          placeholder={`次は ${suggestion}`}
          value={newTableName}
          onChange={(event) => setNewTableName(event.target.value)}
        />
        <select
          aria-label="追加する卓の席数"
          value={newTableSeats}
          onChange={(event) => setNewTableSeats(Number(event.target.value))}
        >
          {[6, 8, 10].map((seats) => (
            <option key={seats} value={seats}>{seats}席</option>
          ))}
        </select>
        <button type="button" onClick={addTable}>追加</button>
      </div>
      <p className="seating-note">
        配置した席を外すときは、席をタップして確認表示を出してから、もう一度タップしてください。
      </p>
    </div>
  );
}
