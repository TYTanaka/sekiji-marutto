import type { AppState, Guest } from '../types';
import { VIP_PATTERN } from './autoSeat';
import { seatOccupant, tableFill } from './seating';

export interface EtiquetteNote {
  id: string;
  /** warn = 作法として直したほうがよい点 / check = 意図があってよい確認ポイント */
  level: 'warn' | 'check';
  tableName?: string;
  text: string;
}

/**
 * 席次表を日本の披露宴の作法の観点でチェックする（校正機能）。
 * 自動配置で守っているルールを、手動配置にも同じ物差しで適用する。
 * - 役職者・主賓が下座側に座っていないか
 * - 上座（1番席）が空いたままになっていないか
 * - 親族が末席に置かれていないか
 * - 1つの卓に新郎側と新婦側が混ざっていないか（意図的なら問題なし）
 * - 卓ごとの人数バランスが崩れていないか
 */
export function checkSeatingEtiquette(state: AppState): EtiquetteNote[] {
  const notes: EtiquetteNote[] = [];
  const push = (level: EtiquetteNote['level'], text: string, tableName?: string) => {
    notes.push({ id: `eq-${notes.length + 1}`, level, text, tableName });
  };

  const fills: { name: string; seated: number }[] = [];

  for (const table of state.tables) {
    const occupants: { guest: Guest; seatIndex: number }[] = [];
    for (let i = 0; i < table.seats; i += 1) {
      // 作法チェックは本人の席だけを見る（同伴者席は本人の席として数えない）
      const occ = seatOccupant(state, table.id, i);
      if (occ && !occ.companion) occupants.push({ guest: occ.guest, seatIndex: i });
    }
    const fill = tableFill(state, table.id);
    fills.push({ name: table.name, seated: fill.seated });
    if (occupants.length === 0) continue;

    // 上座（1番席）が空いているのに他の席が埋まっている
    if (!occupants.some((o) => o.seatIndex === 0)) {
      push('check', `${table.name}の上座（1番席）が空いています`, table.name);
    }

    // 役職者・主賓が下座側（後半の席）
    const half = Math.ceil(table.seats / 2);
    for (const { guest, seatIndex } of occupants) {
      if (VIP_PATTERN.test(guest.title) && seatIndex >= half) {
        push(
          'warn',
          `${guest.name}さん（${guest.title}）が${table.name}の下座側（${seatIndex + 1}番席）に座っています`,
          table.name,
        );
      }
    }

    // 親族が末席なのに、上座が親族以外
    const lastSeat = Math.max(...occupants.map((o) => o.seatIndex));
    const kamiza = occupants.find((o) => o.seatIndex === 0);
    for (const { guest, seatIndex } of occupants) {
      if (
        guest.group === 'family' &&
        seatIndex === lastSeat &&
        lastSeat > 0 &&
        kamiza &&
        kamiza.guest.group !== 'family'
      ) {
        push(
          'warn',
          `親族の${guest.name}さんが${table.name}の末席（${seatIndex + 1}番席）になっています`,
          table.name,
        );
      }
    }

    // 新郎側と新婦側の混在
    const sides = new Set(occupants.map((o) => o.guest.side));
    if (sides.size > 1) {
      push(
        'check',
        `${table.name}は新郎側と新婦側のゲストが混ざっています（意図した配置であれば問題ありません）`,
        table.name,
      );
    }
  }

  // 人数バランス（着席のある卓同士で比較）
  const used = fills.filter((f) => f.seated > 0);
  if (used.length >= 2) {
    const max = Math.max(...used.map((f) => f.seated));
    const min = Math.min(...used.map((f) => f.seated));
    if (max - min >= 3) {
      push(
        'check',
        `卓ごとの人数差が大きくなっています（最大 ${max}名 ・ 最小 ${min}名）`,
      );
    }
  }

  return notes;
}
