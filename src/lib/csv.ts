import type { AppState } from '../types';
import { GROUP_LABELS, RSVP_LABELS, SIDE_LABELS } from '../types';
import { assignedGuestAt } from './seating';

function escapeCsv(value: string | number): string {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: (string | number)[][]): string {
  // Excel で文字化けしないよう BOM を付ける
  return '\uFEFF' + rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
}

function seatOf(state: AppState, guestId: string): { tableName: string; seatNumber: string } {
  const assignment = state.assignments[guestId];
  if (!assignment) return { tableName: '', seatNumber: '' };
  const table = state.tables.find((t) => t.id === assignment.tableId);
  return {
    tableName: table ? table.name : '',
    seatNumber: String(assignment.seatIndex + 1),
  };
}

/** 式場提出用のゲスト一覧 CSV */
export function buildGuestsCsv(state: AppState): string {
  const rows: (string | number)[][] = [
    ['お名前', '区分', '出欠', '同伴者数', 'アレルギー', 'メモ', '卓', '席番号'],
  ];
  for (const guest of state.guests) {
    const seat = seatOf(state, guest.id);
    rows.push([
      guest.name,
      `${SIDE_LABELS[guest.side]}・${GROUP_LABELS[guest.group]}`,
      RSVP_LABELS[guest.rsvp],
      guest.rsvp === 'attending' ? guest.companions : '',
      guest.allergy,
      guest.memo,
      seat.tableName,
      seat.seatNumber,
    ]);
  }
  return toCsv(rows);
}

/** 式場提出用の席次表 CSV（卓→席順） */
export function buildSeatingCsv(state: AppState): string {
  const rows: (string | number)[][] = [
    ['卓', '席番号', 'お名前', '肩書き', '区分', 'アレルギー'],
  ];
  for (const table of state.tables) {
    for (let i = 0; i < table.seats; i += 1) {
      const guest = assignedGuestAt(state, table.id, i);
      rows.push([
        table.name,
        i + 1,
        guest ? guest.name : '',
        guest ? guest.title : '',
        guest ? `${SIDE_LABELS[guest.side]}・${GROUP_LABELS[guest.group]}` : '',
        guest ? guest.allergy : '',
      ]);
    }
  }
  return toCsv(rows);
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
