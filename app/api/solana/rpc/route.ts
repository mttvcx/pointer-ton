import { NextResponse, type NextRequest } from 'next/server';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getUserByPrivyId } from '@/lib/db/users';
import { getHeliusRpcUrl } from '@/lib/utils/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Auth-gated Solana JSON-RPC proxy for the MOBILE app.
 *
 * Why this exists: @privy-io/expo only offers `signAndSendTransaction` (no
 * sign-only), so the embedded wallet must broadcast through a `connection` the
 * app provides. We point that connection here so the private Helius key stays on
 * the server (never in the app bundle — no #8100002, no credit-key exposure).
 * Gated by a valid Privy token + a method allow-list so it can't be abused as a
 * free public RPC.
 */
const ALLOWED = new Set([
  'sendTransaction',
  'simulateTransaction',
  'getLatestBlockhash',
  'getFeeForMessage',
  'getSignatureStatuses',
  'getSignatureStatus',
  'getBalance',
  'getAccountInfo',
  'getMultipleAccounts',
  'getTokenAccountBalance',
  'getTokenAccountsByOwner',
  'getMinimumBalanceForRentExemption',
  'getEpochInfo',
  'getSlot',
  'getRecentPrioritizationFees',
]);

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 });
  }
  try {
    const verified = await verifyPrivyAccessToken(accessToken);
    const user = await getUserByPrivyId(verified.privyId);
    if (!user) return NextResponse.json({ error: 'user_not_synced' }, { status: 403 });
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // web3.js may batch (array) or single. Enforce the method allow-list on every call.
  const calls = Array.isArray(body) ? body : [body];
  for (const c of calls) {
    const method = (c as { method?: unknown })?.method;
    if (typeof method !== 'string' || !ALLOWED.has(method)) {
      return NextResponse.json({ error: 'method_not_allowed', method }, { status: 403 });
    }
  }

  try {
    const upstream = await fetch(getHeliusRpcUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[solana/rpc] proxy failed', err);
    return NextResponse.json({ error: 'rpc_proxy_failed' }, { status: 502 });
  }
}
