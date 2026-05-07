'use client';

/**
 * Stubs for `@privy-io/react-auth/solana` during the TON migration (Step 1 = TonConnect auth only).
 * Swap / signing flows are rebuilt in a later step using TonConnect transactions.
 */

export type PrivyLikeSignTxInput = {
  transaction: Uint8Array;
  wallet?: unknown;
  chain?: string;
  /** Privy: `{ uiOptions: { showWalletUIs: false } }` */
  options?: {
    showWalletUIs?: boolean;
    uiOptions?: { showWalletUIs?: boolean };
  };
};

export function useSignTransaction() {
  return {
    signTransaction: async (opts: PrivyLikeSignTxInput): Promise<{ signedTransaction: Uint8Array }> => {
      void opts;
      throw new Error(
        'TON migration: Solana signing is removed; on-chain signing via TonConnect comes in a later step.',
      );
    },
  };
}

type CreateWalletResult = { wallet: { address: string; id?: string } };

export function useCreateWallet(): {
  createWallet: (opts?: { createAdditional?: boolean }) => Promise<CreateWalletResult>;
} {
  return {
    createWallet: async (): Promise<CreateWalletResult> => {
      throw new Error('TON migration: use your TonConnect wallet instead of embedded wallet creation.');
    },
  };
}

export function useExportWallet(): {
  exportWallet: (opts?: unknown) => Promise<void>;
} {
  return {
    exportWallet: async (): Promise<void> => {
      throw new Error('TON migration: export is not available for TonConnect sessions.');
    },
  };
}

export function useImportWallet(): {
  importWallet: (opts: { privateKey: string }) => Promise<{ address: string }>;
} {
  return {
    importWallet: async (opts: { privateKey: string }): Promise<{ address: string }> => {
      void opts;
      throw new Error('TON migration: import a key through a TonConnect-compatible wallet app.');
    },
  };
}
