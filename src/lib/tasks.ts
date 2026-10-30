import type { PrepTask } from '../types';

interface TaskDef {
  title: string;
  /** 挙式日の何日前か */
  daysBefore: number;
}

export const DEFAULT_TASK_DEFS: TaskDef[] = [
  { title: '招待状の送付（Web招待リンクを送る）', daysBefore: 60 },
  { title: '出欠の回答締切を設定してゲストへ周知', daysBefore: 45 },
  { title: '未回答のゲストへリマインド連絡', daysBefore: 35 },
  { title: '席次表を完成させる', daysBefore: 30 },
  { title: '引出物・プチギフトを注文する', daysBefore: 30 },
  { title: '席札の名前リストを式場へ提出', daysBefore: 21 },
  { title: 'BGMと演出の最終確認', daysBefore: 14 },
  { title: '司会者・式場プランナーと最終打合せ', daysBefore: 10 },
  { title: '衣装の最終フィッティング', daysBefore: 7 },
  { title: '当日の持ち物と搬入物の確認', daysBefore: 1 },
];

function shiftDate(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function createDefaultTasks(weddingDate: string): PrepTask[] {
  return DEFAULT_TASK_DEFS.map((def, i) => ({
    id: `task-${i + 1}`,
    title: def.title,
    dueDate: shiftDate(weddingDate, -def.daysBefore),
    done: false,
  }));
}

export function taskProgress(tasks: PrepTask[]): { done: number; total: number; rate: number } {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { done, total, rate: total === 0 ? 0 : Math.round((done / total) * 100) };
}
