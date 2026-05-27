'use client';

import { isValidTokenMintParam } from '@/lib/chains/mintKind';

export const MINT_CLIPBOARD_SIGNAL = 'pointer:mint-clipboard';

/** Fired after an in-app mint copy — clipboard peek cannot rely on paste/focus alone. */
export function signalMintCopied(mint: string) {
  if (typeof window === 'undefined') return;
  const text = mint.trim();
  if (!text || !isValidTokenMintParam(text)) return;
  window.dispatchEvent(new CustomEvent(MINT_CLIPBOARD_SIGNAL, { detail: text }));
}
