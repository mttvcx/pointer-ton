'use client';

import { useState } from 'react';
import { useImportWallet } from '@/lib/auth/solanaShims';
import { Eye, EyeOff, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { useUIStore } from '@/store/ui';
import type { AppChainId } from '@/lib/chains/appChain';
import { cn } from '@/lib/utils/cn';

/** Per-chain import copy. EVM rails are browse-only this phase (no key import). */
const CHAIN_IMPORT: Record<AppChainId, { name: string; field: string; hint: string }> = {
  sol: {
    name: 'Solana',
    field: 'Solana private key',
    hint: 'Use a base58 secret (Phantom export), a 64/128-character hex key, or a JSON array.',
  },
  ton: {
    name: 'TON',
    field: 'TON mnemonic or hex key',
    hint: 'Use a 12–24 word TON recovery phrase, a 64-character hex seed, or a 128-character hex secret key.',
  },
  eth: { name: 'Ethereum', field: '', hint: '' },
  bnb: { name: 'BNB', field: '', hint: '' },
  base: { name: 'Base', field: '', hint: '' },
};

export function ImportWalletModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after Privy links the key; persist Pointer row with `is_imported: true`. */
  onImported: (address: string) => Promise<void>;
}) {
  const { importWallet } = useImportWallet();
  const activeChain = useUIStore((s) => s.activeChain);
  const cfg = CHAIN_IMPORT[activeChain];
  const isEvm = activeChain === 'eth' || activeChain === 'bnb' || activeChain === 'base';
  const [keyText, setKeyText] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const { mounted, visible } = useOverlayPresence(open);

  async function submit() {
    const trimmed = keyText.trim();
    if (isEvm) {
      toast.error(`${cfg.name} import not supported`, {
        description: 'EVM rails are browse-only this phase — switch the chain to Solana or TON to import a key.',
      });
      return;
    }
    setBusy(true);
    try {
      const w = await importWallet({ privateKey: trimmed, chain: activeChain });
      await onImported(w.address);
      toast.success(`${cfg.name} wallet imported`, {
        description: 'Added as view-only. Trading from imported keys ships in Phase 5.',
      });
      setKeyText('');
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      const isFormat =
        msg.includes('unsupported_key_format') ||
        msg.includes('invalid_mnemonic') ||
        msg.includes('empty_key');
      toast.error(isFormat ? `Invalid ${cfg.name} key` : 'Import failed', {
        description: isFormat ? cfg.hint : (e instanceof Error ? e.message : 'Unknown error').slice(0, 200),
      });
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-black/70',
          overlayBackdropClasses(visible),
          'fill-mode-forwards',
        )}
        aria-label="Close import wallet"
        onClick={() => !busy && onClose()}
      />
      <div
        className={cn(
          'relative w-full max-w-[312px] rounded border border-[#2a2f3a] bg-[#17191f] shadow-2xl fill-mode-forwards',
          overlayPanelClasses(visible),
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-wallet-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <h2 id="import-wallet-title" className="flex-1 text-center text-[16px] font-semibold text-[#d1d5db]">
            Import Wallet
          </h2>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="focus-ring rounded p-0.5 text-[#9ca3af] hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 pb-4">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-[12px] font-medium text-[#8b93a3]">
              {isEvm ? `${cfg.name} — browse-only (no import)` : cfg.field}
            </label>
            <button
              type="button"
              className="rounded bg-[#24306a] p-1 text-[#6378ff] hover:bg-[#2d3a83]"
              aria-label="Add private key"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mb-4 flex items-center rounded-full border border-[#2a2f3a] bg-[#151821] px-3">
            <input
              value={keyText}
              onChange={(e) => setKeyText(e.target.value)}
              placeholder={isEvm ? 'Switch to Solana or TON to import' : 'Private key (never share this)'}
              type={showKey ? 'text' : 'password'}
              disabled={busy || isEvm}
              className="focus-ring min-w-0 flex-1 border-0 bg-transparent py-2 text-[12px] text-[#d1d5db] outline-none placeholder:text-[#6b7280]"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="rounded p-1 text-[#6b7280] hover:text-[#d1d5db]"
              aria-label={showKey ? 'Hide private key' : 'Show private key'}
            >
              {showKey ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          <button
            type="button"
            disabled={busy || isEvm || !keyText.trim()}
            onClick={() => void submit()}
            className="btn-press focus-ring flex w-full items-center justify-center gap-1.5 rounded-full bg-[#5865F2] px-3 py-2 text-[13px] font-semibold text-[#05070d] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {busy ? 'Importing...' : 'Import Wallet'}
          </button>
        </div>
        <div className="border-t border-[#2a2f3a] px-5 py-4 text-center text-[12px] leading-snug text-[#8b93a3]">
          <span className="text-[#f472b6]">△</span> WARNING: Never share your private keys with anyone.
          Keep them secure and private.
        </div>
      </div>
    </div>
  );
}
