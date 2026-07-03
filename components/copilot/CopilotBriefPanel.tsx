'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import type { ExplainTokenOutput, ExplainWalletOutput } from '@/lib/ai/schemas';
import { selectActiveEntity, selectCopilotSurfaceOpen, useUIStore } from '@/store/ui';
import { shortenAddress } from '@/lib/utils/addresses';
import { useCopilotMode } from './CopilotModeContext';
import { aiScanClientKey, fetchAiScan } from '@/lib/client/fetchAiScan';
import { usePreferences } from '@/components/preferences/PreferencesProvider';
import { LIGHT_GLASS_SURFACE } from '@/lib/ui/glassSurface';
import { LiquidGlassLayers } from '@/components/ui/liquid-glass';
import { cn } from '@/lib/utils/cn';

type CommonResult = {
  cacheHit: boolean;
  modelUsed: string;
  costUsd: number;
};
type TokenResult = CommonResult & { data: ExplainTokenOutput };
type WalletResult = CommonResult & { data: ExplainWalletOutput };

const DEBOUNCE_MS = 150;

const IDLE_COPY = 'Hover a token row — holder, curve, and flow notes show here.';

function useDebouncedEntity(entity: ReturnType<typeof selectActiveEntity>) {
  const [value, setValue] = useState(entity);
  useEffect(() => {
    const delay = entity ? DEBOUNCE_MS : 0;
    const handle = window.setTimeout(() => setValue(entity), delay);
    return () => window.clearTimeout(handle);
  }, [entity?.type, entity?.id, entity?.label, entity]);
  return value;
}

