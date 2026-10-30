import { useEffect, useRef, useState } from 'react';
import { supabase, cloudEnabled } from '../lib/supabase';
import { useAppState } from './appState';
import type { AppState } from '../types';

type WeddingRow = {
  id: string;
  state: unknown;
  updated_at: string;
};

export function CloudSync() {
  const { state, dispatch } = useAppState();
  const stateRef = useRef(state);
  const rowIdRef = useRef<string | null>(null);
  const lastWrittenRef = useRef<string>('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!cloudEnabled || !supabase) return;
    const client = supabase;
    let disposed = false;
    let generation = 0;
    let activeUserId: string | null = null;

    const reset = () => {
      rowIdRef.current = null;
      lastWrittenRef.current = '';
      setRowId(null);
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
        return;
      }

      const currentState = stateRef.current;
      const json = JSON.stringify(currentState);
      const { data: inserted, error: insertError } = await client
        .from('weddings')
        .insert({ owner_id: userId, state: currentState })
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
      setRowId(insertedRow.id);
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
  }, [dispatch]);

  useEffect(() => {
    if (!cloudEnabled || !supabase || !rowId) return;
    const client = supabase;
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

    return () => {
      disposed = true;
      void client.removeChannel(channel);
    };
  }, [rowId, dispatch]);

  useEffect(() => {
    if (!cloudEnabled || !supabase || !rowIdRef.current) return;
    const client = supabase;
    const targetId = rowIdRef.current;
    const json = JSON.stringify(state);
    if (json === lastWrittenRef.current) return;
    let cancelled = false;

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      if (rowIdRef.current !== targetId) return;
      void (async () => {
        const { error } = await client.from('weddings')
          .update({ state, updated_at: new Date().toISOString() })
          .eq('id', targetId);
        if (!error && !cancelled && rowIdRef.current === targetId) {
          lastWrittenRef.current = json;
        }
      })().catch(() => undefined);
    }, 800);

    return () => {
      cancelled = true;
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [state, rowId]);

  return null;
}
