import { useState, type FormEvent } from 'react';
import type { PrepTask } from '../types';
import { useAppState } from '../store/appState';
import { taskProgress } from '../lib/tasks';

const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

function parseDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calendarDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

function formatDueDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日（${weekdays[date.getDay()]}）まで`;
}

export function TasksView() {
  const { state, dispatch, dispatchWithUndo } = useAppState();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');

  const { done, total, rate } = taskProgress(state.tasks);
  const today = calendarDay(new Date());
  const weddingDate = state.info.date ? parseDate(state.info.date) : null;
  const days = weddingDate ? calendarDay(weddingDate) - today : null;

  const sortedTasks = [...state.tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const task: PrepTask = {
      id: `task-${Date.now()}`,
      title: trimmedTitle,
      done: false,
      ...(dueDate ? { dueDate } : {}),
    };

    dispatch({ type: 'addTask', task });
    setTitle('');
    setDueDate('');
  }

  return (
    <section className="card" aria-label="結婚式の準備タスク">
      {days !== null && (
        <p className="muted">
          {days > 0 ? `挙式まで あと${days}日` : '挙式日を迎えました'}
        </p>
      )}

      <header className="tasks-head">
        <h2>結婚式の準備タスク</h2>
        <p aria-live="polite">
          {done}/{total} 完了（{rate}%）
        </p>
      </header>

      <div
        className="progress"
        role="progressbar"
        aria-label="準備タスクの完了率"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rate}
        aria-valuetext={`${total}件中${done}件完了、${rate}%`}
      >
        <i style={{ width: rate + '%' }} />
      </div>

      {sortedTasks.length === 0 ? (
        <p className="muted">準備タスクはまだありません。</p>
      ) : (
        <ul>
          {sortedTasks.map((task) => {
            const due = task.dueDate ? parseDate(task.dueDate) : null;
            const overdue = due !== null && calendarDay(due) < today && !task.done;

            return (
              <li className="task-row" key={task.id}>
                <label>
                  <input
                    className="task-check"
                    type="checkbox"
                    checked={task.done}
                    onChange={() =>
                      dispatch({ type: 'toggleTask', taskId: task.id })
                    }
                  />
                  <span
                    className={task.done ? 'muted' : undefined}
                    style={task.done ? { textDecoration: 'line-through' } : undefined}
                  >
                    {task.title}
                  </span>
                </label>

                {due && (
                  <time className="task-due" dateTime={task.dueDate}>
                    {formatDueDate(due)}
                  </time>
                )}

                {overdue && (
                  <span className="task-due overdue">期限を過ぎています</span>
                )}

                <button
                  className="btn btn-ghost"
                  type="button"
                  aria-label={`「${task.title}」を削除`}
                  onClick={() =>
                    dispatchWithUndo(
                      { type: 'removeTask', taskId: task.id },
                      `「${task.title}」を削除しました`,
                    )
                  }
                >
                  削除
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field">
          <span>タスク名（必須）</span>
          <input
            className="input"
            type="text"
            placeholder="新しいタスク"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className="field">
          <span>期限（任意）</span>
          <input
            className="input"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>

        <button
          className="btn btn-primary"
          type="submit"
          disabled={!title.trim()}
        >
          追加
        </button>
      </form>
    </section>
  );
}
