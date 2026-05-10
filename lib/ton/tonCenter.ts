import 'server-only';

/**
 * TON Center HTTP API v2 (JSON-RPC). Used for lightweight on-chain checks
 * (account state) without Solana/Helius RPC for TON jetton masters.
 *
 * @see https://toncenter.com/api/v2/
 */
const TON_CENTER_JSONRPC =
  process.env.TON_CENTER_API_URL?.replace(/\/$/, '') ?? 'https://toncenter.com/api/v2/jsonRPC';

const TON_CENTER_API_KEY = process.env.TON_CENTER_API_KEY?.trim();

type AddressInformation = {
  state?: string;
  /** Present when deployed */
  balance?: string | number;
};

async function tonCenterJsonRpc(method: string, params: Record<string, unknown>): Promise<AddressInformation | null> {
  const bodyParams = { ...params };
  if (TON_CENTER_API_KEY) {
    (bodyParams as Record<string, unknown>).api_key = TON_CENTER_API_KEY;
  }
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method,
    params: bodyParams,
  });

  let res: Response;
  try {
    res = await fetch(TON_CENTER_JSONRPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as {
    result?: AddressInformation;
    error?: { message?: string; code?: number };
  } | null;

  if (!json || json.error) return null;
  if (!json.result || typeof json.result !== 'object') return null;
  return json.result;
}

/**
 * Returns whether `address` is an active on-chain account, or `null` if the
 * RPC could not be queried (caller may still fall back to TonAPI hydrate).
 */
export async function tonCenterAddressIsActive(address: string): Promise<boolean | null> {
  const info = await tonCenterJsonRpc('getAddressInformation', { address });
  if (!info) return null;
  const state = info.state?.toLowerCase();
  if (state === 'active') return true;
  if (state === 'uninitialized' || state === 'frozen') return false;
  return null;
}

/** Native TON balance in nanotons (1e9 per TON), or null if RPC skipped / failed. */
export async function getTonBalanceNano(address: string): Promise<bigint | null> {
  const info = await tonCenterJsonRpc('getAddressInformation', { address });
  if (!info || info.balance == null) return null;
  try {
    return BigInt(String(info.balance));
  } catch {
    return null;
  }
}
