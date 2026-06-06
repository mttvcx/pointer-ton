import 'server-only';

import type { Wallet } from '@privy-io/node';
import { getPrivyServerClient } from '@/lib/privy/config';
import {
  buildPrivyAuthorizationContext,
  getPrivySignerKeyQuorumId,
  serverSignerConfigured,
} from '@/lib/privy/authorizationContext';

export type ServerWalletRescueStatus = {
  configured: boolean;
  quorumId: string | null;
  walletId: string | null;
  hasAppSigner: boolean;
  chain: 'solana' | null;
};

export function walletHasAppSigner(wallet: Wallet, quorumId: string): boolean {
  return (wallet.additional_signers ?? []).some((s) => s.signer_id === quorumId);
}

/** Look up Privy wallet + whether Pointer's server signer quorum is attached. */
export async function getServerWalletRescueStatus(
  walletAddress: string,
): Promise<ServerWalletRescueStatus> {
  const quorumId = getPrivySignerKeyQuorumId();
  const configured = serverSignerConfigured();
  if (!configured || !quorumId) {
    return {
      configured: false,
      quorumId,
      walletId: null,
      hasAppSigner: false,
      chain: null,
    };
  }

  try {
    const wallet = await getPrivyServerClient().wallets().getWalletByAddress({
      address: walletAddress,
    });
    if (wallet.chain_type !== 'solana') {
      return {
        configured: true,
        quorumId,
        walletId: wallet.id,
        hasAppSigner: false,
        chain: null,
      };
    }
    return {
      configured: true,
      quorumId,
      walletId: wallet.id,
      hasAppSigner: walletHasAppSigner(wallet, quorumId),
      chain: 'solana',
    };
  } catch {
    return {
      configured: true,
      quorumId,
      walletId: null,
      hasAppSigner: false,
      chain: null,
    };
  }
}

/**
 * Sign a base64 Jupiter swap tx with Privy server authorization (no user session).
 * Returns base64 signed transaction bytes.
 */
export async function signSolanaSwapTransactionServer(input: {
  walletAddress: string;
  swapTransactionBase64: string;
}): Promise<{ signedTransactionBase64: string; walletId: string }> {
  const auth = buildPrivyAuthorizationContext();
  const quorumId = getPrivySignerKeyQuorumId();
  if (!auth || !quorumId) {
    throw new Error('server_signer_not_configured');
  }

  const status = await getServerWalletRescueStatus(input.walletAddress);
  if (!status.walletId || !status.hasAppSigner) {
    throw new Error('wallet_missing_server_signer');
  }

  const res = await getPrivyServerClient()
    .wallets()
    .solana()
    .signTransaction(status.walletId, {
      transaction: input.swapTransactionBase64,
      authorization_context: auth,
    });

  return {
    signedTransactionBase64: res.signed_transaction,
    walletId: status.walletId,
  };
}
