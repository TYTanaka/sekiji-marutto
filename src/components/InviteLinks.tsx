import { useState } from 'react';
import { useAppState } from '../store/appState';
import { RSVP_LABELS } from '../types';

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.readOnly = true;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';

    const previousFocus = document.activeElement;
    document.body.appendChild(textarea);

    try {
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);

      if (!document.execCommand('copy')) {
        throw new Error('コピーに失敗しました。');
      }
    } finally {
      textarea.remove();
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    }
  }
}

export function InviteLinks() {
  const { state } = useAppState();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState('');
  const base = window.location.origin + window.location.pathname;

  async function handleCopy(id: string, link: string): Promise<void> {
    setCopyError('');

    try {
      await copyText(link);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 2000);
    } catch {
      setCopyError('コピーできませんでした。リンクを選択してコピーしてください。');
    }
  }

  return (
    <div className="card">
      <h2>招待リンク（ゲストごと）</h2>
      <p>
        ゲストごとに専用リンクを送ると、ログインなしで招待状の確認と出欠回答ができます。回答は名簿へ自動で反映されます。
      </p>

      {copyError && <p role="alert">{copyError}</p>}

      {state.guests.length === 0 ? (
        <p>ゲストがまだいません。</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {state.guests.map((guest) => {
            const link = `${base}#/rsvp/${guest.inviteToken}`;

            return (
              <li key={guest.id} style={{ padding: '12px 0', minWidth: 0 }}>
                <div>
                  <strong>{guest.name}</strong>{' '}
                  <small>{guest.title}</small>{' '}
                  <span className="badge">{RSVP_LABELS[guest.rsvp]}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="text"
                    readOnly
                    value={link}
                    aria-label={`${guest.name}の招待リンク`}
                    title={link}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '0.8rem',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => void handleCopy(guest.id, link)}
                  >
                    {copiedId === guest.id ? 'コピーしました' : 'コピー'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
