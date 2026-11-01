import { useEffect, useRef, useState } from 'react';
import {
  cloudEnabled,
  fetchInvitation,
  submitRsvpCloud,
  type InvitationData,
} from '../lib/supabase';
import { useAppState } from '../store/appState';
import heroUrl from '../assets/hero.webp';

type RsvpPageProps = {
  token: string;
  /**
   * デモ内の見本プレビュー用：指定されたゲストをストアから直接読み、
   * クラウド（ネットワーク）には一切アクセスしない。本番リンクは発行しない。
   */
  demoGuestId?: string;
  /** デモ内プレビューの「デモに戻る」 */
  onClose?: () => void;
};

/**
 * デモ内プレビューの見本であることを示す案内。
 * 回答しても実際には送信されず、デモの中だけで反映されることを明示する。
 */
function DemoSampleNotice({ onClose }: { onClose?: () => void }) {
  return (
    <section className="demo-rsvp-notice" aria-label="ゲスト画面の見本について">
      <p>
        <span className="demo-rsvp-chip">ゲスト画面の見本（デモ）</span>
        実際のゲストに表示される回答ページの見本です。ここで回答しても実際には送信されず、デモの中だけで反映されます。
      </p>
      {onClose && (
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          デモに戻る
        </button>
      )}
    </section>
  );
}

/**
 * ゲストへの小さなクレジット表記。
 * 招待リンクを開くゲスト（将来のカップルを含む）への控えめな案内として置く。
 */
export function ServiceCredit() {
  const href = `${window.location.origin}${window.location.pathname}#/?utm_source=guest_credit`;
  return (
    <p className="service-credit">
      この招待状は
      <a href={href} target="_blank" rel="noreferrer">
        席次まるっと
      </a>
      で作られました（結婚式準備が無料でできます）
    </p>
  );
}

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

export default function RsvpPage({ token, demoGuestId, onClose }: RsvpPageProps) {
  const demoPreview = demoGuestId !== undefined;
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
  const loadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Load once per token. Re-running on every state.guests change would wipe
    // the form mid-typing and bounce a just-submitted guest back to the form.
    // デモ見本ではキーにゲストIDを使い、読み込みもストア内で完結させる。
    const loadKey = demoGuestId !== undefined ? `demo:${demoGuestId}` : token;
    if (loadedKeyRef.current === loadKey) return;
    loadedKeyRef.current = loadKey;
    let cancelled = false;
    setStatus('loading');
    setInvitation(null);
    setChoice(null);
    setCompanions(0);
    setAllergy('');
    setMemo('');
    setError('');
    setSubmitting(false);

    if (demoGuestId !== undefined) {
      // デモの見本：本番リンクは発行せず、デモ用ストアのゲストから組み立てる。
      // クラウド（ネットワーク）には一切アクセスしない。開封記録も残さない。
      const current = stateRef.current;
      const demoGuest = current.guests.find((item) => item.id === demoGuestId);
      if (!demoGuest) {
        setStatus('notFound');
        return;
      }
      const assignment = current.assignments[demoGuest.id];
      const table = assignment
        ? current.tables.find((t) => t.id === assignment.tableId)
        : undefined;
      const data: InvitationData = {
        info: current.info,
        guest: demoGuest,
        seat:
          table && assignment
            ? { tableName: table.name, seatIndex: assignment.seatIndex }
            : null,
      };
      setInvitation(data);
      if (data.guest.rsvp === 'attending' || data.guest.rsvp === 'declined') {
        setAlreadyAnswered(true);
        setChoice(data.guest.rsvp);
        setCompanions(data.guest.companions ?? 0);
        setAllergy(data.guest.allergy ?? '');
        setMemo(data.guest.memo ?? '');
      }
      setStatus('ready');
      return;
    }

    async function load() {
      try {
        const current = stateRef.current;
        const guest = cloudEnabled
          ? undefined
          : current.guests.find((item) => item.inviteToken === token);
        const localSeat = (() => {
          if (!guest) return null;
          const assignment = current.assignments[guest.id];
          if (!assignment) return null;
          const table = current.tables.find((t) => t.id === assignment.tableId);
          return table
            ? { tableName: table.name, seatIndex: assignment.seatIndex }
            : null;
        })();
        const data: InvitationData | null = cloudEnabled
          ? await fetchInvitation(token)
          : guest
            ? { info: current.info, guest, seat: localSeat }
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

        // 開封記録： ローカルモードでは状態に直接残す（クラウドモードでは
        // get_invitation RPC がサーバー側で記録する）。最初の1回だけ。
        if (!cloudEnabled && guest && !guest.openedAt) {
          dispatch({
            type: 'updateGuest',
            guest: { ...guest, openedAt: new Date().toISOString() },
          });
        }
      } catch {
        if (!cancelled) setStatus('notFound');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, demoGuestId]);

  async function handleSubmit() {
    if (!invitation || choice === null || submitting) return;
    setSubmitting(true);
    setError('');
    const companionCount = choice === 'attending' ? companions : 0;

    try {
      if (demoGuestId !== undefined) {
        // デモの見本：送信はせず、デモ用ストアの中だけで回答を反映する
        // （戻るとゲスト一覧・席次で連動を確認できる。本番データには触れない）。
        const fullGuest = state.guests.find((item) => item.id === demoGuestId);
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
      } else if (cloudEnabled) {
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
        {demoPreview && <DemoSampleNotice onClose={onClose} />}
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
          {demoPreview && invitation && (
            <p className="muted">
              ゲスト「{invitation.guest.name}」さんの回答がデモに反映されました。「デモに戻る」から「ゲスト・出欠」で確認できます。
            </p>
          )}
          <ServiceCredit />
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
        {demoPreview && <DemoSampleNotice onClose={onClose} />}
        <section className="card" role="status" aria-live="polite">
          <p>{text}</p>
        </section>
      </main>
    );
  }

  const { info, guest } = invitation;

  return (
    <main className="rsvp-page">
      {demoPreview && <DemoSampleNotice onClose={onClose} />}
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
        {invitation.seat && (
          <p className="inv-seat">
            お席のご案内： {invitation.seat.tableName} {invitation.seat.seatIndex + 1}番席
          </p>
        )}
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
            <div className="segmented seg-rsvp" role="group" aria-label="出欠">
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
            <p className="field-help" id="companions-help">ご家族など、あなたと一緒に参加される方の人数です（出席の場合のみ有効）</p>
          </div>

          <div className="field">
            <label htmlFor="rsvp-allergy">アレルギー</label>
            <input id="rsvp-allergy" className="input" value={allergy} onChange={(event) => setAllergy(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rsvp-memo">メッセージ</label>
            <textarea id="rsvp-memo" className="input" rows={3} value={memo} onChange={(event) => setMemo(event.target.value)} />
          </div>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={choice === null || submitting}>
          {submitting ? '送信中…' : '送信する'}
        </button>
      </form>
      <ServiceCredit />
    </main>
  );
}
