'use client';

import { useCallback, useMemo } from 'react';
import bs58 from 'bs58';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { usePrivy, useWallets as useEvmWallets, type User } from '@privy-io/react-auth';
import {
  useSignAndSendTransaction,
  useSignTransaction,
  useWallets,
} from '@privy-io/react-auth/solana';
import type { TradeQuoteApiOk } from '@/lib/trading/quoteTypes';
import { submitEvmSwap } from '@/lib/evm/submitEvmSwap';

function swapTxBytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function base64FromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

/**
 * Embedded (Pointer) Solana wallet addresses from the Privy user. Embedded
 * wallets are marked walletClientType privy/privy-v2 or connectorType embedded
 * (same detection as ProvisionServerSigner). External wallets (Phantom etc.)
 * are absent here, so they keep self-broadcasting via signAndSend.
 */
function listEmbeddedSolanaAddresses(user: User | null): string[] {
  if (!user) return [];
  const out: string[] = [];
  for (const acct of user.linkedAccounts) {
    if (!('address' in acct) || typeof acct.address !== 'string') continue;
    if (!('chainType' in acct) || acct.chainType !== 'solana') continue;
    const w = acct as { address: string; walletClientType?: string; connectorType?: string };
    if (
      w.walletClientType === 'privy' ||
      w.walletClientType === 'privy-v2' ||
      w.connectorType === 'embedded'
    ) {
      out.push(w.address);
    }
  }
  return out;
}

export function usePointerTradeSubmit() {
  const [tonConnectUI] = useTonConnectUI();
  const { user } = usePrivy();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { signTransaction } = useSignTransaction();
  const { wallets } = useWallets();
  const { wallets: evmWallets } = useEvmWallets();
  const embeddedAddresses = useMemo(
    () => new Set(listEmbeddedSolanaAddresses(user)),
    [user],
  );

  const submitFromQuote = useCallback(
    async (opts: {
      quote: TradeQuoteApiOk;
      walletAddress: string;
      mint: string;
      getAccessToken: () => Promise<string | null>;
    }): Promise<{ signature: string }> => {
      const { quote, walletAddress, mint, getAccessToken } = opts;

      // EVM swap — the user's Privy EVM wallet approves (if needed), sends, and
      // confirms the swap client-side. v1 does NOT server-record the trade (EVM
      // fee/cashback/points economics are a follow-up); the swap itself is final
      // on-chain once this resolves.
      if (quote.chain === 'evm') {
        const evm = quote.evm;
        if (!evm) throw new Error('missing_evm_quote');
        const wallet =
          evmWallets.find((w) => w.address.toLowerCase() === walletAddress.toLowerCase()) ??
          evmWallets.find((w) => w.walletClientType === 'privy') ??
          evmWallets[0];
        if (!wallet) throw new Error('evm_wallet_not_found');
        const { txHash } = await submitEvmSwap(wallet, evm.appChain, evm);
        return { signature: txHash };
      }

      if (quote.chain === 'sol') {
        if (!quote.swapTransaction) {
          throw new Error('missing_sol_swap_transaction');
        }
        const wallet = wallets.find((w) => w.address === walletAddress);
        if (!wallet) {
          throw new Error('sol_wallet_not_found_for_address');
        }
        const txBytes = swapTxBytesFromBase64(quote.swapTransaction);

        const token = await getAccessToken();
        if (!token) throw new Error('no_token');

        const common = {
          chain: 'sol' as const,
          userPublicKey: walletAddress,
          mint,
          side: quote.side,
          amountInRaw: quote.summary.amountInRaw,
          amountOutRaw: quote.summary.amountOutRaw ?? '0',
          amountSolNotional: quote.summary.amountSolEstimate,
        };

        // Embedded Pointer wallets sign-only and let the server broadcast through
        // the private Helius RPC — the public client RPC rejects sends with
        // #8100002, which silently killed embedded-wallet trades. External wallets
        // self-broadcast via their own RPC (which works), so leave them on
        // signAndSend and just report the signature.
        let payload: Record<string, unknown>;
        let knownSig = '';
        if (embeddedAddresses.has(wallet.address)) {
          const { signedTransaction } = await signTransaction({
            transaction: txBytes,
            wallet,
            chain: 'solana:mainnet',
          });
          payload = { ...common, signedTransaction: base64FromBytes(signedTransaction) };
        } else {
          const { signature } = await signAndSendTransaction({
            transaction: txBytes,
            wallet,
            chain: 'solana:mainnet',
          });
          knownSig = bs58.encode(signature);
          payload = { ...common, txSignature: knownSig };
        }

        const execRes = await fetch('/api/trade/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const execJson: unknown = await execRes.json();
        if (!execRes.ok) {
          const msg =
            typeof execJson === 'object' && execJson && 'message' in execJson
              ? String((execJson as { message: unknown }).message)
              : `Execute failed (${execRes.status})`;
          throw new Error(msg);
        }
        // Embedded path: the broadcast signature comes back from the server.
        const signature =
          knownSig ||
          (typeof execJson === 'object' && execJson && 'signature' in execJson
            ? String((execJson as { signature: unknown }).signature)
            : '');
        return { signature };
      }

      if (!quote.tonConnect?.messages?.length) {
        throw new Error('missing_ton_connect_payload');
      }
      const result = await tonConnectUI.sendTransaction({
        validUntil: quote.tonConnect.validUntil,
        messages: quote.tonConnect.messages,
      });

      const token = await getAccessToken();
      if (!token) throw new Error('no_token');

      const execRes = await fetch('/api/trade/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          signedTransaction: result.boc,
          userPublicKey: walletAddress,
          mint,
          side: quote.side,
          amountInRaw: quote.summary.amountInRaw,
          amountOutRaw: quote.summary.amountOutRaw ?? '0',
          amountSolNotional: quote.summary.amountSolEstimate,
        }),
      });
      const execJson: unknown = await execRes.json();
      if (!execRes.ok) {
        const msg =
          typeof execJson === 'object' && execJson && 'message' in execJson
            ? String((execJson as { message: unknown }).message)
            : `Execute failed (${execRes.status})`;
        throw new Error(msg);
      }
      const signature =
        typeof execJson === 'object' && execJson && 'signature' in execJson
          ? String((execJson as { signature: unknown }).signature)
          : '';
      return { signature };
    },
    [tonConnectUI, signAndSendTransaction, signTransaction, wallets, evmWallets, embeddedAddresses],
  );

  return { submitFromQuote };
}
