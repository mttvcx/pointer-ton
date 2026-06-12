const RENT_LAMPORTS = 2_039_280;
const HELIUS_REST_CREDITS_EST = 2;

export type HeliusTokenTransfer = {
  fromTokenAccount?: string;
  toTokenAccount?: string;
  fromUserAccount?: string;
  toUserAccount?: string;
  tokenAmount?: number;
  mint?: string;
  tokenStandard?: string;
};

export type HeliusNativeTransfer = {
  fromUserAccount?: string;
  toUserAccount?: string;
  amount?: number;
};

export type HeliusEnhancedTx = {
  signature?: string;
  timestamp?: number;
  slot?: number;
  feePayer?: string;
  type?: string;
  source?: string;
  tokenTransfers?: HeliusTokenTransfer[];
  nativeTransfers?: HeliusNativeTransfer[];
  accountData?: { account?: string }[];
};

function getHeliusApiKey(): string {
  const key = process.env.HELIUS_API_KEY?.trim();
  if (!key) throw new Error('HELIUS_API_KEY missing');
  return key;
}

export function heliusRestBase(): string {
  return 'https://api.helius.xyz/v0';
}

/** Paginated enhanced tx history for one address (Helius REST). */
export async function fetchHeliusAddressTransactions(
  address: string,
  opts?: { before?: string; limit?: number },
): Promise<{ txs: HeliusEnhancedTx[]; calls: number; credits: number }> {
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 100));
  const url = new URL(`${heliusRestBase()}/addresses/${address}/transactions`);
  url.searchParams.set('api-key', getHeliusApiKey());
  url.searchParams.set('limit', String(limit));
  if (opts?.before) url.searchParams.set('before', opts.before);

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`helius_address_tx ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as unknown;
  const txs = Array.isArray(json) ? (json as HeliusEnhancedTx[]) : [];

  if (process.env.NODE_ENV === 'development') {
    console.debug('[helius-indexer]', { address, count: txs.length, credits: HELIUS_REST_CREDITS_EST });
  }

  return { txs, calls: 1, credits: HELIUS_REST_CREDITS_EST };
}

/** Fetch parsed enhanced txs by signature (Helius REST — 1 credit per batch). */
export async function fetchHeliusTransactionsBySignatures(
  signatures: string[],
): Promise<{ txs: HeliusEnhancedTx[]; calls: number; credits: number }> {
  const unique = [...new Set(signatures.map((s) => s.trim()).filter(Boolean))];
  if (unique.length === 0) return { txs: [], calls: 0, credits: 0 };

  const url = new URL(`${heliusRestBase()}/transactions`);
  url.searchParams.set('api-key', getHeliusApiKey());

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ transactions: unique }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`helius_tx_by_sig ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as unknown;
  const txs = Array.isArray(json) ? (json as HeliusEnhancedTx[]) : [];

  return { txs, calls: 1, credits: HELIUS_REST_CREDITS_EST };
}

/** Net SOL delta for a wallet from native transfers (lamports → SOL). */
export function nativeSolDelta(tx: HeliusEnhancedTx, wallet: string): number {
  let lamports = 0;
  for (const n of tx.nativeTransfers ?? []) {
    const amt = n.amount ?? 0;
    if (n.fromUserAccount === wallet) lamports -= amt;
    if (n.toUserAccount === wallet) lamports += amt;
  }
  return lamports / 1e9;
}

/** Gross SOL moved by wallet excluding typical ATA rent refunds. */
export function grossSolFlow(tx: HeliusEnhancedTx, wallet: string, side: 'buy' | 'sell'): number {
  let gross = 0;
  for (const n of tx.nativeTransfers ?? []) {
    const amt = n.amount ?? 0;
    if (amt === RENT_LAMPORTS) continue;
    if (side === 'buy' && n.fromUserAccount === wallet) gross += amt;
    if (side === 'sell' && n.toUserAccount === wallet) gross += amt;
  }
  const sol = gross / 1e9;
  if (sol > 0.000_001) return sol;
  return Math.abs(nativeSolDelta(tx, wallet));
}
