'use client';

import { useEffect, useMemo, useState } from 'react';
import bs58 from 'bs58';
import {
  useSignAndSendTransaction,
  useSignTransaction,
  useWallets,
} from '@privy-io/react-auth/solana';
import { useWallets as useEvmWallets } from '@privy-io/react-auth';
import { useCctpFund } from '@/lib/hooks/useCctpFund';
import { useQuery } from '@tanstack/react-query';
import { useEmbeddedSolanaAddresses } from '@/lib/hooks/useEmbeddedSolanaAddresses';
import { ArrowDownUp, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  CONVERT_ASSETS,
  CONVERT_FROM_ASSETS,
  convertAssetById,
  defaultConvertFromAsset,
  defaultConvertToAsset,
  isHyperliquidUsdc,
  type ConvertAssetId,
  type ConvertAssetMeta,
} from '@/lib/exchange/convertAssets';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { dispatchSolanaAccountRefresh } from '@/lib/client/portfolioRefreshEvents';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';
import { formatUsd } from '@/lib/utils/formatters';
import { TerminalNativeBalance } from '@/lib/utils/terminalBalanceFormat';
import { EX } from '@/components/wallet/exchangeModalUi';

type QuotePayload = {
  provider: 'jupiter' | 'lifi';
  fromAsset: ConvertAssetId;
  toAsset: ConvertAssetId;
  fromAmountUi: number;
  toAmountUi: number;
  toAmountMinUi: number | null;
  rateLabel: string;
  transaction: string | null;
  tool: string | null;
};

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

