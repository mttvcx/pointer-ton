'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { PackTestCelebration } from '@/lib/packs/celebrations';
import type { PackPublicConfig } from '@/types/pack';
import { PackCard } from '@/components/packs/PackCard';
import { PackDetailsModal } from '@/components/packs/PackDetailsModal';
import { PackOpenFlow } from '@/components/packs/PackOpenFlow';
import { listPublicPackConfigsSync } from '@/lib/packs/packConfig';
import { cn } from '@/lib/utils/cn';

type OpenTarget = {
  pack: PackPublicConfig;
  testCelebration?: PackTestCelebration;
};

type PacksApiResponse = {
  packs: PackPublicConfig[];
  solUsd: number;
  solUsdSource: 'live' | 'fallback';
};

export function PacksTerminal({ className }: { className?: string }) {
  const fallbackPacks = listPublicPackConfigsSync();
  const packsQuery = useQuery({
    queryKey: ['packs', 'catalog'],
    queryFn: async (): Promise<PacksApiResponse> => {
      const res = await fetch('/api/packs');
      if (!res.ok) throw new Error('packs_fetch_failed');
      return res.json() as Promise<PacksApiResponse>;
    },
    staleTime: 60_000,
    placeholderData: {
      packs: fallbackPacks,
      solUsd: fallbackPacks[0]?.solUsd ?? 72,
      solUsdSource: 'fallback',
    },
  });

  const packs = packsQuery.data?.packs ?? fallbackPacks;
  const [openTarget, setOpenTarget] = useState<OpenTarget | null>(null);
  const [detailsPack, setDetailsPack] = useState<PackPublicConfig | null>(null);
  const isDev = process.env.NODE_ENV === 'development';

  const legendaryPack = packs.find((p) => p.type === 'legendary') ?? null;
  const goldPack = packs.find((p) => p.type === 'gold') ?? null;

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col bg-bg-base', className)}>
      <header className="relative overflow-hidden border-b border-border-subtle px-4 py-5 sm:px-6">
        <div className="pack-header-beam pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent-glow">Pointer packs</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">Rip. Reveal. Run it up.</h1>
          </div>
          {isDev ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {legendaryPack ? (
                <button
                  type="button"
                  onClick={() => setOpenTarget({ pack: legendaryPack, testCelebration: 'jackpot' })}
                  className="btn-press focus-ring rounded-sm border border-amber-400/35 bg-amber-950/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-200 hover:bg-amber-900/50"
                >
                  Test 0.01% jackpot
                </button>
              ) : null}
              {goldPack ? (
                <>
                  <button
                    type="button"
                    onClick={() => setOpenTarget({ pack: goldPack, testCelebration: 'legendary_elite' })}
                    className="btn-press focus-ring rounded-sm border border-violet-400/35 bg-violet-950/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-200 hover:bg-violet-900/50"
                  >
                    Test vault open
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenTarget({ pack: goldPack, testCelebration: 'epic_surge' })}
                    className="btn-press focus-ring rounded-sm border border-emerald-400/35 bg-emerald-950/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-200 hover:bg-emerald-900/50"
                  >
                    Test epic surge
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {packs.map((pack) => (
            <PackCard
              key={pack.type}
              config={pack}
              onSelect={() => setOpenTarget({ pack })}
              onDetails={() => setDetailsPack(pack)}
            />
          ))}
        </div>
      </div>

      {openTarget ? (
        <PackOpenFlow
          config={openTarget.pack}
          testCelebration={openTarget.testCelebration}
          onClose={() => setOpenTarget(null)}
        />
      ) : null}

      {detailsPack ? <PackDetailsModal config={detailsPack} onClose={() => setDetailsPack(null)} /> : null}
    </div>
  );
}
