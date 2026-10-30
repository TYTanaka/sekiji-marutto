import { useEffect, useState } from 'react';
import {
  cloudEnabled,
  fetchInvitation,
  submitRsvpCloud,
  type InvitationData,
} from '../lib/supabase';
import { useAppState } from '../store/appState';

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
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
        const guest = cloudEnabled
          ? undefined
          : state.guests.find((item) => item.inviteToken === token);
        const data: InvitationData | null = cloudEnabled
          ? await fetchInvitation(token)
          : guest
            ? { info: state.info, guest }
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
  }, [token, state.info, state.guests]);

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
      setStatus('submitted');
    } catch {
      setError('送信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  }

  if (status !== 'ready' || !invitation) {
    const text =
      status === 'loading'
        ? '読み込み中…'
        : status === 'submitted'
          ? '回答を受け付けました。ありがとうございました。'
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
        <p style={{ fontVariant: 'small-caps', letterSpacing: '0.18em' }}>
          Wedding Invitation
        </p>
        <h1 id="invitation-title" style={{ fontFamily: 'serif' }}>
          {info.groomName} ＆ {info.brideName}
        </h1>
        <p>{formatJapaneseDate(info.date)}</p>
        <p>{info.venue}</p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{info.message}</p>
        <p>{guest.name} 様</p>
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
        <fieldset disabled={submitting}>
          <legend>出欠（必須）</legend>
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
          <p>出席または欠席を選択してください。</p>

          <label htmlFor="rsvp-companions">同伴者数</label>
          <select
            id="rsvp-companions"
            value={companions}
            disabled={choice !== 'attending'}
            aria-describedby="companions-help"
            onChange={(event) => setCompanions(Number(event.target.value))}
          >
            {[0, 1, 2, 3].map((count) => (
              <option key={count} value={count}>{count}名</option>
            ))}
          </select>
          <p id="companions-help">出席の場合のみ有効</p>

          <label htmlFor="rsvp-allergy">アレルギー</label>
          <input id="rsvp-allergy" value={allergy} onChange={(event) => setAllergy(event.target.value)} />
          <label htmlFor="rsvp-memo">メッセージ</label>
          <input id="rsvp-memo" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={choice === null || submitting}>
          {submitting ? '送信中…' : '送信する'}
        </button>
      </form>
    </main>
  );
}
