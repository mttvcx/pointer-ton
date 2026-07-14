import 'server-only';

type PrivyLinkedAccount = {
  type: string;
  address?: string;
  chain_type?: string;
  connector_type?: string;
};

type PrivyUserLinkedAccounts = {
  linked_accounts: PrivyLinkedAccount[];
};

export type PrivyLinkedSolanaWallet = {
  address: string;
  isEmbedded: boolean;
  /** Privy connector hint — e.g. phantom, embedded, solflare. */
  connectorType: string | null;
};

function isEmbeddedConnector(connectorType: string | null | undefined): boolean {
  return connectorType === 'embedded';
}

/**
 * All Solana wallets linked on the Privy user — embedded Pointer wallets and
 * external connectors (Phantom, Solflare, …).
 */
export function listPrivyLinkedSolanaWalletsFromUser(user: PrivyUserLinkedAccounts): PrivyLinkedSolanaWallet[] {
  const out: PrivyLinkedSolanaWallet[] = [];
  for (const acct of user.linked_accounts) {
    if (acct.type !== 'wallet') continue;
    if (!('address' in acct) || typeof acct.address !== 'string') continue;
    if (!('chain_type' in acct) || acct.chain_type !== 'solana') continue;
    const wa = acct as {
      address: string;
      chain_type: 'solana';
      connector_type?: string;
    };
    out.push({
      address: wa.address,
      isEmbedded: isEmbeddedConnector(wa.connector_type),
      connectorType: wa.connector_type ?? null,
    });
  }
  return out;
}

export function labelForLinkedSolanaWallet(w: PrivyLinkedSolanaWallet, _isPrimary: boolean): string {
  // Pointer-created wallets are stored with the auto label "Pointer Wallet"; the UI
  // renders them as "Pointer Wallet N" (numbered per chain) via resolveWalletDisplayNames.
  if (w.isEmbedded) return 'Pointer Wallet';
  if (w.connectorType === 'phantom') return 'Phantom';
  if (w.connectorType === 'solflare') return 'Solflare';
  if (w.connectorType === 'backpack') return 'Backpack';
  return 'Connected wallet';
}
