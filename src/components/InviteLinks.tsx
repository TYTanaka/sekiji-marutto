import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAppState, openedAtFor } from '../store/appState';
import {
  inviteUrlFor,
  buildInviteMessage,
  buildReminderMessage,
} from '../lib/reminder';
import { RSVP_LABELS } from '../types';

function formatOpenedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type LinkFilter = 'all' | 'pending' | 'opened' | 'answered';

const LINK_FILTERS: { key: LinkFilter; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'pending', label: '未回答' },
  { key: 'opened', label: '開封済み・未回答' },
  { key: 'answered', label: '回答済み' },
];

export function InviteLinks() {
  const { state, opens } = useAppState();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LinkFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openQrId, setOpenQrId] = useState<string | null>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current !== null) {
        clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);

      if (feedbackTimer.current !== null) {
        clearTimeout(feedbackTimer.current);
      }

      setCopiedId(id);
      feedbackTimer.current = setTimeout(() => {
        setCopiedId(null);
        feedbackTimer.current = null;
      }, 2000);
    } catch {
      const input = inputRefs.current.get(id);
      input?.focus();
      input?.select();
    }
  }

  const visibleGuests = state.guests.filter((guest) => {
    if (query && !guest.name.includes(query)) return false;
    if (filter === 'pending') return guest.rsvp === 'pending';
    if (filter === 'opened') return guest.rsvp === 'pending' && Boolean(openedAtFor(opens, guest));
    if (filter === 'answered') return guest.rsvp !== 'pending';
    return true;
  });

  return (
    <section className="card">
      <h2>ゲスト別 招待リンク</h2>
      <p className="muted">
        ゲストごとの招待リンクをコピーするか、LINEで送れます。
        QRコードは紙の案内状などにご利用いただけます。「ゲスト画面」から、相手に見える招待ページをそのまま確認できます。
      </p>

      <div className="link-controls">
        <input
          className="input"
          type="search"
          placeholder="名前で検索"
          aria-label="招待リンクを名前で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="segmented" role="group" aria-label="招待リンクの絞り込み">
          {LINK_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={filter === item.key ? 'active' : ''}
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="muted link-count">{visibleGuests.length} 名を表示</span>
      </div>

      {visibleGuests.map((guest) => {
        const id = String(guest.id);
        const url = inviteUrlFor(guest.inviteToken);
        const text = buildInviteMessage(guest, state.info, url);
        const isQrOpen = openQrId === id;
        const openedAt = openedAtFor(opens, guest);

        return (
          <div className="guest-row invite-row" key={guest.id}>
            <div>
              <strong>{guest.name}</strong>{' '}
              <span className={`badge ${guest.rsvp}`}>
                {RSVP_LABELS[guest.rsvp]}
              </span>{' '}
              {guest.rsvp === 'pending' && (
                <span className={`open-chip${openedAt ? ' opened' : ''}`}>
                  {openedAt ? `開封済み ${formatOpenedAt(openedAt)}` : '未開封'}
                </span>
              )}
            </div>

            <input
              ref={(input) => {
                if (input) {
                  inputRefs.current.set(id, input);
                } else {
                  inputRefs.current.delete(id);
                }
              }}
              className="input"
              type="text"
              value={url}
              readOnly
              aria-label={`${guest.name}さんの招待リンク`}
            />

            <div className="invite-actions">
              <button
                className="btn btn-primary"
                type="button"
                aria-label={`${guest.name}さんの招待リンクをコピー`}
                onClick={() => void copyText(id, url)}
              >
                コピー
              </button>

              <a
                className="btn line-btn"
                href={`https://line.me/R/msg/text/?${encodeURIComponent(text)}`}
                target="_blank"
                rel="noreferrer"
              >
                LINEで送る
              </a>

              <a
                className="btn btn-ghost"
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${guest.name}さんのゲスト画面を開く`}
              >
                ゲスト画面
              </a>

              <button
                className="btn btn-ghost"
                type="button"
                aria-label={`${guest.name}さんのQRコードを${isQrOpen ? '閉じる' : '表示'}`}
                aria-expanded={isQrOpen}
                onClick={() => setOpenQrId(isQrOpen ? null : id)}
              >
                QRコード
              </button>

              {guest.rsvp === 'pending' && (
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() =>
                    void copyText(
                      id,
                      buildReminderMessage(guest, state.info, url),
                    )
                  }
                >
                  催促文をコピー
                </button>
              )}

            </div>

            <p className="copy-status" role="status" aria-live="polite">
              {copiedId === id ? 'コピーしました' : ''}
            </p>

            {isQrOpen && (
              <div>
                <div
                  className="qr-box"
                  role="img"
                  aria-label={`${guest.name}さんの招待リンクのQRコード`}
                >
                  <QRCodeSVG value={url} size={148} />
                </div>
                <p className="muted">紙の案内状などに印刷できます</p>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
