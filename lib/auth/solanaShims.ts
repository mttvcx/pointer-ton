'use client';

/**
 * Privy Solana wallet hooks + TON private-key import helper.
 * Re-exports Privy for embedded Solana wallets; `useImportWallet` remains TON-specific
 * (see ImportWalletModal — Solana import uses Privy directly when wired).
 */
export {
  useCreateWallet,
  useExportWallet,
  useSignTransaction,
} from '@privy-io/react-auth/solana';

export type PrivyLikeSignTxInput = {
  transaction: Uint8Array;
  wallet?: unknown;
  chain?: string;
  options?: {
    showWalletUIs?: boolean;
    uiOptions?: { showWalletUIs?: boolean };
  };
};

import type { AppChainId } from '@/lib/chains/appChain';

export function useImportWallet(): {
  importWallet: (opts: { privateKey: string; chain: AppChainId }) => Promise<{ address: string }>;
} {
  return {
    importWallet: async (opts: {
      privateKey: string;
      chain: AppChainId;
    }): Promise<{ address: string }> => {
      // Imported wallets are view-only, so we only derive the public address —
      // the key stays in the browser and is never sent to Privy or the server.
      if (opts.chain === 'sol') {
        const { deriveSolanaAddressFromSecret } = await import('@/lib/auth/importKeyDerive');
        return { address: deriveSolanaAddressFromSecret(opts.privateKey) };
      }
      if (opts.chain === 'ton') {
        const { importTonPrivateKeyToAddress } = await import('@/lib/ton/tonPrivateKeyImport');
        return { address: await importTonPrivateKeyToAddress(opts.privateKey) };
      }
      // EVM rails are browse-only in this phase.
      throw new Error('unsupported_chain_import');
    },
  };
}
