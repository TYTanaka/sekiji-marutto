/**
 * トップページ・認証ページ・規約ページ共通のフッター。
 * 法務ページへの導線と問い合わせ先を常設する（一般公開の前提条件）。
 */
export const CONTACT_EMAIL = 'yuuki20170731@gmail.com';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-links" aria-label="サービス情報・法務">
        <a href="#/privacy">プライバシーポリシー</a>
        <a href="#/terms">利用規約</a>
        <a href={`mailto:${CONTACT_EMAIL}`}>お問い合わせ</a>
      </nav>
      <small className="muted">席次まるっと — ゲスト名簿・出欠・席次表をひとつに。</small>
    </footer>
  );
}
