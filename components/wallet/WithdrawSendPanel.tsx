'use client';

import { useState } from 'react';
import bs58 from 'bs58';
import Link from 'next/link';
import { useSignAndSendTransaction, useWallets } from '@privy-io/react-auth/solana';
import { toast } from 'sonner';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import type { AppChainId } from '@/lib/chains/appChain';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { dispatchSolanaAccountRefresh } from '@/lib/client/portfolioRefreshEvents';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/formatters';

function filterDecimalTyped(raw: string, maxFractionDigits: number): string {
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join('').slice(0, maxFractionDigits)}`;
}

function txBytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

type Props = {
  activeChain: AppChainId;
  walletAddress: string | null;
  nativeBalance: number | null;
  onClose: () => void;
};

export function WithdrawSendPanel({ activeChain, walletAddress, nativeBalance, onClose }: Props) {
  const nativeSym = nativeTicker(activeChain);
  const { getAccessToken } = usePointerAuth();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { wallets } = useWallets();
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [sending, setSending] = useState(false);

  const available = nativeBalance ?? 0;

  function setMax() {
    const reserve = activeChain === 'sol' ? 0.001 : 0;
    const max = Math.max(0, available - reserve);
    setAmount(max > 0 ? String(max) : '0');
  }

  async function handleSend() {
    if (!walletAddress) {
      toast.error('No active wallet');
      return;
    }
    if (activeChain !== 'sol') {
      toast.message('Withdraw', {
        description: `${nativeSym} sends from the header wallet are not wired yet. Use Wallets to manage funds on this chain.`,
      });
      return;
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amountNum > available) {
      toast.error('Amount exceeds balance');
      return;
    }
    const to = recipient.trim();
    if (!to) {
      toast.error('Enter a recipient address');
      return;
    }

    const wallet = wallets.find((w) => w.address === walletAddress);
    if (!wallet) {
      toast.error('Signing wallet not found');
      return;
    }

    const lamports = Math.floor(amountNum * 1e9);
    setSending(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sign in required');

      const res = await fetch('/api/wallets/send-native', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ from: walletAddress, to, lamports }),
      });
      const data = (await res.json()) as { transaction?: string; message?: string };
      if (!res.ok || !data.transaction) {
        throw new Error(data.message ?? `Send failed (${res.status})`);
      }

      const { signature } = await signAndSendTransaction({
        transaction: txBytesFromBase64(data.transaction),
        wallet,
        chain: 'solana:mainnet',
      });

      toast.success('Withdraw sent', {
        description: `${bs58.encode(signature).slice(0, 16)}…`,
      });
      dispatchSolanaAccountRefresh('withdraw_send');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  if (!walletAddress) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="max-w-xs text-[12px] leading-relaxed text-[#9ca3af]">
          You don&apos;t have an active{' '}
          <span className="font-semibold text-white">{nativeSym}</span> wallet for this chain yet.
        </p>
        <Link
          href="/wallets"
          onClick={onClose}
          className="btn-press inline-flex rounded-full bg-[#5865F2] px-4 py-2 text-[12px] font-semibold text-[#0a0a0f] transition hover:brightness-105"
        >
          Open Wallets
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center gap-2 rounded-lg border border-[#1b1f2a] bg-[#12141b] px-2.5 py-2">
        <img
          src={CHAIN_ICON_PNG[activeChain]}
          alt=""
          className="h-5 w-5 shrink-0 object-contain"
          draggable={false}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
            Available
          </div>
          <div className="tabular-nums text-[13px] font-semibold text-white">
            {formatNumber(available, { decimals: available > 0 && available < 0.01 ? 6 : 4 })}{' '}
            {nativeSym}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
          Amount
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(filterDecimalTyped(e.target.value, 9))}
            placeholder="0.00"
            className="h-9 min-w-0 flex-1 rounded-lg border border-[#1b1f2a] bg-[#12141b] px-2.5 text-[13px] tabular-nums text-white outline-none focus:border-[#5865F2]/60"
          />
          <button
            type="button"
            onClick={setMax}
            className="h-9 shrink-0 rounded-lg border border-[#1b1f2a] bg-[#12141b] px-2.5 text-[11px] font-semibold text-[#9ca3af] transition hover:border-[#2d3548] hover:text-white"
          >
            Max
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
          Recipient address
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder={`${nativeSym} address`}
          className="h-9 w-full rounded-lg border border-[#1b1f2a] bg-[#12141b] px-2.5 text-[12px] text-white outline-none focus:border-[#5865F2]/60"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {activeChain !== 'sol' ? (
        <p className="text-[11px] leading-snug text-[#6b7280]">
          On-chain send for {nativeSym} is coming soon. Switch to Solana or use{' '}
          <Link href="/wallets" className="font-semibold text-[#5865F2] hover:underline" onClick={onClose}>
            Wallets
          </Link>{' '}
          to move funds.
        </p>
      ) : (
        <p className="text-[11px] leading-snug text-[#6b7280]">
          Sends native {nativeSym} from your active Pointer wallet. A small network fee is reserved on Max.
        </p>
      )}

      <button
        type="button"
        disabled={sending || activeChain !== 'sol'}
        onClick={() => void handleSend()}
        className={cn(
          'btn-press focus-ring w-full rounded-full py-2.5 text-[13px] font-semibold transition',
          activeChain === 'sol'
            ? 'bg-[#5865F2] text-[#0a0a0f] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50'
            : 'cursor-not-allowed bg-[#2d3343] text-[#6b7280]',
        )}
      >
        {sending ? 'Sending…' : `Send ${nativeSym}`}
      </button>
    </div>
  );
}
