import { useEffect, useState } from 'react';
import { cloudEnabled } from '../lib/config';
import heroUrl from '../assets/hero.webp';

const features = [
  {
    title: 'ゲスト別リンクで出欠収集',
    body: 'ゲストごとの招待リンクを送るだけ。回答は名簿へ自動で反映され、未回答の人への催促文も作れます。',
  },
  {
    title: '回答と連動する席次表',
    body: '出席の人だけが配置候補になります。自動提案は上座などの作法にも配慮し、あとはドラッグやタップで調整できます。',
  },
  {
    title: 'そのまま渡せる印刷',
    body: '完成した席次表はA4で印刷できます。式場との打ち合わせ資料としてそのまま使えます。',
  },
];

/**
 * サービス説明のトップページ。
 * このURL（#/）を開けば、ログイン状態や保存データに関係なく常に表示される。
 * ここでは本番データの読み書きは一切行わない。
 */
export function Landing() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!cloudEnabled) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    // Supabase クライアントは初期表示に不要なため遅延読み込みする
    void import('../lib/supabase').then(({ supabase }) => {
      if (!active || !supabase) return;
      void supabase.auth.getSession().then(({ data }) => {
        if (active) setSessionEmail(data.session?.user.email ?? null);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setSessionEmail(session?.user.email ?? null);
      });
      unsubscribe = () => subscription.unsubscribe();
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return (
    <main className="landing">
      <section className="card landing-card">
        <img className="landing-hero-img" src={heroUrl} alt="" />
        <div className="landing-body">
          <p className="inv-kicker">Wedding Preparation</p>
          <h1 className="landing-title"><span className="nb">席次表とWeb招待状を、</span><span className="nb">ひとつに。</span></h1>
          <p className="landing-lead">
            式場が決まった「あと」の準備は、紙の名簿・Excel・別々のツールに散らかりがちです。
            席次まるっとは、出欠の回答から席次表、印刷までをひとつの名簿でつなぐ、式場に依存しない準備アプリです。
          </p>

          <div className="landing-cta">
            <a className="btn-primary landing-cta-main" href="#/demo">
              デモで試してみる
            </a>
            {cloudEnabled && sessionEmail ? (
              <a className="btn-ghost" href="#/app">
                管理画面を開く（ログイン中）
              </a>
            ) : cloudEnabled ? (
              <>
                <a className="btn-ghost" href="#/login">ログイン</a>
                <a className="btn-ghost" href="#/signup">新規登録</a>
              </>
            ) : null}
          </div>

          <div className="landing-features">
            {features.map((feature) => (
              <div className="landing-feature" key={feature.title}>
                <h2>{feature.title}</h2>
                <p>{feature.body}</p>
              </div>
            ))}
          </div>

          <div className="landing-cta">
            <a className="btn-primary landing-cta-main" href="#/demo">
              デモで試してみる
            </a>
            {cloudEnabled && sessionEmail ? (
              <a className="btn-ghost" href="#/app">
                管理画面を開く（ログイン中）
              </a>
            ) : cloudEnabled ? (
              <>
                <a className="btn-ghost" href="#/login">ログイン</a>
                <a className="btn-ghost" href="#/signup">新規登録</a>
              </>
            ) : null}
          </div>
          <p className="muted landing-note">
            デモは架空の結婚式を使った操作体験です。入力した内容が本番データに保存されることはありません。
            自分の結婚式の準備は、登録・ログインをして始められます。
          </p>
          <p className="landing-large">
            <a className="btn-ghost" href="#/demo/large">
              120名の大規模デモで試す
            </a>
            <span className="muted">実際の披露宴規模（120名・15卓）での操作感を確認できます。</span>
          </p>
        </div>
      </section>
    </main>
  );
}
