/**
 * Circle CCTP (Cross-Chain Transfer Protocol) — Solana → Hyperliquid funding.
 *
 * The one-tap "fund Hyperliquid from your SOL balance" path: SOL→USDC, then CCTP
 * burns native USDC on Solana and mints it to the user's account on HyperCore
 * (the modern rail — the Arbitrum bridge is deprecated).
 *
 * SAFETY: the actual `depositForBurn` (which MOVES funds) is intentionally NOT
 * here yet — it must use Circle's official Solana CCTP program + the CONFIRMED
 * Hyperliquid destination domain, and be validated with a tiny real transfer. A
 * wrong destination domain loses USDC, so we never hardcode/guess it. This module
 * is the safe, read-only plumbing: domains (from env) + Iris attestation polling.
 */

/** Circle's internal CCTP domain numbering (NOT chain ids). Solana is domain 5. */
export const SOLANA_CCTP_DOMAIN = 5;

/**
 * HyperEVM's CCTP destination domain = 19, confirmed from Circle's official
 * "Supported Blockchains and Domains" table. CCTP mints native USDC to the user's
 * address on HyperEVM; a one-click HyperEVM->HyperCore transfer then moves it into
 * perps margin. Env-overridable, but defaults to the confirmed value.
 */
export const HYPEREVM_CCTP_DOMAIN = 19;
export function hyperliquidCctpDomain(): number {
  const raw = process.env.NEXT_PUBLIC_HL_CCTP_DOMAIN?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : HYPEREVM_CCTP_DOMAIN;
}

const IRIS_BASE = process.env.CIRCLE_IRIS_API_URL?.trim() || 'https://iris-api.circle.com';

export type CctpMessage = {
  status: string;
  /** Hex attestation once Circle has signed it (null while 'pending_confirmations'). */
  attestation: string | null;
  message: string | null;
  eventNonce: string | null;
};

/**
 * Poll Circle Iris for the attestation(s) of a CCTP burn, by SOURCE tx hash
 * (CCTP V2 `/v2/messages/{srcDomain}`). Free + read-only. The mint side submits
 * `message`+`attestation` once `status === 'complete'`.
 */
export async function fetchCctpAttestation(srcDomain: number, txHash: string): Promise<CctpMessage[]> {
  const url = `${IRIS_BASE}/v2/messages/${srcDomain}?transactionHash=${encodeURIComponent(txHash)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`iris_${res.status}`);
  const json = (await res.json()) as {
    messages?: { status: string; attestation?: string | null; message?: string | null; eventNonce?: string | null }[];
  };
  return (json.messages ?? []).map((m) => ({
    status: m.status,
    attestation: m.attestation ?? null,
    message: m.message ?? null,
    eventNonce: m.eventNonce ?? null,
  }));
}
