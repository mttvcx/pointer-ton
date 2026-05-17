'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import type { ExplainTokenOutput, ExplainWalletOutput } from '@/lib/ai/schemas';
import { selectActiveEntity, selectCopilotSurfaceOpen, useUIStore } from '@/store/ui';
import { shortenAddress } from '@/lib/utils/addresses';
import { useCopilotMode } from './CopilotModeContext';
import { cn } from '@/lib/utils/cn';

type CommonResult = {
  cacheHit: boolean;
  modelUsed: string;
  costUsd: number;
};
type TokenResult = CommonResult & { data: ExplainTokenOutput };
type WalletResult = CommonResult & { data: ExplainWalletOutput };

const DEBOUNCE_MS = 350;

function useDebouncedEntity(entity: ReturnType<typeof selectActiveEntity>) {
  const [value, setValue] = useState(entity);
  useEffect(() => {
    const delay = entity ? DEBOUNCE_MS : 0;
    const handle = window.setTimeout(() => setValue(entity), delay);
    return () => window.clearTimeout(handle);
  }, [entity?.type, entity?.id, entity?.label, entity]);
  return value;
}

const IDLE_COPY =
  'Hover a token row — holder, curve, and flow notes show here.';

/**
 * Level 2 — answer canvas; shares hover + explain-token cache keys with the side `ContextCard`.
 */
export function CopilotStripBody() {
  const { mode } = useCopilotMode();
  const entity = useUIStore(selectActiveEntity);
  const debounced = useDebouncedEntity(entity);
  const surfaceOpen = useUIStore(selectCopilotSurfaceOpen);
  const { authenticated, getAccessToken } = usePointerAuth();

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
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const url =
        debounced.type === 'token' ? '/api/ai/explain-token' : '/api/ai/explain-wallet';
      const body =
        debounced.type === 'token'
          ? { mint: debounced.id, mode: 'fast' as const }
          : { address: debounced.id, mode: 'fast' as const };
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
    body = <span className="text-fg-muted">{IDLE_COPY}</span>;
  } else if (query.isLoading) {
    const hint =
      debounced.label ??
      (debounced.type === 'token'
        ? shortenAddress(debounced.id, 4)
        : shortenAddress(debounced.id, 3));
    body = (
      <span className="flex items-center gap-2 text-fg-muted">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-80" aria-hidden />
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
    body = <span className="text-fg-muted">{IDLE_COPY}</span>;
  }

  return (
    <div className="flex justify-center px-3 pb-0 pt-0">
      <div
        className={cn(
          'w-full max-w-[400px] rounded-xl border border-white/[0.09]',
          'bg-bg-raised/50 px-2.5 py-1 backdrop-blur-md',
          'shadow-[0_14px_42px_-18px_rgba(0,0,0,0.72),0_0_0_1px_rgba(255,255,255,0.05)_inset,0_1px_0_0_rgba(255,255,255,0.09)_inset]',
          'transition-[border-color,box-shadow] duration-150 ease-out',
        )}
      >
        {/*
          Fixed viewport height: answers scroll inside so the shell + Pulse grid never reflow
          when summaries or API errors grow tall.
        */}
        <div
          className={cn(
            'h-[4.25rem] overflow-y-auto overflow-x-hidden rounded-lg px-2 py-1 text-left text-[11px] leading-snug',
            'bg-bg-base/30 shadow-[inset_0_2px_8px_rgba(0,0,0,0.28)]',
            'ring-1 ring-white/[0.05]',
            '[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]',
          )}
          role="status"
          aria-live="polite"
        >
          <div
            key={contentKey}
            className={cn(
              'break-words whitespace-pre-wrap',
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
