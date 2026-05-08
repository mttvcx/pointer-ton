import 'server-only';

import { normalizeTonAddress } from '@/lib/utils/tonAddress';

const TON_API_BASE =
  process.env.TON_API_BASE_URL?.replace(/\/$/, '') ?? 'https://tonapi.io';
const TON_API_KEY = process.env.TON_API_KEY?.trim();

function headers(): HeadersInit {
  const h: Record<string, string> = { accept: 'application/json' };
  if (TON_API_KEY) h.authorization = `Bearer ${TON_API_KEY}`;
  return h;
}

/**
 * Jetton balance (raw integer string) for `owner` holding `jettonMaster`, via TonAPI.
 */
export async function fetchWalletJettonBalanceRaw(opts: {
  owner: string;
  jettonMaster: string;
}): Promise<string> {
  const owner = normalizeTonAddress(opts.owner);
  const master = normalizeTonAddress(opts.jettonMaster);
  if (!owner || !master) return '0';

  const url = `${TON_API_BASE}/v2/accounts/${encodeURIComponent(owner)}/jettons/${encodeURIComponent(master)}`;
  const res = await fetch(url, { headers: headers(), next: { revalidate: 15 } });
  if (res.status === 404) return '0';
  if (!res.ok) {
    throw new Error(`tonapi_jetton_balance_${res.status}`);
  }
  const json = (await res.json()) as { balance?: string };
  const bal = json.balance;
  if (bal == null || !/^\d+$/.test(bal)) return '0';
  return bal;
}
