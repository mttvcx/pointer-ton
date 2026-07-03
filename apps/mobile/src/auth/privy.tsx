import React, { useEffect, useRef } from 'react';
import {
  PrivyProvider,
  usePrivy,
  useLoginWithEmail,
  useLoginWithOAuth,
  useLinkWithOAuth,
  useEmbeddedSolanaWallet,
  useEmbeddedEthereumWallet,
  getAccessToken,
} from '@privy-io/expo';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { AuthContext, registerTokenGetter, type AuthState } from './index';
import { syncPointerAccount } from './sync';
import { PRIVY_APP_ID, PRIVY_CLIENT_ID } from '../env';

/** REAL auth — Privy embedded wallet. Loaded only when not in demo mode. */
export function PrivyAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID}
      config={{
        embedded: {
          // One account, both chains: a Solana wallet for SOL tokens and an EVM
          // wallet for ETH / Base / BNB — both minted automatically at signup.
          solana: { createOnLogin: 'users-without-wallets' },
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
      }}
    >
      <Bridge>{children}</Bridge>
    </PrivyProvider>
  );
}

/** Pull the connected X/Twitter @handle out of a Privy user's linked accounts. */
function twitterOf(u: unknown): string | null {
  const asObj = u as { linked_accounts?: Array<{ type?: string; username?: string }>; user?: { linked_accounts?: Array<{ type?: string; username?: string }> } } | null | undefined;
  const accts = asObj?.linked_accounts ?? asObj?.user?.linked_accounts;
  const tw = accts?.find((a) => a?.type === 'twitter_oauth');
  return tw?.username ?? null;
}

function Bridge({ children }: { children: React.ReactNode }) {
  const { user, isReady, logout } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { login: loginOAuth } = useLoginWithOAuth();
  const linkedHandle = useRef<string | null>(null);
  const { link: linkOAuth } = useLinkWithOAuth({ onSuccess: (u: unknown) => { linkedHandle.current = twitterOf(u); } });
  const solana = useEmbeddedSolanaWallet();
  const wallet = solana?.wallets?.[0] ?? null;
  const ethereum = useEmbeddedEthereumWallet();
  const evmWallet = ethereum?.wallets?.[0] ?? null;

  registerTokenGetter(() => getAccessToken());

  // Once Privy has a user, bind it to the Pointer account (same privy_id as web →
  // same account) and import the embedded wallets. Re-runs if the wallet address
  // arrives after login; keyed so it only fires once per (user, wallet).
  const uid = user?.id ?? null;
  const solAddr = wallet?.address ?? null;
  const syncedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!isReady || !uid) {
      syncedKey.current = null;
      return;
    }
    const key = `${uid}:${solAddr ?? ''}`;
    if (syncedKey.current === key) return;
    syncedKey.current = key;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          syncedKey.current = null;
          return;
        }
        await syncPointerAccount(token, { walletAddress: solAddr });
      } catch {
        syncedKey.current = null; // let it retry on the next render / login
      }
    })();
  }, [isReady, uid, solAddr]);

  const value: AuthState = {
    ready: isReady,
    isLoggedIn: Boolean(user),
    walletAddress: wallet?.address ?? null,
    evmAddress: evmWallet?.address ?? null,
    demo: false,
    getToken: () => getAccessToken(),
    sendCode: async (email) => {
      await sendCode({ email });
    },
    verifyCode: async (email, code) => {
      await loginWithCode({ code, email });
    },
    loginWithOAuth: async (provider) => {
      await loginOAuth({ provider });
    },
    twitterHandle: twitterOf(user),
    linkTwitter: async () => {
      linkedHandle.current = null;
      await linkOAuth({ provider: 'twitter' });
      return linkedHandle.current ?? twitterOf(user);
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
