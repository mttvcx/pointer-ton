'use client';

import { useEffect } from 'react';
import { Rocket, X } from 'lucide-react';
import {
  LAUNCH_PACKAGE_LAUNCHPADS,
  type LaunchPackageLaunchpad,
} from '@/lib/launch/types';
import { protocolBrand } from '@/lib/tokens/protocolBrand';
import { ProtocolBrandIcon } from '@/components/tokens/ProtocolBrandIcon';
import { useOverlayPresence, OVERLAY_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';
import { useAutoLaunchStore } from '@/store/autoLaunch';
import { useLaunchModalStore } from '@/store/launchModal';

export function LaunchModal() {
  const open = useLaunchModalStore((s) => s.open);
  const draft = useLaunchModalStore((s) => s.draft);
  const patchDraft = useLaunchModalStore((s) => s.patchDraft);
  const close = useLaunchModalStore((s) => s.close);
  const defaultBuySol = useAutoLaunchStore((s) => s.launchBuySol);
  const { mounted, visible } = useOverlayPresence(open, OVERLAY_ANIM_CLOSE_MS);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Opened from a suggestion's N/T badge → focus + select that field for a quick edit.
  const focusField = draft?.focusField ?? null;
  useEffect(() => {
    if (!open || !focusField) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(`[data-launch-field="${focusField}"]`);
      el?.focus();
      el?.select();
    }, 60);
    return () => clearTimeout(t);
  }, [open, focusField]);

  if (!mounted || !draft) return null;

  const inputCls =
    'w-full rounded-sm border border-white/[0.08] bg-bg-sunken px-2.5 py-2 text-[12px] text-fg-primary outline-none focus:border-accent-primary/40';

  return (
    <div className={cn('fixed inset-0 flex items-center justify-center', Z_APP_MODAL_OVERLAY)}>
      <button
        type="button"
        aria-label="Close launch modal"
        className={cn(
          'absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm',
          overlayBackdropClasses(visible),
        )}
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-modal-title"
        className={cn(
          'relative z-10 mx-3 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-sm border border-border-subtle bg-bg-raised shadow-2xl',
          overlayPanelClasses(visible),
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border-subtle px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-accent-primary/12 text-accent-primary">
                <Rocket className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 id="launch-modal-title" className="text-sm font-semibold text-fg-primary">
                  Launch token
                </h2>
                <p className="text-[10px] text-fg-muted">AI pre-fill · on-chain deploy coming soon</p>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-fg-muted">
              @{draft.authorHandle.replace(/^@/, '')} · {draft.tweetText.slice(0, 120)}
              {draft.tweetText.length > 120 ? '…' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="btn-press flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-[10px] font-medium text-fg-muted">
                <span>Name</span>
                <span className="tabular-nums">{draft.name.length}/32</span>
              </span>
              <input
                data-launch-field="name"
                className={inputCls}
                value={draft.name}
                maxLength={32}
                placeholder="Token name"
                onChange={(e) => patchDraft({ name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-[10px] font-medium text-fg-muted">
                <span>Ticker</span>
                <span className="tabular-nums">{draft.symbol.length}/10</span>
              </span>
              <input
                data-launch-field="ticker"
                className={cn(inputCls, 'uppercase')}
                value={draft.symbol}
                maxLength={10}
                placeholder="TICKER"
                onChange={(e) =>
                  patchDraft({ symbol: e.target.value.replace(/^\$/, '').toUpperCase() })
                }
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-fg-muted">Description</span>
            <textarea
              className={cn(inputCls, 'min-h-[72px] resize-y')}
              value={draft.description}
              maxLength={500}
              onChange={(e) => patchDraft({ description: e.target.value })}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-fg-muted">Website (optional)</span>
              <input
                className={inputCls}
                value={draft.website ?? ''}
                placeholder="https://…"
                onChange={(e) => patchDraft({ website: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-fg-muted">X / Twitter</span>
              <input
                className={inputCls}
                value={draft.twitterUrl ?? draft.tweetUrl ?? `https://x.com/${draft.authorHandle.replace(/^@/, '')}`}
                placeholder="https://x.com/…"
                onChange={(e) => patchDraft({ twitterUrl: e.target.value })}
              />
            </label>
          </div>

          <div>
            <span className="mb-1 block text-[10px] font-medium text-fg-muted">Launchpad</span>
            <div className="flex flex-wrap gap-1.5">
              {LAUNCH_PACKAGE_LAUNCHPADS.map((id) => {
                const brand = protocolBrand(id);
                const active = draft.launchpad === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => patchDraft({ launchpad: id as LaunchPackageLaunchpad })}
                    className={cn(
                      'flex items-center gap-1 rounded-sm border px-2 py-1 text-[10px] font-semibold transition',
                      active
                        ? 'border-accent-primary/40 bg-accent-primary/12 text-accent-primary'
                        : 'border-border-subtle text-fg-muted hover:bg-bg-hover',
                    )}
                  >
                    <ProtocolBrandIcon protocolId={id} dotClassName="h-3.5 w-3.5" />
                    {brand?.label ?? id}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-fg-muted">Image</span>
            <select
              className={inputCls}
              value={draft.imageStrategy}
              onChange={(e) =>
                patchDraft({
                  imageStrategy: e.target.value as typeof draft.imageStrategy,
                })
              }
            >
              <option value="use_tweet_image">Use tweet image</option>
              <option value="generate">Generate later</option>
              <option value="no_image">No image</option>
            </select>
            {draft.imageStrategy === 'use_tweet_image' && draft.imageUrls[0] ? (
              <img
                src={draft.imageUrls[0]}
                alt=""
                className="mt-2 h-16 w-16 rounded-sm border border-border-subtle object-cover"
                referrerPolicy="no-referrer"
              />
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-fg-muted">Dev buy (SOL)</span>
            <input
              type="number"
              min={0}
              max={50}
              step={0.01}
              className={inputCls}
              value={draft.launchBuySol}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) patchDraft({ launchBuySol: n });
              }}
            />
            <div className="mt-1.5 flex gap-1.5">
              {[0.5, 1, 2, 5].map((amt) => {
                const active = draft.launchBuySol === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => patchDraft({ launchBuySol: amt })}
                    className={cn(
                      'btn-press flex-1 rounded-sm py-1 text-[11px] font-semibold tabular-nums transition-colors',
                      active
                        ? 'bg-accent-primary/25 text-accent-primary'
                        : 'bg-accent-primary/[0.08] text-fg-muted hover:bg-accent-primary/15 hover:text-accent-primary',
                    )}
                  >
                    {amt}
                  </button>
                );
              })}
            </div>
          </label>

          {draft.reasoning ? (
            <p className="rounded-sm border border-accent-primary/20 bg-accent-primary/8 px-2.5 py-2 text-[10px] leading-snug text-fg-secondary">
              <span className="font-semibold text-accent-primary">
                AI {Math.round(draft.confidence * 100)}% ·{' '}
              </span>
              {draft.reasoning}
            </p>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-border-subtle px-4 py-3">
          <button
            type="button"
            title="On-chain deploy coming soon"
            className={cn(
              'btn-press w-full rounded-sm border border-accent-primary/40 bg-accent-primary/20 py-2.5 text-[12px] font-semibold text-accent-primary',
              'transition-all duration-150 hover:-translate-y-0.5 hover:border-accent-primary/60 hover:bg-accent-primary/30',
              'hover:shadow-[0_6px_18px_-6px_rgb(var(--pulse-accent-rgb)/0.5)] active:translate-y-0',
            )}
          >
            Deploy <span className="font-normal text-fg-muted">· coming soon</span>
          </button>
          <p className="mt-2 text-center text-[9px] text-fg-muted">
            Default dev buy {defaultBuySol} SOL · toggle AI launcher in X monitor
          </p>
        </footer>
      </div>
    </div>
  );
}
