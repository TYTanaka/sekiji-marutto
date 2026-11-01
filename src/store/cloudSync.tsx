import { useEffect, useRef, useState } from 'react';
import { cloudEnabled } from '../lib/config';
import { newInviteToken } from '../lib/tokens';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { fetchOpens as FetchOpensFn } from '../lib/supabase';
import { useAppState } from './appState';
import { createEmptyState, createSeedState } from '../lib/seed';
import type { AppState } from '../types';

/** サンプルデータに含まれる招待トークン（公開ソースに載っている固定値） */
const SEED_TOKENS: ReadonlySet<string> = new Set(
  createSeedState().guests.map((g) => g.inviteToken),
);

const LEGACY_BACKUP_KEY = 'sekiji-legacy-backup-v1';
const STORAGE_KEY = 'sekiji-state-v2';

type WeddingRow = {
  id: string;
  state: unknown;
  updated_at: string;
};

export function CloudSync() {
  const { state, dispatch, reportCloud, reportOpens, hadStoredData } = useAppState();
  const stateRef = useRef(state);
  const rowIdRef = useRef<string | null>(null);
  const lastWrittenRef = useRef<string>('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  // クラウドに自分の行が無く、この端末に旧データがある場合の「明示的な取り込み」待ち
  const [importPrompt, setImportPrompt] = useState(false);
  const pendingUserRef = useRef<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  // Supabase クライアントは初期表示のバンドルから分離し、必要になった時点で読み込む
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const fetchOpensRef = useRef<typeof FetchOpensFn | null>(null);

  useEffect(() => {
    if (!cloudEnabled) return;
    let active = true;
    void import('../lib/supabase').then((m) => {
      if (!active) return;
      fetchOpensRef.current = m.fetchOpens;
      setClient(m.supabase);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!cloudEnabled || !client) return;
    let disposed = false;
    let generation = 0;
    let activeUserId: string | null = null;

    const reset = () => {
      rowIdRef.current = null;
      lastWrittenRef.current = '';
      setRowId(null);
      reportCloud('idle');
      reportOpens({});
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };

    const load = async (userId: string | null) => {
      if (disposed || userId === activeUserId) return;
      activeUserId = userId;
      const request = ++generation;
      reset();
      if (!userId) return;

      const { data, error } = await client
        .from('weddings')
        .select('id,state,updated_at')
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (disposed || request !== generation) return;
      if (error) {
        activeUserId = null;
        return;
      }

      const row = (data as unknown as WeddingRow[] | null)?.[0];
      if (row) {
        rowIdRef.current = row.id;
        lastWrittenRef.current = JSON.stringify(row.state);
        dispatch({ type: 'hydrate', state: row.state as AppState });
        setRowId(row.id);
        reportCloud('synced');
        void fetchOpensRef.current?.(row.id).then((result) => {
          if (!disposed && request === generation) reportOpens(result);
        });
        return;
      }

      // クラウドに自分のデータがまだ無い場合。
      // この端末に以前から保存されたデータがある場合は、勝手にアップロードせず、
      // 本人が「取り込む」と選んだときだけ作成する（旧データの所有者・用途を推測しない）。
      if (hadStoredData) {
        pendingUserRef.current = userId;
        setImportPrompt(true);
        return;
      }

      // 端末にもデータが無い新規ユーザーは、サンプルではなく空の状態から始める。
      const empty = createEmptyState();
      const json = JSON.stringify(empty);
      const { data: inserted, error: insertError } = await client
        .from('weddings')
        .insert({ owner_id: userId, state: empty })
        .select('id')
        .single();

      if (disposed || request !== generation) return;
      if (insertError || !inserted) {
        activeUserId = null;
        return;
      }

      const insertedRow = inserted as unknown as { id: string };
      rowIdRef.current = insertedRow.id;
      lastWrittenRef.current = json;
      dispatch({ type: 'hydrate', state: empty });
      setRowId(insertedRow.id);
      reportCloud('synced');
    };

    const { data: authListener } = client.auth.onAuthStateChange(
      (_event, session) => {
        // Defer database work until the auth callback has returned.
        void Promise.resolve().then(() => load(session?.user.id ?? null));
      },
    );

    const initialGeneration = generation;
    void client.auth.getSession().then(({ data, error }) => {
      if (disposed || error || generation !== initialGeneration) return;
      return load(data.session?.user.id ?? null);
    }).catch(() => undefined);

    return () => {
      disposed = true;
      ++generation;
      authListener.subscription.unsubscribe();
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [dispatch, reportCloud, reportOpens, hadStoredData, client]);

  useEffect(() => {
    if (!cloudEnabled || !client || !rowId) return;
    let disposed = false;
    const channel = client
      .channel('weddings-' + rowId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'weddings',
          filter: `id=eq.${rowId}`,
        },
        (payload) => {
          if (disposed || rowIdRef.current !== rowId) return;
          const incoming = (payload.new as { state: unknown }).state as AppState;
          const json = JSON.stringify(incoming);
          if (json !== lastWrittenRef.current) {
            if (saveTimerRef.current !== null) {
              clearTimeout(saveTimerRef.current);
              saveTimerRef.current = null;
            }
            lastWrittenRef.current = json;
            dispatch({ type: 'hydrate', state: incoming });
          }
        },
      )
      .subscribe();

    const opensChannel = client
      .channel('opens-' + rowId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'invitation_opens',
          filter: `wedding_id=eq.${rowId}`,
        },
        () => {
          if (disposed || rowIdRef.current !== rowId) return;
          void fetchOpensRef.current?.(rowId).then((result) => {
            if (!disposed) reportOpens(result);
          });
        },
      )
      .subscribe();

    return () => {
      disposed = true;
      void client.removeChannel(channel);
      void client.removeChannel(opensChannel);
    };
  }, [rowId, dispatch, reportOpens, client]);

  useEffect(() => {
    if (!cloudEnabled || !client || !rowIdRef.current) return;
    const targetId = rowIdRef.current;
    const json = JSON.stringify(state);
    if (json === lastWrittenRef.current) return;
    let cancelled = false;
    reportCloud('syncing');

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      if (rowIdRef.current !== targetId) return;
      void (async () => {
        const { error } = await client.from('weddings')
          .update({ state, updated_at: new Date().toISOString() })
          .eq('id', targetId);
        if (!cancelled && rowIdRef.current === targetId) {
          if (error) {
            reportCloud('error');
          } else {
            lastWrittenRef.current = json;
            reportCloud('synced');
          }
        }
      })().catch(() => {
        if (!cancelled) reportCloud('error');
      });
    }, 800);

    return () => {
      cancelled = true;
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [state, rowId, reportCloud, client]);

  async function createRowWith(initial: AppState): Promise<boolean> {
    if (!client || !pendingUserRef.current) return false;
    const { data: inserted, error } = await client
      .from('weddings')
      .insert({ owner_id: pendingUserRef.current, state: initial })
      .select('id')
      .single();
    if (error || !inserted) return false;
    const insertedRow = inserted as unknown as { id: string };
    rowIdRef.current = insertedRow.id;
    lastWrittenRef.current = JSON.stringify(initial);
    setRowId(insertedRow.id);
    reportCloud('synced');
    return true;
  }

  async function importLocalData() {
    if (importBusy) return;
    setImportBusy(true);
    try {
      // サンプル由来の既知トークン（公開ソースに載る固定値・連番）は、本番投入の時点で再発行する
      const current = stateRef.current;
      const rotated: AppState = {
        ...current,
        guests: current.guests.map((g) =>
          SEED_TOKENS.has(g.inviteToken) || /^inv-lg\d+$/.test(g.inviteToken)
            ? { ...g, inviteToken: newInviteToken() }
            : g,
        ),
      };
      const ok = await createRowWith(rotated);
      if (ok) {
        dispatch({ type: 'hydrate', state: rotated });
        pendingUserRef.current = null;
        setImportPrompt(false);
      }
    } finally {
      setImportBusy(false);
    }
  }

  async function startFresh() {
    if (importBusy) return;
    setImportBusy(true);
    try {
      // 空で始める場合も、端末の旧データは別名キーへ退避して保持する（推測で消さない）
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw && !localStorage.getItem(LEGACY_BACKUP_KEY)) {
          localStorage.setItem(LEGACY_BACKUP_KEY, raw);
        }
      } catch {
        // Storage unavailable; proceed without the extra copy.
      }
      const empty = createEmptyState();
      const ok = await createRowWith(empty);
      if (ok) {
        dispatch({ type: 'hydrate', state: empty });
        pendingUserRef.current = null;
        setImportPrompt(false);
      }
    } finally {
      setImportBusy(false);
    }
  }

  if (!importPrompt) return null;

  return (
    <section className="cloud-import-banner card" role="dialog" aria-label="この端末のデータの取り込み">
      <h2>この端末に保存されたデータがあります</h2>
      <p className="muted">
        以前のバージョンでこの端末に保存された準備データが見つかりました。
        クラウドへ自動では送りません。あなたのデータであれば取り込んでください。
        取り込まない場合は空の状態から始めます（端末のデータはバックアップとして別名で保持されます）。
      </p>
      <div className="auth-actions">
        <button type="button" className="btn-primary" disabled={importBusy} onClick={() => void importLocalData()}>
          この端末のデータをクラウドに取り込む
        </button>
        <button type="button" className="btn-ghost" disabled={importBusy} onClick={() => void startFresh()}>
          空の状態ではじめる
        </button>
      </div>
    </section>
  );
}
