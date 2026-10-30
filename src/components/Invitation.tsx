import { useMemo, useState } from 'react';
import { useAppState } from '../store/appState';
import type { RsvpStatus } from '../types';
import heroUrl from '../assets/hero.jpg';

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function Invitation() {
  const { state, dispatch } = useAppState();
  const info = state.info;
  const [guestId, setGuestId] = useState(state.guests[0]?.id ?? '');
  const [rsvp, setRsvp] = useState<RsvpStatus | null>(null);
  const [companions, setCompanions] = useState(0);
  const [allergy, setAllergy] = useState('');
  const [memo, setMemo] = useState('');
  const [sent, setSent] = useState(false);

  const days = useMemo(() => {
    const date = parseDate(info.date);
    if (!date) return null;

    const today = new Date();
    const todayUtc = Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const weddingUtc = Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const difference = Math.round((weddingUtc - todayUtc) / 86_400_000);

    return difference < 0 ? null : difference;
  }, [info.date]);

  const formattedDate = useMemo(() => {
    const date = parseDate(info.date);
    if (!date) return '日程未定';

    const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${weekday}）`;
  }, [info.date]);

  const guest = state.guests.find((item) => item.id === guestId);

  function submitResponse() {
    if (!guest || !rsvp) return;

    dispatch({
      type: 'updateGuest',
      guest: { ...guest, rsvp, companions, allergy, memo },
    });
    setSent(true);
  }

  return (
    <section className="view-enter">
      <div className="invitation">
        <img className="hero-img" src={heroUrl} alt="" aria-hidden="true" />
        <p className="inv-kicker">Wedding Invitation</p>
        <h1 className="inv-names">
          {info.groomName} <span className="inv-amp">＆</span> {info.brideName}
        </h1>
        <div className="inv-divider" aria-hidden="true"><span>❀</span></div>
        <p className="inv-date">{formattedDate}</p>
        <p className="inv-venue">{info.venue}</p>
        <p className="inv-message">{info.message}</p>
        {days !== null && (
          <p className="inv-count">{days > 0 ? `挙式まで あと${days}日` : '当日です'}</p>
        )}
      </div>

      <div className="card">
        <h2>ゲスト回答（体験用）</h2>
        <p>
          この画面はゲスト側の回答フォームの体験版です。
          回答すると名簿と席次表に即時反映されます。
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitResponse();
          }}
        >
          <label htmlFor="invitation-guest">ゲスト</label>
          <select
            id="invitation-guest"
            className="select"
            value={guestId}
            onChange={(event) => {
              setGuestId(event.target.value);
              setSent(false);
            }}
          >
            {state.guests.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <div className="segmented" role="group" aria-label="出欠">
            <button
              type="button"
              className={rsvp === 'attending' ? 'active' : ''}
              aria-pressed={rsvp === 'attending'}
              onClick={() => setRsvp('attending')}
            >
              出席
            </button>
            <button
              type="button"
              className={rsvp === 'declined' ? 'active' : ''}
              aria-pressed={rsvp === 'declined'}
              onClick={() => setRsvp('declined')}
            >
              欠席
            </button>
          </div>

          <label htmlFor="invitation-companions">同伴者数</label>
          <select
            id="invitation-companions"
            className="select"
            value={companions}
            onChange={(event) => setCompanions(Number(event.target.value))}
          >
            {[0, 1, 2, 3].map((count) => (
              <option key={count} value={count}>{count}人</option>
            ))}
          </select>

          <label htmlFor="invitation-allergy">アレルギー</label>
          <input
            id="invitation-allergy"
            className="input"
            value={allergy}
            onChange={(event) => setAllergy(event.target.value)}
          />

          <label htmlFor="invitation-memo">メモ</label>
          <input
            id="invitation-memo"
            className="input"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />

          <button type="submit" className="btn primary" disabled={!guest || !rsvp}>
            送信する
          </button>
        </form>

        {sent && (
          <div className="toast" role="status">
            {guest ? `${guest.name}さんの回答（${rsvp === 'attending' ? '出席' : '欠席'}）` : '回答'}を送信しました。名簿に反映されています。
          </div>
        )}
      </div>
    </section>
  );
}
