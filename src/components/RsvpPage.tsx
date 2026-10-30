import { useEffect, useRef, useState } from 'react';
import {
  cloudEnabled,
  fetchInvitation,
  submitRsvpCloud,
  type InvitationData,
} from '../lib/supabase';
import { useAppState } from '../store/appState';
import heroUrl from '../assets/hero.jpg';

type RsvpPageProps = {
  token: string;
};

type Choice = 'attending' | 'declined';
type PageStatus = 'loading' | 'notFound' | 'ready' | 'submitted';

function formatJapaneseDate(value: string): string {
  if (!value) return '';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${weekdays[date.getDay()]}）`;
}

export default function RsvpPage({ token }: RsvpPageProps) {
  const { state, dispatch } = useAppState();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [choice, setChoice] = useState<Choice | null>(null);
  const [companions, setCompanions] = useState(0);
  const [allergy, setAllergy] = useState('');
  const [memo, setMemo] = useState('');
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<{ rsvp: Choice; companions: number; allergy: string; memo: string } | null>(null);
  const [error, setError] = useState('');

  const stateRef = useRef(state);
  stateRef.current = state;
  const loadedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Load once per token. Re-running on every state.guests change would wipe
    // the form mid-typing and bounce a just-submitted guest back to the form.
    if (loadedTokenRef.current === token) return;
    loadedTokenRef.current = token;
    let cancelled = false;
    setStatus('loading');
    setInvitation(null);
    setChoice(null);
    setCompanions(0);
    setAllergy('');
    setMemo('');
    setError('');
    setSubmitting(false);

    async function load() {
      try {
        const current = stateRef.current;
        const guest = cloudEnabled
          ? undefined
          : current.guests.find((item) => item.inviteToken === token);
        const data: InvitationData | null = cloudEnabled
          ? await fetchInvitation(token)
          : guest
            ? { info: current.info, guest }
            : null;

        if (cancelled) return;
        if (!data) {
          setStatus('notFound');
          return;
        }

        setInvitation(data);
        if (
          data.guest.rsvp === 'attending' ||
          data.guest.rsvp === 'declined'
        ) {
          setAlreadyAnswered(true);
          setChoice(data.guest.rsvp);
          setCompanions(data.guest.companions ?? 0);
          setAllergy(data.guest.allergy ?? '');
          setMemo(data.guest.memo ?? '');
        }
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('notFound');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit() {
    if (!invitation || choice === null || submitting) return;
    setSubmitting(true);
    setError('');
    const companionCount = choice === 'attending' ? companions : 0;

    try {
      if (cloudEnabled) {
        const success = await submitRsvpCloud(
          token,
          choice,
          companionCount,
          allergy,
          memo,
        );
        if (!success) {
          setError('送信に失敗しました。時間をおいて再度お試しください。');
          return;
        }
      } else {
        const fullGuest = state.guests.find((item) => item.inviteToken === token);
        if (!fullGuest) {
          setError('送信に失敗しました。時間をおいて再度お試しください。');
          return;
        }
        dispatch({
          type: 'updateGuest',
          guest: {
            ...fullGuest,
            rsvp: choice,
            companions: companionCount,
            allergy,
            memo,
          },
        });
      }
      setSummary({ rsvp: choice, companions: companionCount, allergy, memo });
      setStatus('submitted');
    } catch {
      setError('送信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'submitted' && summary) {
    return (
      <main className="rsvp-page">
        <section className="card rsvp-summary" role="status" aria-live="polite">
          <h2 className="rsvp-title">回答を受け付けました</h2>
          <p>ありがとうございました。以下の内容で承っています。</p>
          <dl className="summary-list">
            <div><dt>出欠</dt><dd>{summary.rsvp === 'attending' ? '出席' : '欠席'}</dd></div>
            {summary.rsvp === 'attending' && (
              <div><dt>同伴者数</dt><dd>{summary.companions}名</dd></div>
            )}
            <div><dt>アレルギー</dt><dd>{summary.allergy || 'なし'}</dd></div>
            <div><dt>メッセージ</dt><dd>{summary.memo || 'なし'}</dd></div>
          </dl>
          <p className="muted">内容を変更したい場合は、もう一度回答できます。</p>
          <button type="button" className="btn btn-primary" onClick={() => setStatus('ready')}>
            回答を変更する
          </button>
        </section>
      </main>
    );
  }

  if (status !== 'ready' || !invitation) {
    const text =
      status === 'loading'
        ? '読み込み中…'
        : '招待が見つかりませんでした。リンクをご確認ください。';
    return (
      <main className="rsvp-page">
        <section className="card" role="status" aria-live="polite">
          <p>{text}</p>
        </section>
      </main>
    );
  }

  const { info, guest } = invitation;

  return (
    <main className="rsvp-page">
      <section className="invitation" aria-labelledby="invitation-title">
        <img className="hero-img" src={heroUrl} alt="" aria-hidden="true" />
        <p className="inv-kicker">Wedding Invitation</p>
        <h1 id="invitation-title" className="inv-names">
          {info.groomName} <span className="inv-amp">＆</span> {info.brideName}
        </h1>
        <div className="inv-divider" aria-hidden="true"><span>❀</span></div>
        <p className="inv-date">{formatJapaneseDate(info.date)}</p>
        <p className="inv-venue">{info.venue}</p>
        <p className="inv-message">{info.message}</p>
        <p className="inv-guest">{guest.name} 様</p>
      </section>

      <form
        className="card"
        aria-labelledby="rsvp-title"
        aria-busy={submitting}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <h2 id="rsvp-title">出欠のご回答</h2>
        <fieldset disabled={submitting} className="rsvp-fields">
          <div className="field">
            <span className="field-cap">出欠（必須）</span>
            <div className="segmented" role="group" aria-label="出欠">
              {(['attending', 'declined'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={choice === value ? 'active' : ''}
                  aria-pressed={choice === value}
                  onClick={() => setChoice(value)}
                >
                  {value === 'attending' ? '出席' : '欠席'}
                </button>
              ))}
            </div>
            <p className="field-help">
              {alreadyAnswered
                ? '前回の回答が選択されています。変更して送信すると上書きされます。'
                : choice === null
                  ? '出席または欠席を選択してください。'
                  : 'この内容で送信できます。'}
            </p>
          </div>

          <div className="field">
            <label htmlFor="rsvp-companions">同伴者数</label>
            <select
              id="rsvp-companions"
              className="select"
              value={companions}
              disabled={choice !== 'attending'}
              aria-describedby="companions-help"
              onChange={(event) => setCompanions(Number(event.target.value))}
            >
              {[0, 1, 2, 3].map((count) => (
                <option key={count} value={count}>{count}名</option>
              ))}
            </select>
            <p className="field-help" id="companions-help">出席の場合のみ有効</p>
          </div>

          <div className="field">
            <label htmlFor="rsvp-allergy">アレルギー</label>
            <input id="rsvp-allergy" className="input" value={allergy} onChange={(event) => setAllergy(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rsvp-memo">メッセージ</label>
            <input id="rsvp-memo" className="input" value={memo} onChange={(event) => setMemo(event.target.value)} />
          </div>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={choice === null || submitting}>
          {submitting ? '送信中…' : '送信する'}
        </button>
      </form>
    </main>
  );
}
