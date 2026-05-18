'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';

function mintFromTokenPath(pathname: string | null): string | null {
  if (!pathname?.startsWith('/token/')) return null;
  const raw = pathname.slice('/token/'.length).split('/')[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function normalizeClipboardLine(raw: string): string {
  return raw.split(/\r?\n/)[0]?.trim() ?? '';
}

export function useClipboardMintPeek() {
  const pathname = usePathname();
  const [peekMint, setPeekMint] = useState<string | null>(null);
  const dismissedRef = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const activePathMint = mintFromTokenPath(pathname ?? null);

  const applyMintCandidate = useCallback(
    (raw: string) => {
      const text = normalizeClipboardLine(raw);
      if (!text || text.length > 96) {
        setPeekMint(null);
        return;
      }
      if (!isValidTokenMintParam(text)) {
        setPeekMint(null);
        return;
      }
      if (dismissedRef.current === text) {
        setPeekMint(null);
        return;
      }
      if (activePathMint === text) {
        setPeekMint(null);
        return;
      }
      setPeekMint(text);
    },
    [activePathMint],
  );

  const readClipboard = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return;
    try {
      const raw = await navigator.clipboard.readText();
      applyMintCandidate(raw);
    } catch {
      /* permission denied or unsupported */
    }
  }, [applyMintCandidate]);

  useEffect(() => {
    const scheduleRead = () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => void readClipboard(), 140);
    };
    window.addEventListener('focus', scheduleRead);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleRead();
    });
    scheduleRead();
    return () => {
      window.removeEventListener('focus', scheduleRead);
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, [readClipboard]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('[data-skip-clipboard-mint-peek]')) return;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      const raw = e.clipboardData?.getData('text/plain') ?? '';
      applyMintCandidate(raw);
    };
    document.addEventListener('paste', onPaste, true);
    return () => document.removeEventListener('paste', onPaste, true);
  }, [applyMintCandidate]);

  useEffect(() => {
    if (!peekMint) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      dismissedRef.current = peekMint;
      setPeekMint(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [peekMint]);

  useEffect(() => {
    if (!peekMint || activePathMint !== peekMint) return;
    const id = window.requestAnimationFrame(() => setPeekMint(null));
    return () => window.cancelAnimationFrame(id);
  }, [activePathMint, peekMint]);

  const dismiss = useCallback(() => {
    if (peekMint) dismissedRef.current = peekMint;
    setPeekMint(null);
  }, [peekMint]);

  return {
    peekMint,
    dismiss,
    dismissedRef,
    setPeekMint,
  };
}
