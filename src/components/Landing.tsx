import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthPanel } from './AuthPanel';
import { cloudEnabled } from '../lib/supabase';
import heroUrl from '../assets/hero.jpg';

interface LandingProps {
  onTrySample: () => void;
  onTryLargeSample: () => void;
  onSessionChange: (session: Session | null) => void;
}

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

export function Landing({ onTrySample, onTryLargeSample, onSessionChange }: LandingProps) {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <main className="landing">
      <section className="card landing-card">
        <img className="landing-hero-img" src={heroUrl} alt="" />
        <div className="landing-body">
          <p className="inv-kicker">Wedding Preparation</p>
          <h1 className="landing-title">席次表とWeb招待状を、ひとつに。</h1>
          <p className="landing-lead">
            式場が決まった「あと」の準備は、紙の名簿・Excel・別々のツールに散らかりがちです。
            席次まるっとは、出欠の回答から席次表、印刷までをひとつの名簿でつなぐ、式場に依存しない準備アプリです。
          </p>

          <div className="landing-features">
            {features.map((feature) => (
              <div className="landing-feature" key={feature.title}>
                <h2>{feature.title}</h2>
                <p>{feature.body}</p>
              </div>
            ))}
          </div>

          <div className="landing-cta">
            <button type="button" className="btn-primary landing-cta-main" onClick={onTrySample}>
              サンプルで試してみる
            </button>
            {cloudEnabled && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowAuth((value) => !value)}
              >
                ログイン / 新規登録
              </button>
            )}
          </div>
          <p className="muted landing-note">
            サンプルはこの端末の中だけで完結します。ログインすると、クラウド保存と本物の招待リンクが使えます。
          </p>
          <p className="landing-large">
            <button type="button" className="btn-ghost" onClick={onTryLargeSample}>
              120名の大規模サンプルで試す
            </button>
            <span className="muted">実際の披露宴規模（120名・15卓）での操作感を確認できます。</span>
          </p>

          {showAuth && cloudEnabled && (
            <div className="landing-auth">
              <AuthPanel onSessionChange={onSessionChange} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
