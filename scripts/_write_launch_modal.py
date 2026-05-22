from pathlib import Path
import re

CONTENT = Path(__file__).read_text(encoding="utf-8").split("CONTENT_START\n", 1)[1].split("\nCONTENT_END", 1)[0]

Path(r"C:\Users\moust\Downloads\pointer-ton\components\launch\LaunchModal.tsx").write_text(
    CONTENT, encoding="utf-8"
)
print("ok", len(CONTENT))

# CONTENT_START
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

  if (!mounted || !draft) return null;

  const inputCls =
    'w-full rounded-md border border-border-subtle bg-bg-sunken px-2.5 py-2 text-[12px] text-fg-primary outline-none focus:border-accent-primary/40';

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
          'relative z-10 mx-3 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-raised shadow-2xl',
          overlayPanelClasses(visible),
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border-subtle px-4 py-3">
          <div className="min-w-0">
            <motionlessRow className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                <Rocket className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 id="launch-modal-title" className="text-sm font-semibold text-fg-primary">
                  Launch token
                </h2>
                <p className="text-[10px] text-fg-muted">AI pre-fill · deploy coming soon</p>
              </div>
            </motionlessRow>
            <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-fg-muted">
              @{draft.authorHandle.replace(/^@/, '')} · {draft.tweetText.slice(0, 120)}
              {draft.tweetText.length > 120 ? '…' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="btn-press flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-fg-muted">Name</label>
              <input
                className={inputCls}
                value={draft.name}
                maxLength={32}
                onChange={(e) => patchDraft({ name: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-fg-muted">Ticker</label>
              <input
                className={cn(inputCls, 'uppercase')}
                value={draft.symbol}
                maxLength={10}
                onChange={(e) =>
                  patchDraft({ symbol: e.target.value.replace(/^\$/, '').toUpperCase() })
                }
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium text-fg-muted">Description</label>
            <textarea
              className={cn(inputCls, 'min-h-[72px] resize-y')}
              value={draft.description}
              maxLength={500}
              onChange={(e) => patchDraft({ description: e.target.value })}
            />
          </motionlessDesc>

          <div>
            <label className="mb-1 block text-[10px] font-medium text-fg-muted">Launchpad</label>
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
                      'flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold transition',
                      active
                        ? 'border-violet-400/40 bg-violet-500/15 text-violet-100'
                        : 'border-border-subtle text-fg-muted hover:bg-bg-hover',
                    )}
                  >
                    <ProtocolBrandIcon brand={brand} size={14} />
                    {brand.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium text-fg-muted">Image</label>
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
                className="mt-2 h-16 w-16 rounded-lg border border-border-subtle object-cover"
                referrerPolicy="no-referrer"
              />
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium text-fg-muted">Dev buy (SOL)</label>
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
          </div>

          {draft.reasoning ? (
            <p className="rounded-lg border border-violet-500/20 bg-violet-500/8 px-2.5 py-2 text-[10px] leading-snug text-fg-secondary">
              <span className="font-semibold text-violet-200/90">
                AI {Math.round(draft.confidence * 100)}% ·{' '}
              </span>
              {draft.reasoning}
            </p>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-border-subtle px-4 py-3">
          <button
            type="button"
            disabled
            title="On-chain deploy is not wired yet"
            className="w-full rounded-lg border border-violet-400/30 bg-violet-500/15 py-2.5 text-[12px] font-semibold text-violet-100 opacity-60"
          >
            Deploy (coming soon)
          </button>
          <p className="mt-2 text-center text-[9px] text-fg-muted">
            Saves your intent locally · default buy {defaultBuySol} SOL in settings
          </p>
        </footer>
      </div>
    </div>
  );
}
CONTENT_END
