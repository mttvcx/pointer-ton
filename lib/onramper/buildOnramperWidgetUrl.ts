import 'server-only';
import crypto from 'node:crypto';
import type { AppChainId } from '@/lib/chains/appChain';
import { fundingForChain } from '@/lib/onramper/chainFundingConfig';

const ONRAMPER_BUY = 'https://buy.onramper.com/';

export type BuildOnramperWidgetInput = Readonly<{
  activeChain: AppChainId;
  walletAddress: string;
  defaultFiat?: string;
  fiatAmount?: number;
  partnerContext?: string;
}>;

export type BuiltOnramperWidget = Readonly<{
  widgetUrl: string;
  signed: boolean;
}>;

/** Params that contribute to canonical sign content (alphabetical key ordering). */
export type OnramperSignableParts = Partial<
  Readonly<{
    networkWallets: string;
    walletAddressTags: string;
    wallets: string;
  }>
>;

export function canonicalOnramperSignContent(parts: Readonly<OnramperSignableParts>): string {
  const tuples: Array<[string, string]> = [];
  if (parts.networkWallets) tuples.push(['networkWallets', parts.networkWallets]);
  if (parts.walletAddressTags) tuples.push(['walletAddressTags', parts.walletAddressTags]);
  if (parts.wallets) tuples.push(['wallets', parts.wallets]);
  tuples.sort(([a], [b]) => a.localeCompare(b));
  return tuples.map(([k, v]) => `${k}=${v}`).join('&');
}

function hmacSha256Hex(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function readOnlyOnrampsEnv(): string | undefined {
  const raw = process.env.ONRAMPER_ONLY_ONRAMPS?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

/**
 * Compose a buy.onramper.com URL scoped to Pointer’s active chain defaults.
 *
 * Signing: when `ONRAMPER_SIGNING_SECRET` is set server-side we attach `signature` alongside `networkWallets`.
 * Otherwise we omit pinned addresses (Onramper rejects unsigned wallet parameters).
 *
 * Prefer MoonPay narrowly: optionally set `ONRAMPER_ONLY_ONRAMPS=moonpay,...` once confirmed in tenant settings.
 */
export function buildOnramperWidgetUrl(
  args: BuildOnramperWidgetInput,
  env: Readonly<{
    apiKey?: string;
    signingSecret?: string;
  }> = {},
): BuiltOnramperWidget {
  const apiKey =
    env.apiKey?.trim() ??
    process.env.ONRAMPER_API_KEY ??
    process.env.NEXT_PUBLIC_ONRAMPER_API_KEY;

  if (!apiKey?.trim()) {
    throw new Error('Onramper API key not configured (set ONRAMPER_API_KEY or NEXT_PUBLIC_ONRAMPER_API_KEY)');
  }

  const cfg = fundingForChain(args.activeChain).onramper;
  const fiat = args.defaultFiat?.trim()?.toUpperCase() || 'USD';

  const nwPrefix = cfg.networkWalletsPrefix.toLowerCase();
  const networkWalletsRaw = `${nwPrefix}:${args.walletAddress.trim()}`;

  const u = new URL(ONRAMPER_BUY);
  const sp = u.searchParams;

  sp.set('apiKey', apiKey.trim());
  sp.set('mode', 'buy');
  sp.set('defaultFiat', fiat);
  sp.set('defaultCrypto', cfg.defaultCryptoId.toLowerCase());
  sp.set('onlyCryptoNetworks', cfg.onlyCryptoNetworks.toLowerCase());
  sp.set('popularCryptos', cfg.popularCryptos.toLowerCase());
  sp.set('redirectAtCheckout', 'false');
  sp.set('hideTopBar', 'true');

  const onlyOnramps = readOnlyOnrampsEnv();
  if (onlyOnramps) sp.set('onlyOnramps', onlyOnramps.toLowerCase());

  if (
    typeof args.fiatAmount === 'number' &&
    Number.isFinite(args.fiatAmount) &&
    args.fiatAmount > 0 &&
    args.fiatAmount < 500_000
  ) {
    sp.set('defaultAmount', String(Math.round(args.fiatAmount * 100) / 100));
  }

  sp.set(
    'partnerContext',
    (args.partnerContext?.trim()?.length ?? 0) > 0
      ? String(args.partnerContext?.trim())
      : `pointer-${crypto.randomUUID()}`,
  );

  const signingSecret = env.signingSecret?.trim() ?? process.env.ONRAMPER_SIGNING_SECRET?.trim();

  let signed = false;

  if (signingSecret) {
    sp.set('networkWallets', networkWalletsRaw);
    const payload = canonicalOnramperSignContent({ networkWallets: networkWalletsRaw });
    sp.set('signature', hmacSha256Hex(signingSecret, payload));
    signed = true;
  }

  return { widgetUrl: u.href, signed };
}
