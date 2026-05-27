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

export function useImportWallet(): {
  importWallet: (opts: { privateKey: string }) => Promise<{ address: string }>;
} {
  return {
    importWallet: async (opts: { privateKey: string }): Promise<{ address: string }> => {
      const { importTonPrivateKeyToAddress } = await import('@/lib/ton/tonPrivateKeyImport');
      const address = await importTonPrivateKeyToAddress(opts.privateKey);
      return { address };
    },
  };
}
