/**
 * 招待トークン等の生成（Supabase クライアントから独立した小モジュール）。
 * 本体バンドルに Supabase を引き込まないよう、ここには依存のない処理だけを置く。
 */
export function newInviteToken(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let token = 'inv-';

  // 招待トークンは認証の代わりになるため、予測可能な乱数にはフォールバックしない
  const values = new Uint32Array(12);
  globalThis.crypto.getRandomValues(values);

  for (const value of values) {
    token += alphabet.charAt(value % alphabet.length);
  }

  return token;
}

/** 式を識別する不変ID（端末内キーの分離用） */
export function newLocalId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const values = new Uint32Array(4);
  globalThis.crypto.getRandomValues(values);
  return 'w-' + Array.from(values, (v) => v.toString(36)).join('');
}
