import 'server-only';

const SPLITNOW_BASE = 'https://splitnow.io/api';

export type SplitNowAssetLimit = {
  assetId: string;
  networkId: string;
  minDeposit: number;
  maxDeposit: number | null;
};

export type SplitNowQuoteRate = {
  exchangerId: string;
  exchangeRate: number;
  gold?: boolean;
};

export type SplitNowQuoteData = {
  quoteId: string;
  rates: SplitNowQuoteRate[];
};

export type SplitNowOrderData = {
  orderId: string;
  depositAddress: string;
  depositAmount: number;
};

export type SplitNowOrderStatus = {
  orderId: string;
  orderStatus: string;
  orderStatusText?: string;
  orderStatusShort?: string;
};

function apiKey(): string {
  const key = process.env.SPLITNOW_API_KEY?.trim();
  if (!key) throw new Error('splitnow_not_configured');
  return key;
}

async function splitnowFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SPLITNOW_BASE}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': apiKey(),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`splitnow_${res.status}:${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export function splitnowConfigured(): boolean {
  return Boolean(process.env.SPLITNOW_API_KEY?.trim());
}

export async function splitnowGetDepositLimits(): Promise<SplitNowAssetLimit[]> {
  const json = await splitnowFetch<{ data?: SplitNowAssetLimit[] } | SplitNowAssetLimit[]>('/assets/limits/');
  if (Array.isArray(json)) return json;
  return json.data ?? [];
}

export async function splitnowCreateQuote(params: {
  fromAmount: number;
  fromAssetId: string;
  fromNetworkId: string;
  toAssetId: string;
  toNetworkId: string;
}): Promise<SplitNowQuoteData> {
  const created = await splitnowFetch<{ id?: string; quoteId?: string }>('/quotes/', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const quoteId = created.quoteId ?? created.id;
  if (!quoteId) throw new Error('splitnow_quote_missing_id');

  const detail = await splitnowFetch<{ quoteId?: string; id?: string; rates?: SplitNowQuoteRate[] }>(
    `/quotes/${encodeURIComponent(quoteId)}/`,
  );
  return {
    quoteId: detail.quoteId ?? detail.id ?? quoteId,
    rates: detail.rates ?? [],
  };
}

export type WalletDistributionInput = {
  toAddress: string;
  toPctBips: number;
  toAssetId: string;
  toNetworkId: string;
  toExchangerId: string;
};

export async function splitnowCreateOrder(params: {
  quoteId: string;
  fromAmount: number;
  fromAssetId: string;
  fromNetworkId: string;
  walletDistributions: WalletDistributionInput[];
}): Promise<SplitNowOrderData> {
  const created = await splitnowFetch<{ id?: string; orderId?: string }>('/orders/', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const orderId = created.orderId ?? created.id;
  if (!orderId) throw new Error('splitnow_order_missing_id');

  const detail = await splitnowFetch<{
    orderId?: string;
    id?: string;
    depositAddress?: string;
    depositAmount?: number;
  }>(`/orders/${encodeURIComponent(orderId)}/`);

  return {
    orderId: detail.orderId ?? detail.id ?? orderId,
    depositAddress: detail.depositAddress ?? '',
    depositAmount: detail.depositAmount ?? params.fromAmount,
  };
}

export async function splitnowGetOrderStatus(orderId: string): Promise<SplitNowOrderStatus> {
  const detail = await splitnowFetch<SplitNowOrderStatus>(`/orders/${encodeURIComponent(orderId)}/`);
  return detail;
}

export function solMinDeposit(limits: SplitNowAssetLimit[]): number | null {
  const row = limits.find((l) => l.assetId === 'sol' && l.networkId === 'solana');
  return row?.minDeposit ?? null;
}

export function pickDefaultExchanger(rates: SplitNowQuoteRate[]): string {
  const gold = rates.find((r) => r.gold && r.exchangeRate > 0);
  if (gold) return gold.exchangerId;
  const best = rates.filter((r) => r.exchangeRate > 0).sort((a, b) => b.exchangeRate - a.exchangeRate)[0];
  return best?.exchangerId ?? 'binance';
}
