import React from 'react';
import {
  PrivyProvider,
  usePrivy,
  useLoginWithEmail,
  useEmbeddedSolanaWallet,
  getAccessToken,
} from '@privy-io/expo';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { AuthContext, registerTokenGetter, type AuthState } from './index';
import { PRIVY_APP_ID, PRIVY_CLIENT_ID } from '../env';

/** REAL auth — Privy embedded wallet. Loaded only when not in demo mode. */
export function PrivyAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID}
      config={{ embedded: { solana: { createOnLogin: 'users-without-wallets' } } }}
    >
      <Bridge>{children}</Bridge>
    </PrivyProvider>
  );
}

function Bridge({ children }: { children: React.ReactNode }) {
  const { user, isReady, logout } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const solana = useEmbeddedSolanaWallet();
  const wallet = solana?.wallets?.[0] ?? null;

  registerTokenGetter(() => getAccessToken());

  const value: AuthState = {
    ready: isReady,
    isLoggedIn: Boolean(user),
    walletAddress: wallet?.address ?? null,
    demo: false,
    getToken: () => getAccessToken(),
    sendCode: async (email) => {
      await sendCode({ email });
    },
    verifyCode: async (email, code) => {
      await loginWithCode({ code, email });
    },
    logout: () => logout(),
    signAndSend: async (txBase64, rpcUrl, token) => {
      if (!wallet) throw new Error('No embedded Solana wallet');
      const connection = new Connection(rpcUrl, {
        commitment: 'confirmed',
        httpHeaders: { Authorization: `Bearer ${token}` },
      });
      const tx = VersionedTransaction.deserialize(new Uint8Array(global.Buffer.from(txBase64, 'base64')));
      const provider = await wallet.getProvider();
      const { signature } = await provider.request({
        method: 'signAndSendTransaction',
        params: { transaction: tx, connection },
      });
      return signature;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
