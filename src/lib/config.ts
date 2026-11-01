/**
 * クラウド（Supabase）接続の設定だけを切り出した軽量モジュール。
 * クライアント本体（重い）とは別にし、初期表示で読み込まないようにする。
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;
export const cloudEnabled: boolean = Boolean(url && anonKey);
