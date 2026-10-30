import { useEffect, useMemo, useState } from 'react';
import { useAppState } from '../store/appState';
import { newInviteToken } from '../lib/supabase';
import {
  type Guest,
  type GuestGroup,
  type RsvpStatus,
  type Side,
  GROUP_LABELS,
  RSVP_LABELS,
  SIDE_LABELS,
} from '../types';

type GuestDraft = Omit<Guest, 'id' | 'inviteToken'>;

const sideOptions = Object.entries(SIDE_LABELS) as [Side, string][];
const groupOptions = Object.entries(GROUP_LABELS) as [GuestGroup, string][];
const rsvpOptions = Object.entries(RSVP_LABELS) as [RsvpStatus, string][];

const orderedRsvpOptions = ['出席', '未回答', '欠席'].flatMap((label) =>
  rsvpOptions.filter(([, optionLabel]) => optionLabel === label),
);

function createDraft(guest: Guest | null = null): GuestDraft {
  if (guest) {
    return {
      name: guest.name,
      title: guest.title ?? '',
      side: guest.side,
      group: guest.group,
      rsvp: guest.rsvp,
      allergy: guest.allergy ?? '',
      companions: guest.companions ?? 0,
      memo: guest.memo ?? '',
    };
  }

  return {
    name: '',
    title: '',
    side: sideOptions[0][0],
    group: groupOptions[0][0],
    rsvp:
      rsvpOptions.find(([, label]) => label === '未回答')?.[0] ??
      rsvpOptions[0][0],
    allergy: '',
    companions: 0,
    memo: '',
  };
}

