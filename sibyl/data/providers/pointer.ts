import 'server-only';

import type { KOLMention, LabeledWallet, ProviderStatus } from '@/sibyl/data/providers/types';
import { sibylMockMode } from '@/sibyl/config';

/**
 * Pointer internal DB — THE MOAT. Labeled wallets, KOL wallets, smart/scam wallets,
 * Twitter handles, token classifications, alpha-group mentions. This is the data
 * frontier models can't have. MVP returns a curated mock; wiring it to the real
 * pointer-ton identity registry + community_labels + KOL directory is the top
 * next-step (see CHECKLIST) — read-only, no new coupling to the trading paths.
 */
export function pointerStatus(): ProviderStatus {
  return {
    name: 'pointer',
    // Always "on" — this is our own data; mock until wired to the identity registry.
    configured: !sibylMockMode(),
    envVars: ['(uses Pointer Supabase — SUPABASE_SERVICE_ROLE_KEY)'],
    note: 'Labeled wallets / KOLs / classifications. The proprietary edge.',
  };
}

/** Known-wallet labels for the holders of a token (mock). */
export async function getLabeledWalletsForMint(_mint: string): Promise<LabeledWallet[]> {
  return [
    { address: '5gwLX5nszaqA2dBBXi6a4qNgjRuCy69kM4bJE1Wrx73D', label: 'Cupsey Main', kind: 'kol', handle: 'cupseyy', pnlUsd: 1_620_000 },
    { address: 'B62aHj...bundler', label: 'bundler cluster', kind: 'insider' },
  ];
}

/** Is a named KOL (e.g. "ansem") in this trade? Mock: no ansem entry. */
export async function isPersonInTrade(_mint: string, handle: string): Promise<{ inTrade: boolean; note: string }> {
  const h = handle.toLowerCase().replace(/^@/, '');
  if (h === 'ansem' || h === 'blknoiz06') return { inTrade: false, note: 'No Ansem entry detected on-chain or in mentions.' };
  return { inTrade: false, note: `No confirmed ${handle} entry.` };
}

/** Alpha-group / KOL mentions Pointer has captured for this token (mock). */
export async function getGroupMentions(_mint: string): Promise<KOLMention[]> {
  return [
    { handle: 'sniper_squad', name: 'Sniper Squad', note: '#signals drop, ~5m ago' },
    { handle: 'cented7', name: 'Cented', note: 'holding, called early' },
  ];
}

/** Resolve a handle → Pointer identity (for clickable KOL links). Mock passthrough. */
export async function resolveHandle(handle: string): Promise<{ handle: string; name: string; href: string } | null> {
  const h = handle.replace(/^@/, '');
  if (!h) return null;
  return { handle: h, name: h, href: `https://x.com/${encodeURIComponent(h)}` };
}
