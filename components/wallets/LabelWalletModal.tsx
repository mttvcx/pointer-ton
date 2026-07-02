'use client';

import { useEffect, useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';
import { shortenAddress } from '@/lib/utils/addresses';
import { useWalletLabelsStore } from '@/store/walletLabels';
import { CloseButton } from '@/components/ui/CloseButton';

const EMOJI_OPTIONS = [
  '\u{1f40b}',
  '\u{1f3af}',
  '\u{1f48e}',
  '\u{1f525}',
  '\u{1f47b}',
  '\u{1f9e0}',
  '\u{1f438}',
  '\u{1f680}',
  '\u{26a1}',
  '\u{1f440}',
  '\u{1f98d}',
  '\u{1f4cc}',
  '\u{1f4b0}',
  '\u{1f3b0}',
  '\u{1f3c6}',
  '\u{1f319}',
  '\u{1f9ea}',
  '\u{1f4c8}',
  '\u{1f6e1}\u{fe0f}',
  '\u2b50',
] as const;

const COLOR_OPTIONS = [
  { id: 'yellow', label: 'Yellow', cls: 'bg-yellow-400/90' },
  { id: 'green', label: 'Green', cls: 'bg-emerald-400/90' },
  { id: 'red', label: 'Red', cls: 'bg-red-400/90' },
  { id: 'blue', label: 'Blue', cls: 'bg-sky-400/90' },
  { id: 'purple', label: 'Purple', cls: 'bg-violet-400/90' },
] as const;

export function LabelWalletModal() {
  const pending = useWalletLabelsStore((s) => s.pendingModalAddress);
  const setPending = useWalletLabelsStore((s) => s.setPendingModalAddress);
  const [addressSnapshot, setAddressSnapshot] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- retain address for overlay exit animation */
  useEffect(() => {
    if (pending) setAddressSnapshot(pending);
  }, [pending]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const effectiveAddress = pending ?? addressSnapshot;
  const { mounted, visible } = useOverlayPresence(Boolean(pending));

  function close() {
    setPending(null);
  }

  if (!mounted || !effectiveAddress) return null;

  return (
    <div className={cn('fixed inset-0 flex items-center justify-center p-4', Z_APP_MODAL_OVERLAY)}>
      <button
        type="button"
        aria-label="Close"
        className={cn(
          'absolute inset-0 cursor-default bg-black/60',
          overlayBackdropClasses(visible),
          'fill-mode-forwards',
        )}
        onClick={close}
      />
      <LabelWalletForm key={effectiveAddress} address={effectiveAddress} visible={visible} onClose={close} />
    </div>
  );
}

function LabelWalletForm({
  address,
  visible,
  onClose,
}: {
  address: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { getAccessToken } = usePointerAuth();
  const existing = useWalletLabelsStore((s) => s.byAddress[address]);
  const upsertLocal = useWalletLabelsStore((s) => s.upsertLocal);
  const removeLocal = useWalletLabelsStore((s) => s.removeLocal);

  const [label, setLabel] = useState(existing?.label ?? '');
  const [emoji, setEmoji] = useState<string | null>(existing?.emoji ?? null);
  const [color, setColor] = useState<string>(existing?.color ?? 'yellow');
  const [busy, setBusy] = useState(false);

  async function onSave() {
    const t = label.trim();
    if (!t) {
      toast.error('Label required');
      return;
    }
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/wallet-labels', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: address,
          label: t,
          emoji: emoji ?? null,
          color: COLOR_OPTIONS.some((c) => c.id === color) ? color : 'yellow',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'save_failed');
      }
      const row = json.label as {
        walletAddress: string;
        label: string;
        emoji: string | null;
        color: string;
      };
      upsertLocal(row);
      toast.success('Wallet label saved');
      onClose();
    } catch (e) {
      console.error('[LabelWalletModal] save label', e);
      toast.error('Couldn’t save label — please try again');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(`/api/wallet-labels/${encodeURIComponent(address)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('remove_failed');
      removeLocal(address);
      toast.message('Label removed');
      onClose();
    } catch {
      toast.error('Could not remove label');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      data-modal-panel
      className={cn(
        'relative z-10 w-full max-w-md rounded-xl border border-border-subtle bg-bg-base p-4 shadow-2xl fill-mode-forwards',
        overlayPanelClasses(visible),
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="label-wallet-title"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="label-wallet-title" className="text-sm font-semibold text-fg-primary">
            Label wallet
          </h2>
          <p className="mt-0.5 tabular-nums text-[11px] text-fg-muted">{shortenAddress(address, 6)}</p>
        </div>
        <CloseButton onClick={onClose} label="Close" size="sm" />
      </div>

      <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
        Name
      </label>
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. test dev 1"
        maxLength={64}
        className="focus-ring mt-1 w-full rounded-md border border-border-subtle bg-bg-base px-2.5 py-2 text-[13px] text-fg-primary placeholder:text-fg-muted"
      />

      <span className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
        Emoji
      </span>
      <div className="mt-1.5 grid grid-cols-10 gap-1">
        {EMOJI_OPTIONS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEmoji((cur) => (cur === e ? null : e))}
            className={cn(
              'btn-press flex h-8 items-center justify-center rounded-md border text-[15px] transition',
              emoji === e
                ? 'border-accent-primary bg-accent-primary/15'
                : 'border-border-subtle hover:bg-bg-hover',
            )}
            aria-label={`Select emoji ${e}`}
          >
            {e}
          </button>
        ))}
      </div>

      <span className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
        Color
      </span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {COLOR_OPTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setColor(c.id)}
            className={cn(
              'btn-press flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
              color === c.id
                ? 'border-accent-primary text-fg-primary'
                : 'border-border-subtle text-fg-muted hover:border-border-default',
            )}
          >
            <span className={cn('h-2.5 w-2.5 rounded-full', c.cls)} aria-hidden />
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSave()}
          className="btn-press flex flex-1 items-center justify-center gap-2 rounded-md bg-accent-primary py-2 text-sm font-semibold text-fg-inverse disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save
        </button>
        {existing ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRemove()}
            className="btn-press rounded-md border border-border-subtle px-3 py-2 text-sm text-signal-bear hover:bg-bg-hover disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-fg-muted">
        Right-click any wallet in Pulse to edit. Labels appear on the feed and anywhere this wallet
        shows.
      </p>
    </div>
  );
}
