import 'server-only';

/**
 * Pointer Financial → Bridge (bridge.xyz) client.
 *
 * Bridge is the single provider behind the whole money-movement stack: KYC'd
 * customers, virtual bank accounts + rails, and issued (virtual/physical) cards
 * with Apple Pay push-provisioning. Users never see "Bridge" — only "Pointer
 * Financial".
 *
 * KEY-GATED: with no `BRIDGE_API_KEY` set (the current state — no keys yet), the
 * whole layer reports "not configured" and the app falls back to its local
 * simulation. Nothing here fabricates a funded account or a real card.
 *
 * NOTE: the REST paths below follow Bridge's documented sandbox shape but MUST be
 * re-verified against their current API before flipping this on with a live key.
 */

export class BridgeNotConfiguredError extends Error {
  constructor() {
    super('BRIDGE_NOT_CONFIGURED');
    this.name = 'BridgeNotConfiguredError';
  }
}

export function isBridgeConfigured(): boolean {
  return !!process.env.BRIDGE_API_KEY?.trim();
}

function bridgeBase(): string {
  // Sandbox by default; set BRIDGE_API_BASE to the production host to go live.
  return process.env.BRIDGE_API_BASE?.trim() || 'https://api.sandbox.bridge.xyz';
}

async function bridgeFetch<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown; idempotencyKey?: string }): Promise<T> {
  const key = process.env.BRIDGE_API_KEY?.trim();
  if (!key) throw new BridgeNotConfiguredError();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Api-Key': key };
  if (init?.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;
  const res = await fetch(`${bridgeBase()}${path}`, {
    method: init?.method ?? (init?.body ? 'POST' : 'GET'),
    headers,
    body: init?.body != null ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (json && typeof json === 'object' && 'message' in json && String((json as Record<string, unknown>).message)) || `Bridge request failed (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

/* ── Shapes we depend on (subset) ────────────────────────── */

export type BridgeCard = {
  id: string;
  last4: string;
  status: string; // 'active' | 'frozen' | ...
  form_factor?: string; // 'virtual' | 'physical'
  spending_limit?: { amount?: number };
};

export type CardProvisioning = {
  cardholderName: string;
  primaryAccountSuffix: string;
  // Opaque encrypted payload handed to the native PassKit add-to-wallet call.
  payload: unknown;
};

/* ── Operations (thin) ───────────────────────────────────── */

export const bridge = {
  configured: isBridgeConfigured,

  async createCustomer(input: { legalName: string; country: string; fullKyc: boolean; idemKey: string }): Promise<{ id: string; kycTier: number }> {
    const c = await bridgeFetch<{ id: string }>('/v0/customers', {
      method: 'POST',
      idempotencyKey: input.idemKey,
      body: { type: 'individual', full_name: input.legalName, residential_address: { country: input.country } },
    });
    return { id: c.id, kycTier: input.fullKyc ? 2 : 1 };
  },

  async createVirtualAccount(customerId: string, idemKey: string): Promise<{ id: string }> {
    return bridgeFetch<{ id: string }>(`/v0/customers/${customerId}/virtual_accounts`, {
      method: 'POST',
      idempotencyKey: idemKey,
      body: { currency: 'usd' },
    });
  },

  async issueVirtualCard(customerId: string, idemKey: string): Promise<BridgeCard> {
    return bridgeFetch<BridgeCard>(`/v0/customers/${customerId}/cards`, {
      method: 'POST',
      idempotencyKey: idemKey,
      body: { form_factor: 'virtual', currency: 'usd' },
    });
  },

  async getCard(customerId: string, cardId: string): Promise<BridgeCard> {
    return bridgeFetch<BridgeCard>(`/v0/customers/${customerId}/cards/${cardId}`);
  },

  async applePayProvisioning(customerId: string, cardId: string): Promise<CardProvisioning> {
    return bridgeFetch<CardProvisioning>(`/v0/customers/${customerId}/cards/${cardId}/apple_pay_provisioning`, { method: 'POST', body: {} });
  },
};