export function GuestManager({ focusPendingSignal = 0 }: { focusPendingSignal?: number }) {
  const { state, dispatch, dispatchWithUndo } = useAppState();
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [pendingRsvp, setPendingRsvp] = useState<{ guestId: string; rsvp: RsvpStatus } | null>(null);
  const [query, setQuery] = useState('');
  const [sideFilter, setSideFilter] = useState<'all' | Side>('all');
  const [rsvpFilter, setRsvpFilter] = useState<'all' | RsvpStatus>('all');
  const [editing, setEditing] = useState<Guest | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<GuestDraft>(() => createDraft());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (focusPendingSignal > 0) setRsvpFilter('pending');
  }, [focusPendingSignal]);

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('ja-JP');

    return state.guests.filter((guest) => {
      const matchesQuery =
        !search ||
        `${guest.name} ${guest.title ?? ''}`
          .toLocaleLowerCase('ja-JP')
          .includes(search);

      return (
        matchesQuery &&
        (sideFilter === 'all' || guest.side === sideFilter) &&
        (rsvpFilter === 'all' || guest.rsvp === rsvpFilter)
      );
    });
  }, [state.guests, query, sideFilter, rsvpFilter]);

  function updateDraft<K extends keyof GuestDraft>(
    field: K,
    value: GuestDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setDraft(createDraft());
  }

  function openEditor(guest: Guest) {
    setEditing(guest);
    setDraft(createDraft(guest));
    setShowForm(true);
  }

  function saveGuest() {
    if (!draft.name.trim()) return;

    const values: GuestDraft = {
      ...draft,
      name: draft.name.trim(),
      title: (draft.title ?? '').trim(),
      allergy: (draft.allergy ?? '').trim(),
      memo: (draft.memo ?? '').trim(),
      companions: Math.min(5, Math.max(0, Math.trunc(draft.companions || 0))),
    };

    if (editing) {
      dispatch({
        type: 'updateGuest',
        guest: { ...editing, ...values },
      });
    } else {
      const id =
        typeof globalThis.crypto?.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : 'g-' + Date.now();

      dispatch({ type: 'addGuest', guest: { ...values, id, inviteToken: newInviteToken() } });
    }

    closeForm();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <section aria-label="ゲスト管理">
      {saved && (
        <div className="toast" role="status">保存しました</div>
      )}
      <button
        type="button"
        className="btn-primary"
        aria-expanded={showForm}
        aria-controls="guest-form"
        onClick={() => {
          if (showForm) {
            closeForm();
          } else {
            setEditing(null);
            setDraft(createDraft());
            setShowForm(true);
          }
        }}
      >
        ＋ ゲストを追加
      </button>

      {showForm && (
        <form
          id="guest-form"
          className="card"
          aria-label={editing ? 'ゲストを編集' : 'ゲストを追加'}
          onSubmit={(event) => {
            event.preventDefault();
            saveGuest();
          }}
        >
          <h2>{editing ? 'ゲストを編集' : 'ゲストを追加'}</h2>
          <label>
            名前（必須）
            <input
              className="input"
              required
              autoFocus
              value={draft.name}
              onChange={(event) => updateDraft('name', event.target.value)}
            />
          </label>
          <label>
            肩書き
            <input
              className="input"
              value={draft.title}
              onChange={(event) => updateDraft('title', event.target.value)}
            />
          </label>
          <label>
            新郎側・新婦側
            <select
              className="input"
              value={draft.side}
              onChange={(event) => updateDraft('side', event.target.value as Side)}
            >
              {sideOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            グループ
            <select
              className="input"
              value={draft.group}
              onChange={(event) =>
                updateDraft('group', event.target.value as GuestGroup)
              }
            >
              {groupOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            出欠
            <select
              className="input"
              value={draft.rsvp}
              onChange={(event) =>
                updateDraft('rsvp', event.target.value as RsvpStatus)
              }
            >
              {orderedRsvpOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            アレルギー
            <input
              className="input"
              value={draft.allergy}
              onChange={(event) => updateDraft('allergy', event.target.value)}
            />
          </label>
          <label>
            同伴者数
            <input
              className="input"
              type="number"
              min={0}
              max={5}
              step={1}
              value={draft.companions}
              onChange={(event) =>
                updateDraft('companions', Number(event.target.value))
              }
            />
          </label>
          <label>
            メモ
            <textarea
              className="input"
              rows={3}
              value={draft.memo}
              onChange={(event) => updateDraft('memo', event.target.value)}
            />
          </label>
          {!draft.name.trim() && (
            <p className="muted" style={{ margin: 0 }}>名前を入力すると保存できます</p>
          )}
          <button type="submit" className="btn-primary" disabled={!draft.name.trim()}>
            保存
          </button>
          <button type="button" className="btn-ghost" onClick={closeForm}>
            キャンセル
          </button>
        </form>
      )}

      <div className="filters">
        <input
          className="input"
          type="search"
          aria-label="名前・肩書きで検索"
          placeholder="名前・肩書きで検索"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="input"
          aria-label="新郎側・新婦側で絞り込み"
          value={sideFilter}
          onChange={(event) => setSideFilter(event.target.value as 'all' | Side)}
        >
          <option value="all">両家すべて</option>
          {sideOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          className="input"
          aria-label="出欠で絞り込み"
          value={rsvpFilter}
          onChange={(event) =>
            setRsvpFilter(event.target.value as 'all' | RsvpStatus)
          }
        >
          <option value="all">出欠すべて</option>
          {orderedRsvpOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <span role="status">{`${filtered.length} 名`}</span>
      </div>

      {state.guests.length === 0 ? (
        <p className="muted">ゲストがまだ登録されていません。ゲストを追加してください。</p>
      ) : filtered.length === 0 ? (
        <p className="muted">該当するゲストがいません</p>
      ) : (
        filtered.map((guest) => (
          <div className="guest-row" key={guest.id}>
            <div>
              <strong>{guest.name}</strong>
              {guest.title && <span> {guest.title}</span>}
              <div>
                <span className="badge">{SIDE_LABELS[guest.side]}</span>{' '}
                <span className="badge">{GROUP_LABELS[guest.group]}</span>{' '}
                {guest.allergy && (
                  <span className="badge badge-allergy">⚠ アレルギー：{guest.allergy}</span>
                )}
                {guest.companions > 0 && <span>（同伴{guest.companions}名）</span>}
              </div>
              {guest.memo && <small className="muted">{guest.memo}</small>}
            </div>
            <div>
              <div className="seg" role="group" aria-label={`${guest.name}さんの出欠`}>
                {orderedRsvpOptions.map(([rsvp, label]) => (
                  <button
                    key={rsvp}
                    type="button"
                    className={guest.rsvp === rsvp ? `on-${rsvp}` : undefined}
                    aria-pressed={guest.rsvp === rsvp}
                    onClick={() => {
                      if (
                        rsvp !== 'attending' &&
                        guest.rsvp === 'attending' &&
                        state.assignments[guest.id]
                      ) {
                        setPendingRsvp({ guestId: guest.id, rsvp });
                        return;
                      }
                      dispatch({ type: 'setRsvp', guestId: guest.id, rsvp });
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" className="btn-ghost" aria-label={`${guest.name}さんを編集`} onClick={() => openEditor(guest)}>
                編集
              </button>
              <button type="button" className="btn-danger-ghost" aria-label={`${guest.name}さんを削除`} onClick={() => setConfirmingDeleteId(guest.id)}>
                削除
              </button>
              {confirmingDeleteId === guest.id && (
                <div className="confirm-inline">
                  <span>{`${guest.name}さんを削除しますか？`}</span>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => {
                      dispatchWithUndo(
                        { type: 'removeGuest', guestId: guest.id },
                        `${guest.name}さんを削除しました`,
                      );
                      setConfirmingDeleteId(null);
                      if (editing?.id === guest.id) closeForm();
                    }}
                  >
                    削除する
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmingDeleteId(null)}>
                    やめる
                  </button>
                </div>
              )}
              {pendingRsvp?.guestId === guest.id && (
                <div className="confirm-inline">
                  <span>{`${guest.name}さんは席次表に配置されています。出欠を変更すると席も外れます。`}</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      dispatch({ type: 'setRsvp', guestId: guest.id, rsvp: pendingRsvp.rsvp });
                      setPendingRsvp(null);
                    }}
                  >
                    変更する
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setPendingRsvp(null)}>
                    やめる
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
