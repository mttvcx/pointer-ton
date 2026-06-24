import { getAccessToken } from '@privy-io/expo';
import { api } from './client';
import type {
  ExplainTokenResponse,
  PulseColumn,
  PulseFeed,
  TokenDetail,
  Verdict,
} from '../types';

/* ---------- public reads (no auth) ---------- */

export function getPulseFeed(column: PulseColumn = 'new', chain = 'sol'): Promise<PulseFeed> {
  return api<PulseFeed>(`/api/pulse/feed?column=${column}&chain=${chain}`);
}

export function getToken(mint: string): Promise<TokenDetail> {
  return api<TokenDetail>(`/api/tokens/${encodeURIComponent(mint)}`);
}

/* ---------- authed (Privy bearer) ---------- */

export async function getMe(): Promise<unknown> {
  const token = await getAccessToken();
  return api('/api/me', { token });
}

/** The wedge: AI safety read for a token. `fast` is cheap + cached server-side. */
export async function explainToken(mint: string, mode: 'fast' | 'deep' = 'fast'): Promise<ExplainTokenResponse> {
  const token = await getAccessToken();
  return api<ExplainTokenResponse>('/api/ai/explain-token', {
    token,
    method: 'POST',
    body: { mint, mode, surface: 'hover' },
  });
}

/** Collapse the AI riskFlags + confidence into the 3-state buy-screen chip. */
export function deriveVerdict(riskFlags: string[], confidence: 'low' | 'medium' | 'high'): Verdict {
  const n = riskFlags.length;
  if (n >= 3 || (n >= 2 && confidence !== 'low')) return 'high_risk';
  if (n >= 1) return 'caution';
  return 'healthy';
}
