import type { WeddingInfo } from '../types';

/**
 * 端末内だけに置く補助データ（受付チェック・提出スナップショット・初期設定済みフラグ）の
 * 保存キーを、結婚式ごとに分けるためのヘルパー。
 * 同じ端末を別の式・アカウントで使っても、前の人の状態が残って見えないようにする。
 */
export function deviceScopeFor(info: WeddingInfo): string {
  const raw = `${info.groomName}|${info.brideName}|${info.date}`;
  let hash = 7;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash * 31) + raw.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

export function scopedDeviceKey(base: string, info: WeddingInfo): string {
  return `${base}:${deviceScopeFor(info)}`;
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
