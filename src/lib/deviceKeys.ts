import type { AppState, WeddingInfo } from '../types';

/**
 * 端末内だけに置く補助データ（受付チェック・提出スナップショット・初期設定済みフラグ）の
 * 保存キーを、結婚式ごとに分けるためのヘルパー。
 * 分離の材料は式の不変ID（AppState.localId）。新郎新婦名や挙式日などの
 * 表示情報を後から編集してもキーは変わらない（当日に受付チェックが
 * 消えたように見える事故を防ぐ）。
 * localId が無い旧データでは、表示情報の指紋にフォールバックする。
 */
export function deviceScopeFor(state: Pick<AppState, 'localId' | 'info'>): string {
  if (typeof state.localId === 'string' && state.localId) return state.localId;
  return fingerprintOf(state.info);
}

function fingerprintOf(info: WeddingInfo): string {
  const raw = `${info.groomName}|${info.brideName}|${info.date}`;
  let hash = 7;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash * 31) + raw.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

export function scopedDeviceKey(
  base: string,
  state: Pick<AppState, 'localId' | 'info'>,
): string {
  return `${base}:${deviceScopeFor(state)}`;
}

/** 旧方式（表示情報の指紋）で保存された値があれば、新キーへ引き継ぐための参照キー */
export function legacyScopedDeviceKey(base: string, info: WeddingInfo): string {
  return `${base}:${fingerprintOf(info)}`;
}

const DEVICE_KEY_PREFIXES = [
  'sekiji-checkin',
  'sekiji-submission',
  'sekiji-setup-done',
];

/** ログアウト時に、端末へ残る式単位の補助データを掃除する */
export function clearDeviceScopedKeys(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && DEVICE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage unavailable: nothing to clean.
  }
}
