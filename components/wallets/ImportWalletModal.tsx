'use client';

import { useState } from 'react';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import { useImportWallet } from '@/lib/auth/solanaShims';
import { Eye, EyeOff, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';

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
  const [keyText, setKeyText] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = keyText.trim();
    try {
      const raw = bs58.decode(trimmed);
      if (raw.length === 64) {
        Keypair.fromSecretKey(raw);
      } else if (raw.length === 32) {
        Keypair.fromSeed(raw);
      } else {
        throw new Error('bad_len');
      }
    } catch {
      toast.error('Invalid key', {
        description: 'Paste a Solana private key in base58 (32-byte seed or 64-byte secret).',
      });
      return;
    }

    setBusy(true);
    try {
      const w = await importWallet({ privateKey: trimmed });
      await onImported(w.address);
      toast.success('Wallet imported', {
        description: 'Added as view-only in Phase 4. Trading from imported keys ships in Phase 5.',
      });
      setKeyText('');
      onClose();
    } catch (e) {
      toast.error('Import failed', {
        description: e instanceof Error ? e.message.slice(0, 200) : 'Unknown error',
      });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex animate-in fade-in items-center justify-center bg-black/70 p-4 duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-wallet-title"
    >
      <div
        className={cn(
          'relative w-full max-w-[312px] animate-in zoom-in-95 fade-in rounded border border-[#2a2f3a] bg-[#17191f] shadow-2xl duration-200',
        )}
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
            <label className="text-[12px] font-medium text-[#8b93a3]">Enter Private Key</label>
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
              placeholder="Enter private key"
              type={showKey ? 'text' : 'password'}
              disabled={busy}
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
            disabled={busy || !keyText.trim()}
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
