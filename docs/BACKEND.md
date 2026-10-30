# バックエンド設計（v2: クラウド化）

## 目標
- カップル（所有者）がログインしてデータをクラウド保存し、複数端末で編集できる
- ゲストは専用リンク（ログイン不要）で招待状を見て出欠を回答でき、回答が所有者側へ即時反映される
- バックエンドは Supabase（Postgres + Auth + Realtime + RLS）。無料枠で運用可能な規模

## データモデル（ドキュメント方式 v1）
正規化テーブルではなく、式ごとに1行・状態をJSONBで保持する方式を採る。

- `weddings` テーブル
  - `id uuid primary key default gen_random_uuid()`
  - `owner_id uuid not null references auth.users(id) on delete cascade`
  - `state jsonb not null` — アプリの AppState そのもの（version/guests/tables/assignments/info）
  - `updated_at timestamptz not null default now()`
- 選定理由: フロントの状態モデル（reducer + 純粋関数）が確立しており、状態をそのまま永続化すると
  ロジックの再利用率が最大になる。正規化は将来の分析要件が出てからで十分。
  トレードオフ（JSONB内の検索・集計が弱い）は、ゲスト回答をRPCで限定操作することで補う。

## ゲスト招待リンク
- Guest に `inviteToken`（推測困難なランダム文字列）を追加。リンクは `/#/rsvp/<token>`。
- 公開範囲は「そのゲスト本人の招待情報＋回答」に限定する。名簿全体は絶対に公開しない。
- 関数（SECURITY DEFINER の RPC）:
  - `get_invitation(p_token text)` → 結婚式情報（info）と該当ゲストの表示名・現在の回答だけを返す。
    どの式にも該当しないトークンなら null。
  - `submit_rsvp(p_token text, p_rsvp text, p_companions int, p_allergy text, p_memo text)` →
    JSONB 内の該当ゲストだけを更新し updated_at を進める。rsvp は attending/declined のみ許可、
    companions は 0..5 に丸める。席次（assignments）は触らない。
- RPC 内で JSONB の guests 配列を走査して token 一致を探す（式の件数が小規模なため許容）。

## セキュリティ（RLS）
- `weddings` に RLS を有効化。ポリシーは所有者のみ:
  select/insert/update/delete すべて `auth.uid() = owner_id`。
- anon ロールにテーブルへの直接アクセス権限は与えない（RPC 経由のみ）。
- 所有者の共同編集（パートナー招待）は将来拡張: `wedding_members` テーブルで member も許可する設計余地を残す。

## フロントエンドの接続方式
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` が設定されている場合のみクラウドモード。
  未設定なら現行のローカルモード（localStorage）で完全動作する（公開デモが壊れないための配慮）。
- クラウドモード時:
  - ログイン（メール+パスワード / マジックリンク想定の Auth UI を最小実装）
  - 初回ログイン時に自分の weddings 行を作成 or 取得し、以降は状態変更を debounce して upsert
  - Realtime で自分の行の変更を購読し、他端末の変更を取り込む（自分の保存によるエコーは updated_at とクライアントIDで抑制）
- 招待ページ（`#/rsvp/<token>`）は管理画面とは独立した公開ページとして描画する。
  クラウドモードでは RPC、ローカルモードでは同一端末の状態に対して動作する。

## 移行・運用
- SQL は `supabase/schema.sql` としてリポジトリ管理し、プロジェクト作成後にそのまま実行する。
- フロントのデプロイは従来どおり GitHub Pages。APIキーは anon key（公開前提のキー）を使い、
  保護はRLSとRPCの限定公開で担保する（service role key は絶対にフロントへ置かない）。
