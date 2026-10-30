import { useAppState } from '../store/appState';
import {
  assignedGuestAt,
  tableFill,
  unassignedAttending,
} from '../lib/seating';
import { SIDE_LABELS } from '../types';

export function PrintView() {
  const { state } = useAppState();
  const { groomName, brideName, date, venue } = state.info;
  const unassigned = unassignedAttending(state);

  return (
    <section className="view-enter print-area">
      <header className="print-head">
        <p className="print-kicker">Seating Chart</p>
        <h1 className="print-title">席次表</h1>
        <p className="print-meta">
          {groomName} ・ {brideName}　／　{date.replaceAll('-', '/')}　／　{venue}
        </p>
      </header>
      <button
        type="button"
        className="no-print primary"
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
