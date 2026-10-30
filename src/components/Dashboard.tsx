import { useAppState } from '../store/appState';
import { summarize, nextActionHint } from '../lib/stats';
import { tableFill } from '../lib/seating';

export function Dashboard() {
  const { state } = useAppState();
  const sum = summarize(state);

  return (
    <section className="view-enter">
      <div className="hint">{nextActionHint(state)}</div>

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
    </section>
  );
}
