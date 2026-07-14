'use client';

import { useEffect, useRef } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { applyServerLayout, snapshotLayout } from '@/lib/layout/layoutSyncKeys';

/**
 * Account-level workspace/layout sync. Mounted once in the app shell.
 *
 * On login: pull the user's saved layout. If it differs from THIS browser's
 * (i.e. a new device), write it in and reload ONCE so the persisted stores
 * re-init from the restored layout. Same-device logins see no change → no reload.
 *
 * While signed in: every few seconds (and on tab-hide), if the layout changed,
 * push a snapshot up. Last-writer-wins, which is right for "arrange my terminal".
 *
 * Fully best-effort — any failure just falls back to local-only (today's behavior).
 */
const HYDRATED_FLAG = 'pointer.uiPrefs.hydrated'; // sessionStorage — survives the one reload
const SAVE_INTERVAL_MS = 10_000;

export function LayoutSync() {
  const { authenticated, getAccessToken } = usePointerAuth();
  const savingRef = useRef(false);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!authenticated) {
      // On logout, clear the flag so the next account re-hydrates its own layout.
      try {
        sessionStorage.removeItem(HYDRATED_FLAG);
      } catch {
        /* ignore */
      }
      return;
    }
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const save = async (useKeepalive = false) => {
      if (savingRef.current) return;
      const snap = snapshotLayout();
      const serialized = JSON.stringify(snap);
      if (serialized === lastSavedRef.current || Object.keys(snap).length === 0) return;
      savingRef.current = true;
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch('/api/ui-prefs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ prefs: snap }),
          keepalive: useKeepalive,
        });
        if (res.ok) lastSavedRef.current = serialized;
      } catch {
        /* best-effort */
      } finally {
        savingRef.current = false;
      }
    };

    const startSaveLoop = () => {
      lastSavedRef.current = JSON.stringify(snapshotLayout());
      interval = setInterval(() => void save(), SAVE_INTERVAL_MS);
    };

    const hydrate = async () => {
      // Already hydrated this tab-session (incl. across the one restore-reload).
      let already = false;
      try {
        already = sessionStorage.getItem(HYDRATED_FLAG) === '1';
      } catch {
        /* ignore */
      }

      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        const res = await fetch('/api/ui-prefs', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) {
          if (!already) startSaveLoop(); // GET failed → don't reload, just save local
          return;
        }
        const json = (await res.json()) as { prefs?: Record<string, string> };
        const server = json.prefs ?? {};

        if (!already) {
          const changed = applyServerLayout(server);
          try {
            sessionStorage.setItem(HYDRATED_FLAG, '1');
          } catch {
            /* ignore */
          }
          if (changed) {
            // Restore layout from the account (new device) — reload once to re-init stores.
            window.location.reload();
            return;
          }
        }
        if (!cancelled) startSaveLoop();
      } catch {
        if (!already && !cancelled) startSaveLoop();
      }
    };

    void hydrate();

    const onHide = () => {
      if (document.visibilityState === 'hidden') void save(true);
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', () => void save(true));

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [authenticated, getAccessToken]);

  return null;
}
