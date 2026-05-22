'use client';

import type { FeatureUpdatePreview } from '@/lib/featureUpdates/releases';
import { cn } from '@/lib/utils/cn';

/** Lightweight UI mock for changelog hero art when no screenshot asset exists. */
export function FeatureUpdatePreviewMock({
  preview,
  className,
}: {
  preview: FeatureUpdatePreview;
  className?: string;
}) {
  if (preview.kind === 'wallets') {
    return (
      <div
        className={cn(
          'flex h-full min-h-[200px] flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#0c0c0e] p-3',
          className,
        )}
      >
        <div className="mb-2 flex gap-2 text-[10px] font-medium text-white/50">
          <span className="rounded-md bg-white/[0.08] px-2 py-0.5 text-white/80">Wallets</span>
          <span className="px-1 py-0.5">Groups</span>
          <span className="px-1 py-0.5">Activity</span>
        </div>
        <div className="space-y-1.5">
          {['w1', 'w2', 'w3'].map((id, i) => (
            <div
              key={id}
              className="flex items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-2"
            >
              <span className="font-mono text-[11px] text-white/70">{id}</span>
              <span className="text-[11px] tabular-nums text-emerald-400/90">
                {i === 0 ? '12.4 SOL' : i === 1 ? '3.1 SOL' : '0.8 SOL'}
              </span>
              <span className="h-4 w-8 rounded-full bg-accent-primary/80" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (preview.kind === 'pulse-translate') {
    return (
      <div
        className={cn(
          'flex h-full min-h-[200px] flex-col justify-center gap-3 rounded-lg border border-white/[0.08] bg-[#0c0c0e] p-4',
          className,
        )}
      >
        <div>
          <p className="text-[15px] font-semibold text-white">パンチ Punch</p>
          <p className="text-[12px] font-normal" style={{ color: '#F2C366' }}>
            Punch meme token
          </p>
        </div>
        <p className="text-[11px] text-white/45">Auto Translate · hover or always-on gloss</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-[200px] flex-col gap-2 rounded-lg border border-white/[0.08] bg-[#111113] p-3',
        className,
      )}
    >
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-bg-hover/40 px-2 py-1.5"
        >
          <span className="h-8 w-8 shrink-0 rounded-md bg-white/[0.06]" />
          <div className="min-w-0 flex-1">
            <div className="h-2 w-16 rounded bg-white/20" />
            <div className="mt-1 h-1.5 w-24 rounded bg-white/10" />
          </div>
          <span className="h-6 w-14 shrink-0 rounded bg-emerald-500/20" />
        </div>
      ))}
    </div>
  );
}