export function CopilotBriefPanel({
  variant = 'compact',
  size = 'compact',
  className,
}: {
  variant?: 'compact' | 'workspace';
  /** `pulse` — taller card that fills the Pulse chrome band above the mode rail. */
  size?: 'compact' | 'pulse';
  className?: string;
}) {
  const { mode } = useCopilotMode();
  const entity = useUIStore(selectActiveEntity);
  const debounced = useDebouncedEntity(entity);
  const surfaceOpen = useUIStore(selectCopilotSurfaceOpen);
  const { authenticated, getAccessToken } = usePointerAuth();
  const activeChain = useUIStore((s) => s.activeChain);
  const aiPanelStyle = usePreferences().prefs.aiPanelStyle;

  const queryKey = useMemo(
    () => ['ai-explain', debounced?.type, debounced?.id, 'fast'] as const,
    [debounced?.type, debounced?.id],
  );

  const enabled = Boolean(authenticated && debounced && surfaceOpen && mode === 'embedded');

  const query = useQuery({
    queryKey,
    enabled,
    staleTime: 60_000,
    retry: 0,
    queryFn: async () => {
      if (!debounced) throw new Error('no_entity');
      const url =
        debounced.type === 'token' ? '/api/ai/explain-token' : '/api/ai/explain-wallet';
      const body =
        debounced.type === 'token'
          ? {
              mint: debounced.id,
              mode: 'fast' as const,
              surface: 'copilot' as const,
              chain: activeChain,
            }
          : { address: debounced.id, mode: 'fast' as const };
      const key = aiScanClientKey(url, body);
      return fetchAiScan(key, async () => {
        const token = await getAccessToken();
        if (!token) throw new Error('no_token');
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        const json: unknown = await res.json();
        if (!res.ok) {
          const msg =
            typeof json === 'object' && json && 'message' in json
              ? String((json as { message: unknown }).message)
              : `Failed (${res.status})`;
          throw new Error(msg);
        }
        return json as TokenResult | WalletResult;
      });
    },
  });

  const contentKey = useMemo(() => {
    if (!authenticated) return 'signin';
    if (!debounced) return 'idle';
    const idKey = `${debounced.type}:${debounced.id}`;
    if (query.isLoading) return `loading:${idKey}`;
    if (query.isError) return `error:${idKey}`;
    if (query.data?.data && 'summary' in query.data.data) return `summary:${idKey}`;
    return `pending:${idKey}`;
  }, [
    authenticated,
    debounced?.id,
    debounced?.type,
    query.data?.data,
    query.isError,
    query.isLoading,
  ]);

  if (mode !== 'embedded') return null;

  let body: ReactNode;
  if (!authenticated) {
    body = (
      <span className="text-fg-muted">
        Sign in for hover briefings — same AI as the side co-pilot.
      </span>
    );
  } else if (!debounced) {
    body = <span className="text-fg-primary">{IDLE_COPY}</span>;
  } else if (query.isLoading) {
    const hint =
      debounced.label ??
      (debounced.type === 'token'
        ? shortenAddress(debounced.id, 4)
        : shortenAddress(debounced.id, 3));
    body = (
      <span className="flex items-center gap-2 text-fg-muted">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-80" aria-hidden />
        Analyzing {hint}…
      </span>
    );
  } else if (query.isError) {
    body = (
      <span className="text-fg-muted">
        {(query.error as Error)?.message ?? 'Briefing unavailable — try the side panel.'}
      </span>
    );
  } else if (query.data?.data && 'summary' in query.data.data) {
    body = (
      <span className="text-fg-secondary [&_strong]:font-semibold [&_strong]:text-fg-primary">
        {query.data.data.summary}
      </span>
    );
  } else {
    body = <span className="text-fg-primary">{IDLE_COPY}</span>;
  }

  const isWorkspace = variant === 'workspace';
  const isPulseSize = size === 'pulse';
  const textCls = isWorkspace ? 'text-[12px] leading-snug' : 'text-[11px] leading-snug';
  const scrollH = isWorkspace
    ? 'h-full min-h-[3.25rem]'
    : isPulseSize
      ? 'min-h-0 flex-1'
      : 'h-[4.25rem]';

  if (isWorkspace) {
    return (
      <div className={cn('flex h-full min-w-0 flex-1 flex-col', className)}>
        <div
          className={cn(
            'flex min-h-0 w-full flex-1 flex-col rounded-xl border px-2.5 py-2',
            aiPanelStyle === 'light' && LIGHT_GLASS_SURFACE,
            aiPanelStyle === 'glassy' && 'relative isolate border-white/15 bg-white/[0.05]',
            aiPanelStyle === 'default' &&
              'border-white/[0.09] bg-bg-raised/50 backdrop-blur-md shadow-[0_14px_42px_-18px_rgba(0,0,0,0.72),0_0_0_1px_rgba(255,255,255,0.05)_inset,0_1px_0_0_rgba(255,255,255,0.09)_inset]',
          )}
        >
          {aiPanelStyle === 'glassy' ? (
            <LiquidGlassLayers softer borderRadius="12px" blurIntensity="md" glowIntensity="sm" shadowIntensity="sm" />
          ) : null}
          <div
            className={cn(
              scrollH,
              'relative z-10 overflow-y-auto overflow-x-hidden rounded-lg px-2.5 py-2 text-center',
              // Glassy: keep the inner transparent so the liquid-glass refraction shows through.
              aiPanelStyle === 'glassy'
                ? 'bg-white/[0.02] ring-1 ring-white/[0.06]'
                : 'bg-bg-base/30 shadow-[inset_0_2px_8px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.05]',
              textCls,
              '[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]',
            )}
            role="status"
            aria-live="polite"
          >
            <div
              key={contentKey}
              className={cn(
                'break-words whitespace-pre-wrap text-center',
                'motion-safe:animate-[fade-in_115ms_ease-out_both] motion-reduce:animate-none',
              )}
            >
              {body}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pulseCard = isPulseSize;

  return (
    <div className={cn('h-full w-full pb-0 pt-0', className)}>
      <div
        className={cn(
          'flex w-full flex-col overflow-hidden rounded-xl border',
          isPulseSize ? 'h-full max-w-[440px]' : 'max-w-[400px]',
          aiPanelStyle === 'light'
            ? cn('px-2.5 py-1.5', LIGHT_GLASS_SURFACE)
            : aiPanelStyle === 'glassy'
              ? 'relative isolate border-white/15 bg-white/[0.05] px-2.5 py-1.5'
              : pulseCard
                ? 'min-h-0 border-white/[0.08] bg-bg-raised/75 px-2 py-1.5'
                : cn(
                    'border-white/[0.08] bg-bg-raised/50 px-2.5 py-1 backdrop-blur-md',
                    'shadow-[0_14px_42px_-18px_rgba(0,0,0,0.72),0_0_0_1px_rgba(255,255,255,0.05)_inset,0_1px_0_0_rgba(255,255,255,0.09)_inset]',
                    'transition-[border-color,box-shadow] duration-150 ease-out',
                  ),
        )}
      >
        {aiPanelStyle === 'glassy' ? (
          <LiquidGlassLayers softer borderRadius="12px" blurIntensity="md" glowIntensity="xs" shadowIntensity="sm" />
        ) : null}
        <div
          className={cn(
            scrollH,
            'relative z-10 overflow-y-auto overflow-x-hidden rounded-lg px-2.5 py-2 text-center',
            aiPanelStyle === 'glassy'
              ? 'bg-white/[0.02] ring-1 ring-white/[0.06]'
              : pulseCard
                ? 'bg-bg-base/40'
                : cn(
                    'bg-bg-base/30 shadow-[inset_0_2px_8px_rgba(0,0,0,0.28)]',
                    'ring-1 ring-white/[0.05]',
                  ),
            textCls,
            '[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]',
          )}
          role="status"
          aria-live="polite"
        >
          <div
            key={contentKey}
            className={cn(
              'break-words whitespace-pre-wrap text-center',
              'motion-safe:animate-[fade-in_115ms_ease-out_both] motion-reduce:animate-none',
            )}
          >
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}
