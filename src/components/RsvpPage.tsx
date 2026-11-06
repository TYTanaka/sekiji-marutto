import { useEffect, useRef, useState } from 'react';
import {
  cloudEnabled,
  fetchInvitation,
  submitRsvpCloud,
  type InvitationData,
} from '../lib/supabase';
import { useAppState } from '../store/appState';
import { configuredDeadline, isDeadlinePassed } from '../lib/deadline';
import heroUrl from '../assets/hero.webp';

/** 未送信の入力（下書き）を端末内に残すキー。ゲストのトークンごとに分ける */
function draftKeyFor(token: string): string {
  return `sekiji-rsvp-draft-v1:${token}`;
}

interface RsvpDraft {
  choice: Choice | null;
  companions: number;
  allergy: string;
  memo: string;
}

function loadDraft(token: string): RsvpDraft | null {
  try {
    const raw = localStorage.getItem(draftKeyFor(token));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const d = parsed as Record<string, unknown>;
    return {
      choice:
        d.choice === 'attending' || d.choice === 'declined' ? d.choice : null,
      companions:
        typeof d.companions === 'number' && Number.isFinite(d.companions)
          ? d.companions
          : 0,
      allergy: typeof d.allergy === 'string' ? d.allergy : '',
      memo: typeof d.memo === 'string' ? d.memo : '',
    };
  } catch {
    return null;
  }
}

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
type PageStatus = 'loading' | 'notFound' | 'error' | 'ready' | 'submitted';

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
  // 読み込み失敗時の再試行用（増やすと読み込みeffectが再実行される）
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [draftRestored, setDraftRestored] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const loadedKeyRef = useRef<string | null>(null);
  // 読み込み直後の入力値（サーバー/名簿の値）。下書き保存は「ここから変わった時」だけ行う
  const initialValuesRef = useRef<RsvpDraft | null>(null);

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
        const initial: RsvpDraft = {
          choice:
            data.guest.rsvp === 'attending' || data.guest.rsvp === 'declined'
              ? data.guest.rsvp
              : null,
          companions: data.guest.companions ?? 0,
          allergy: data.guest.allergy ?? '',
          memo: data.guest.memo ?? '',
        };
        if (initial.choice !== null) {
          setAlreadyAnswered(true);
          setChoice(initial.choice);
          setCompanions(initial.companions);
          setAllergy(initial.allergy);
          setMemo(initial.memo);
        }
        initialValuesRef.current = initial;
        setStatus('ready');

        // 下書きの復元：前回この端末で入力途中の内容が残っていれば、
        // 名簿の値より優先してフォームへ戻す（離脱しても再入力にならない）
        const draft = loadDraft(token);
        if (
          draft &&
          (draft.choice !== initial.choice ||
            draft.companions !== initial.companions ||
            draft.allergy !== initial.allergy ||
            draft.memo !== initial.memo)
        ) {
          setChoice(draft.choice);
          setCompanions(draft.companions);
          setAllergy(draft.allergy);
          setMemo(draft.memo);
          setDraftRestored(true);
        }

        // 開封記録： ローカルモードでは状態に直接残す（クラウドモードでは
        // get_invitation RPC がサーバー側で記録する）。最初の1回だけ。
        if (!cloudEnabled && guest && !guest.openedAt) {
          dispatch({
            type: 'updateGuest',
            guest: { ...guest, openedAt: new Date().toISOString() },
          });
        }
      } catch {
        // 通信エラーは「招待が見つからない」とは別状態にする
        // （誤認して回答を諦めないよう、再読み込みの導線を出す）
        if (!cancelled) setStatus('error');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, demoGuestId, loadAttempt]);

  function retryLoad() {
    loadedKeyRef.current = null;
    setLoadAttempt((n) => n + 1);
  }

  // 下書きの自動保存：読み込んだ値から入力が変わったら端末内に残す。
  // デモ見本では保存しない（見本の入力が本番リンクの下書きに混ざらないように）。
  useEffect(() => {
    if (demoPreview || status !== 'ready') return;
    const initial = initialValuesRef.current;
    if (!initial) return;
    if (
      choice === initial.choice &&
      companions === initial.companions &&
      allergy === initial.allergy &&
      memo === initial.memo
    ) {
      return;
    }
    try {
      const draft: RsvpDraft = { choice, companions, allergy, memo };
      localStorage.setItem(draftKeyFor(token), JSON.stringify(draft));
    } catch {
      // Storage unavailable: drafts are best-effort.
    }
  }, [choice, companions, allergy, memo, status, demoPreview, token]);

  async function handleSubmit() {
    if (!invitation || choice === null || submitting) return;
    // 回答期限を過ぎていたら送信しない（画面側でもフォームを閉じている）
    if (isDeadlinePassed(invitation.info)) {
      setError(
        '回答期限を過ぎているため、このページからは送信できません。変更をご希望の場合は主催者へご連絡ください。',
      );
      return;
    }
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
          type: 'guestRespond',
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
          type: 'guestRespond',
          guest: {
            ...fullGuest,
            rsvp: choice,
            companions: companionCount,
            allergy,
            memo,
          },
        });
      }
      // 送信できたら下書きは不要になるので消す
      if (!demoPreview) {
        try {
          localStorage.removeItem(draftKeyFor(token));
        } catch {
          // Ignore storage failures.
        }
      }
      setDraftRestored(false);
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

  if (status === 'error') {
    return (
      <main className="rsvp-page">
        {demoPreview && <DemoSampleNotice onClose={onClose} />}
        <section className="card">
          <p>
            読み込みに失敗しました。電波の良い場所でもう一度開いてください。
          </p>
          <button type="button" className="btn btn-primary" onClick={retryLoad}>
            もう一度読み込む
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
        {demoPreview && <DemoSampleNotice onClose={onClose} />}
        <section className="card" role="status" aria-live="polite">
          <p>{text}</p>
        </section>
      </main>
    );
  }

  const { info, guest } = invitation;
  const deadline = configuredDeadline(info);
  const deadlinePassed = isDeadlinePassed(info);

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
        {deadline && !deadlinePassed && (
          <p className="inv-deadline">
            {`回答期限： ${formatJapaneseDate(info.rsvpDeadline!)}までにご回答ください`}
          </p>
        )}
      </section>

      {deadlinePassed ? (
        <section className="card" aria-labelledby="rsvp-closed-title">
          <h2 id="rsvp-closed-title">回答の受付は終了しました</h2>
          <p>
            {`回答期限（${formatJapaneseDate(info.rsvpDeadline!)}）を過ぎたため、このページからの回答・変更は締め切りました。`}
          </p>
          {alreadyAnswered ? (
            <>
              <p>前回ご回答いただいた内容はこちらです。</p>
              <dl className="summary-list">
                <div><dt>出欠</dt><dd>{choice === 'attending' ? '出席' : '欠席'}</dd></div>
                {choice === 'attending' && (
                  <div><dt>同伴者数</dt><dd>{companions}名</dd></div>
                )}
                <div><dt>アレルギー</dt><dd>{allergy || 'なし'}</dd></div>
                <div><dt>メッセージ</dt><dd>{memo || 'なし'}</dd></div>
              </dl>
            </>
          ) : (
            <p>まだご回答はいただいていません。</p>
          )}
          <p className="muted">
            変更をご希望の場合は、お手数ですが主催者（新郎新婦）へ直接ご連絡ください。
          </p>
        </section>
      ) : (
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
        {draftRestored && (
          <p className="hint" role="status">
            下書きを復元しました。前回この端末で入力途中の内容が入っています。
          </p>
        )}
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
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={choice === null || submitting}>
          {submitting ? '送信中…' : '送信する'}
        </button>
      </form>
      )}
      <ServiceCredit />
    </main>
  );
}
