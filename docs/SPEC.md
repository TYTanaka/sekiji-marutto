# 席次まるっと — 本番仕様 v1（司令塔: はね / 実装: Codex）

## 目的・品質基準
- ウェディングパーク志望（フロントエンド）のポートフォリオ。企業・エンジニアが見て「設計されている」と評価される品質。
- React 18 + TypeScript + Vite。型安全、コンポーネント分割、ドメインロジックの分離と単体テスト、CI（lint/test/build）、GitHub Pages公開。

## ドメインモデル（src/types.ts）
- Guest: { id, name, title, side: 'groom'|'bride', group: GuestGroup, rsvp: 'pending'|'attending'|'declined', allergy?: string, memo?: string, companions: number }
- GuestGroup: 'family'|'work'|'friends'|'other'（表示名: 親族/会社/友人/その他）
- TableDef: { id, name, seats: 6|8|10 }
- WeddingInfo: { groomName, brideName, date, venue, message }
- State: { guests, tables, assignments: Record<guestId, {tableId, seatIndex}>, info }
- 永続化: localStorage キー "sekiji-state-v2"、version フィールド付き。読み込み時はバリデーションし、不正なら初期データ。

## ドメインロジック（src/lib/）— 純粋関数 + Vitest
- stats.ts: 集計（総数/回答済/出席/未配置/回答率/卓ごとの充足）
- seating.ts: 席座標（円周上 % 座標）, 空席検索, 配置バリデーション（定員・重複）, 未配置一覧
- seed.ts: 初期データ生成（デモ用ゲスト12名・4卓・式情報）

## 状態管理（src/store/）
- useReducer + Context（AppStateProvider, useAppState）。アクション: addGuest/updateGuest/removeGuest/setRsvp/addTable/removeTable/updateTable/assign/unassign/setInfo/resetData。
- 副作用（保存）は store 内で一元化。

## 画面・コンポーネント（src/components/）
- App: ヘッダー（製品名・タブ）+ ビュー切替（管理 / 招待状プレビュー / 席次表 / 印刷）
- Dashboard: サマリカード（回答率プログレスバー付き）, 次にやることヒント
- GuestManager: 追加・編集フォーム（モーダルではなくインライン展開）, 一覧（検索・絞り込み）, 出欠セグメントコントロール
- Invitation: ゲストに見せる招待状ページのプレビュー（式情報・カウントダウン表示）, ゲスト回答フォーム（出席/欠席・同伴者数・アレルギー・メッセージ）→ 回答すると名簿へ即反映される体験
- SeatingEditor: 未配置チップ一覧（出席者のみ）, 円卓（上座マーカー）, Pointer Events ベースのドラッグ＆ドロップ + タップ選択→タップ配置（スマホ対応）, 定員警告, 全員配置完了の祝福表示
- PrintView: 印刷専用レイアウト（卓別席順, 肩書き整形）, @media print 最適化

## デザインシステム（src/styles/）
- トークン: --color-bg #FBF7F2, --color-surface #FFF, --color-rose #B76E79（深め）, --color-rose-soft, --color-gold #C9A24B, --color-ink #33272E, --color-muted, 状態色（attending #3E7C59, pending #C08A2D, declined #8A7F86）
- フォント: 見出し "Hiragino Mincho ProN"/"Yu Mincho" serif、本文 system gothic。スケールと余白をトークン化。
- アニメーション: ビュー遷移・チップ移動に 150–250ms の ease。prefers-reduced-motion 対応。
- アクセシビリティ: aria-label/role、フォーカスリング、コントラスト確保、キーボード操作（席選択）。

## 品質・運用
- ESLint（Vite標準+型ルール）, Prettier 任意, Vitest（lib の単体テスト + 主要コンポーネントのレンダーテスト1本以上）
- GitHub Actions: push/PR で lint・test・build。main への push で GitHub Pages へデプロイ（base パス対応）。
- README: 企画背景・設計判断・技術選定理由・画面説明・今後の拡張（実バックエンド化/Firebase等）を明記。
