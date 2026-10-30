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
      <h1>席次表（印刷用）</h1>
      <p>
        {groomName}・{brideName} / {date} / {venue}
      </p>
      <button
        type="button"
        className="no-print primary"
        onClick={() => window.print()}
      >
        印刷する
      </button>

      {state.tables.map((table) => {
        const fill = tableFill(state, table.id);

        return (
          <div className="card" key={table.id}>
            <h2>
              {table.name}（{fill.seated}/{fill.seats}）
            </h2>
            <ol style={{ listStyle: 'none', paddingLeft: 0 }}>
              {Array.from({ length: table.seats }, (_, index) => {
                const occupant = assignedGuestAt(state, table.id, index);
                if (!occupant && index !== 0) {
                  const laterOccupied = Array.from(
                    { length: table.seats - index - 1 },
                    (_, k) => assignedGuestAt(state, table.id, index + 1 + k),
                  ).some(Boolean);
                  if (laterOccupied) return null;
                  const emptyCount = table.seats - index;
                  return (
                    <li key={index} className="muted">
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
                      <li key={index} className="muted">
                        （全席 空席 ×{table.seats}）
                      </li>
                    );
                  }
                }

                return (
                  <li key={index}>
                    <span>{index + 1}. </span>
                    {index === 0 && (
                      <>
                        <span className="badge-kamiza">上座</span>{' '}
                      </>
                    )}
                    {occupant ? (
                      <>
                        {`${occupant.name} 様（${occupant.title}）`}
                        {' '}
                        <span>{SIDE_LABELS[occupant.side]}</span>
                        {occupant.allergy && (
                          <span> / アレルギー：{occupant.allergy}</span>
                        )}
                      </>
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
