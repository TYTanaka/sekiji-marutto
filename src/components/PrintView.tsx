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
            未配置の出席ゲストが{unassigned.length}名います。
          </p>
        )}
      </footer>
    </section>
  );
}
