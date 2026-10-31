import { describe, it, expect } from 'vitest';
import { createSeedState } from './seed';
import { buildGuestsCsv, buildSeatingCsv } from './csv';

describe('提出用CSV', () => {
  it('ゲスト一覧CSVにヘッダーとゲスト行・席情報が入る', () => {
    const csv = buildGuestsCsv(createSeedState());
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"お名前","区分","出欠"');
    expect(csv).toContain('高橋 誠');
    expect(csv).toContain('"A卓","1"');
  });

  it('席次表CSVは卓と席順で並ぶ', () => {
    const csv = buildSeatingCsv(createSeedState());
    const lines = csv.split('\r\n');
    expect(lines[1]).toContain('"A卓","1","高橋 誠"');
    expect(lines.length).toBe(1 + 8 + 8 + 8 + 6);
  });
});
