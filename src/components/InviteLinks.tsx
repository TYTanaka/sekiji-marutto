import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAppState } from '../store/appState';
import {
  inviteUrlFor,
  buildInviteMessage,
  buildReminderMessage,
} from '../lib/reminder';
import { RSVP_LABELS } from '../types';

export function InviteLinks() {
  const { state } = useAppState();
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

  return (
    <section className="card">
      <h2>ゲスト別 招待リンク</h2>
      <p className="muted">
        ゲストごとの招待リンクをコピーするか、LINEで送れます。
        QRコードは紙の案内状などにご利用いただけます。
      </p>

      {state.guests.map((guest) => {
        const id = String(guest.id);
        const url = inviteUrlFor(guest.inviteToken);
        const text = buildInviteMessage(guest, state.info, url);
        const isQrOpen = openQrId === id;

        return (
          <div className="guest-row" key={guest.id}>
            <div>
              <strong>{guest.name}</strong>{' '}
              <span className={`badge ${guest.rsvp}`}>
                {RSVP_LABELS[guest.rsvp]}
              </span>
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

            <div className="row-actions">
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

              <span className="muted" role="status" aria-live="polite">
                {copiedId === id ? 'コピーしました' : ''}
              </span>
            </div>

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
