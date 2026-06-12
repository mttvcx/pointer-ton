/**
 * Browser-safe Solana JSON-RPC URLs for Privy embedded-wallet sign/send.
 * Server code should use {@link getHeliusRpcUrl} in `lib/utils/constants.ts`.
 */

const PUBLIC_MAINNET_HTTP = 'https://api.mainnet-beta.solana.com';
const PUBLIC_MAINNET_WS = 'wss://api.mainnet-beta.solana.com';

function heliusUrls(apiKey: string): { http: string; ws: string } {
  const q = `?api-key=${encodeURIComponent(apiKey)}`;
  return {
    http: `https://mainnet.helius-rpc.com/${q}`,
    ws: `wss://mainnet.helius-rpc.com/${q}`,
  };
}

/** HTTP + WebSocket endpoints for Privy `config.solana.rpcs`. */
export function getClientSolanaRpcUrls(): { http: string; ws: string } {
  const override = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (override) {
    const ws =
      process.env.NEXT_PUBLIC_SOLANA_RPC_WS_URL?.trim() ??
      override.replace(/^https:\/\//i, 'wss://');
    return { http: override, ws };
  }

  const heliusKey =
    process.env.NEXT_PUBLIC_HELIUS_API_KEY?.trim() ??
    process.env.NEXT_PUBLIC_HELIUS_RPC_KEY?.trim();
  if (heliusKey) {
    return heliusUrls(heliusKey);
  }

  return { http: PUBLIC_MAINNET_HTTP, ws: PUBLIC_MAINNET_WS };
}