function base64FromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function AssetSelect({
  value,
  onChange,
  exclude,
  options = CONVERT_ASSETS,
}: {
  value: ConvertAssetId;
  onChange: (id: ConvertAssetId) => void;
  exclude?: ConvertAssetId;
  options?: ConvertAssetMeta[];
}) {
  const [open, setOpen] = useState(false);
  const asset = convertAssetById(value);
  const opts = options.filter((a) => a.id !== exclude);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-fg-primary',
          EX.control,
        )}
      >
        <img src={asset.iconSrc} alt="" className="h-4 w-4 rounded-full object-contain" draggable={false} />
        {asset.label}
        <ChevronDown
          className={cn('h-3 w-3 text-fg-muted transition-transform duration-200', open && 'rotate-180')}
          strokeWidth={2.25}
        />
      </button>
      {open ? (
        <div
          className={cn(
            'absolute right-0 top-[calc(100%+4px)] z-20 min-w-[7rem] overflow-hidden py-1 shadow-panel',
            'animate-in fade-in slide-in-from-top-1 duration-150 ease-out',
            EX.inset,
            'bg-bg-raised',
          )}
        >
          {opts.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-semibold transition',
                opt.id === value
                  ? 'bg-bg-hover text-fg-primary'
                  : 'text-fg-secondary hover:bg-bg-hover/70 hover:text-fg-primary',
              )}
            >
              <img src={opt.iconSrc} alt="" className="h-3.5 w-3.5 rounded-full object-contain" draggable={false} />
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ConvertPanel({
  walletAddress,
  nativeBalance,
  usdcBalance = 0,
  solUsd,
  onClose,
}: {
  walletAddress: string | null;
  nativeBalance: number | null;
  usdcBalance?: number | null;
  solUsd?: number | null;
  onClose?: () => void;
}) {
  const activeChain = useUIStore((s) => s.activeChain);
  const { getAccessToken } = usePointerAuth();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { signTransaction } = useSignTransaction();
  const { wallets } = useWallets();
  const { wallets: evmWallets } = useEvmWallets();
  const embeddedAddresses = useEmbeddedSolanaAddresses();
  const cctp = useCctpFund();
  const hlEvmAddress = useMemo(
    () => evmWallets.find((w) => w.walletClientType === 'privy')?.address ?? evmWallets[0]?.address ?? null,
    [evmWallets],
  );

  const [fromAsset, setFromAsset] = useState<ConvertAssetId>(() => defaultConvertFromAsset(activeChain));
  const [toAsset, setToAsset] = useState<ConvertAssetId>(() => defaultConvertToAsset(defaultConvertFromAsset(activeChain)));
  const [amountIn, setAmountIn] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const from = defaultConvertFromAsset(activeChain);
    setFromAsset(from);
    setToAsset(defaultConvertToAsset(from));
  }, [activeChain]);

  const amountUi = Number(amountIn);
  const amountValid = Number.isFinite(amountUi) && amountUi > 0;
  const toHl = isHyperliquidUsdc(toAsset);

  // Bridging to Hyperliquid is a USDC→USDC CCTP transfer — force the source to USDC.
  useEffect(() => {
    if (toHl && fromAsset !== 'USDC') setFromAsset('USDC');
  }, [toHl, fromAsset]);

  const balanceFor = (asset: ConvertAssetId): number => {
    if (asset === 'SOL') return nativeBalance ?? 0;
    if (asset === 'USDC') return usdcBalance ?? 0;
    return 0;
  };

  const fromBalance = balanceFor(fromAsset);
  const toBalance = balanceFor(toAsset);

  const quoteQ = useQuery({
    queryKey: ['convert-quote', walletAddress, fromAsset, toAsset, amountIn],
    enabled: Boolean(walletAddress && amountValid && !toHl),
    staleTime: 12_000,
    queryFn: async (): Promise<QuotePayload> => {
      const token = await getAccessToken();
      if (!token) throw new Error('Sign in required');
      const res = await fetch('/api/exchange/convert/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromAsset,
          toAsset,
          amountUi,
          fromAddress: walletAddress,
        }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          json && typeof json === 'object' && 'message' in json
            ? String((json as { message: unknown }).message)
            : json && typeof json === 'object' && 'error' in json
              ? String((json as { error: unknown }).error)
              : 'Quote failed';
        throw new Error(msg);
      }
      const q =
        json && typeof json === 'object' && 'quote' in json
          ? (json as { quote: QuotePayload }).quote
          : null;
      if (!q) throw new Error('Invalid quote response');
      return q;
    },
  });

  const quote = quoteQ.data;
  const toDisplay = useMemo(() => {
    if (toHl && amountValid) return amountUi; // 1:1 USDC bridge via CCTP
    if (quote && amountValid) return quote.toAmountUi;
    return 0;
  }, [toHl, amountUi, quote, amountValid]);

  const usdHint = useMemo(() => {
    if (!amountValid || solUsd == null || fromAsset !== 'SOL') return null;
    return formatUsd(amountUi * solUsd, { decimals: 2 });
  }, [amountUi, amountValid, fromAsset, solUsd]);

  function swapDirection() {
    const prevFrom = fromAsset;
    setFromAsset(toAsset);
    setToAsset(prevFrom);
    setAmountIn('');
  }

  async function handleConfirm() {
    if (!walletAddress) {
      toast.error('No active wallet');
      return;
    }
    if (!amountValid) {
      toast.error('Enter an amount');
      return;
    }
    if (amountUi > fromBalance && fromAsset !== 'BNB' && fromAsset !== 'ETH') {
      toast.error('Insufficient balance');
      return;
    }

    // USDC → Hyperliquid: route through Circle CCTP instead of a Jupiter/LI.FI swap.
    if (toHl) {
      if (!hlEvmAddress) {
        toast.error('No Hyperliquid (EVM) address on this account');
        return;
      }
      setConfirming(true);
      try {
        const sig = await cctp.fund(amountUi, hlEvmAddress);
        if (!sig) throw new Error(cctp.error ?? 'bridge_failed');
        toast.success('Bridging to Hyperliquid', { description: `${sig.slice(0, 12)}…` });
        dispatchSolanaAccountRefresh('convert_swap');
        onClose?.();
      } catch (e) {
        toast.error('Bridge failed', { description: e instanceof Error ? e.message : undefined });
      } finally {
        setConfirming(false);
      }
      return;
    }

    if (!quote?.transaction) {
      toast.error('No transaction ready', {
        description:
          quote?.provider === 'lifi' && !quote.transaction
            ? 'Add a Privy EVM wallet for cross-chain delivery, or try SOL ↔ USDC on Solana.'
            : 'Wait for the quote to finish loading.',
      });
      return;
    }

    const wallet = wallets.find((w) => w.address === walletAddress);
    if (!wallet) {
      toast.error('Signing wallet not found');
      return;
    }

    setConfirming(true);
    try {
      // Embedded Pointer wallet: sign-only + server broadcast via the private
      // Helius RPC (the public client RPC rejects sends with #8100002). External
      // wallets self-broadcast via signAndSend.
      let sig: string;
      if (walletAddress && embeddedAddresses.has(walletAddress)) {
        const token = await getAccessToken();
        if (!token) throw new Error('Sign in required');
        const { signedTransaction } = await signTransaction({
          transaction: txBytesFromBase64(quote.transaction),
          wallet,
          chain: 'solana:mainnet',
        });
        const bRes = await fetch('/api/solana/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ signedTransaction: base64FromBytes(signedTransaction), confirm: true }),
        });
        const bJson = (await bRes.json().catch(() => ({}))) as {
          signature?: string;
          error?: string;
          message?: string;
        };
        if (!bRes.ok || !bJson.signature) {
          throw new Error(bJson.message ?? bJson.error ?? 'broadcast_failed');
        }
        sig = bJson.signature;
      } else {
        const { signature } = await signAndSendTransaction({
          transaction: txBytesFromBase64(quote.transaction),
          wallet,
          chain: 'solana:mainnet',
        });
        sig = bs58.encode(signature);
      }
      toast.success('Convert submitted', {
        description: `${quote.rateLabel} · ${sig.slice(0, 12)}…`,
      });
      dispatchSolanaAccountRefresh('convert_swap');
      onClose?.();
    } catch (e) {
      console.error('[ConvertPanel] convert submit failed', e);
      toast.error('Convert failed — please try again');
    } finally {
      setConfirming(false);
    }
  }

  if (!walletAddress) {
    return (
      <p className="py-2 text-[12px] leading-relaxed text-[#9ca3af]">
        Connect a Solana wallet to convert. Cross-chain routes use LI.FI; Solana swaps use Jupiter.
      </p>
    );
  }

  return (
    <div className="space-y-3 py-1">
      <p className={EX.muted}>
        {toHl
          ? 'Bridge USDC to Hyperliquid via Circle CCTP'
          : `Swap ${convertAssetById(fromAsset).label} for ${convertAssetById(toAsset).label}${
              quote?.provider === 'lifi' ? ' via bridge' : ' on Solana'
            }`}
      </p>

      <div className={cn('p-3', EX.inset)}>
        <div className={cn('flex items-center justify-between', EX.label, 'normal-case tracking-normal')}>
          <span>Converting</span>
          <span className="tabular-nums">
            Balance:{' '}
            {fromAsset === 'SOL' ? (
              <TerminalNativeBalance amount={fromBalance} className="inline tabular-nums" />
            ) : (
              fromBalance
            )}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={amountIn}
            onChange={(e) =>
              setAmountIn(filterDecimalTyped(e.target.value, convertAssetById(fromAsset).decimals))
            }
            placeholder="0.0"
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold tabular-nums text-fg-primary outline-none placeholder:text-fg-muted/60"
          />
          <AssetSelect value={fromAsset} onChange={setFromAsset} exclude={toAsset} options={CONVERT_FROM_ASSETS} />
        </div>
        {usdHint ? (
          <p className={cn('mt-1 text-right text-[10px] tabular-nums', EX.muted)}>({usdHint})</p>
        ) : null}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={swapDirection}
          className={cn('p-1.5 text-fg-muted transition hover:text-fg-primary', EX.control)}
          aria-label="Swap direction"
        >
          <ArrowDownUp className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      </div>

      <div className={cn('p-3', EX.inset)}>
        <div className={cn('flex items-center justify-between', EX.label, 'normal-case tracking-normal')}>
          <span>Gaining</span>
          <span className="tabular-nums">
            Balance:{' '}
            {toAsset === 'SOL' ? (
              <TerminalNativeBalance amount={toBalance} className="inline tabular-nums" />
            ) : (
              toBalance
            )}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="min-w-0 flex-1 text-lg font-semibold tabular-nums text-fg-primary">
            {quoteQ.isFetching ? '…' : toDisplay > 0 ? toDisplay : '0.0'}
          </span>
          <AssetSelect value={toAsset} onChange={setToAsset} exclude={fromAsset} />
        </div>
      </div>

      <p className={cn('text-center text-[10px] tabular-nums', EX.muted)}>
        {quoteQ.isError
          ? quoteQ.error instanceof Error
            ? quoteQ.error.message
            : 'Quote unavailable'
          : quote?.rateLabel ?? 'Enter an amount for a live rate'}
      </p>

      <button
        type="button"
        disabled={
          confirming ||
          !amountValid ||
          (toHl ? cctp.state === 'signing' || cctp.state === 'bridging' : quoteQ.isFetching || !quote?.transaction)
        }
        onClick={() => void handleConfirm()}
        className={cn(EX.cta, 'flex items-center justify-center gap-2')}
      >
        {confirming || quoteQ.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Confirm
      </button>
    </div>
  );
}
