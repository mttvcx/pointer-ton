'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { aiScanClientKey, fetchAiScan } from '@/lib/client/fetchAiScan';
import { ArrowUp, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { POINTER_COPILOT_QUICK_ASK_EVENT } from '@/lib/copilot/quickAsk';
import { cn } from '@/lib/utils/cn';
import type { TooltipOutput } from '@/lib/ai/schemas';
import type { EntityRef } from '@/store/ui';

const SUGGESTIONS = [
  'rug pull',
  'bonding curve',
  'LP locked',
  'top holders',
  'bundle risk',
];

interface AskResult {
  data: TooltipOutput;
  cacheHit: boolean;
  modelUsed: string;
  costUsd: number;
}

/**
 * Quick term explainer. Phase 1 wires the `tooltip` pipeline only - chat with
 * memory ships in Phase 2. Optional `entity` is forwarded as `context` so the
 * explanation can reference the locked token / wallet.
 */
export function AskBox({ entity }: { entity: EntityRef | null }) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const [term, setTerm] = useState('');
  const [history, setHistory] = useState<AskResult[]>([]);

  const mutation = useMutation({
    mutationFn: async (rawTerm: string) => {
      const t = rawTerm.trim();
      if (!t) throw new Error('empty');
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const context =
        entity?.label ?? (entity ? `${entity.type} ${entity.id}` : undefined);
      const url = '/api/ai/tooltip';
      const payload = { term: t, context };
      const key = aiScanClientKey(url, payload);
      return fetchAiScan(key, async () => {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const json: unknown = await res.json();
        if (!res.ok) {
          throw Object.assign(
            new Error(
              typeof json === 'object' && json && 'message' in json
                ? String((json as { message: unknown }).message)
                : `Failed (${res.status})`,
            ),
            {
              code:
                typeof json === 'object' && json && 'error' in json
                  ? String((json as { error: unknown }).error)
                  : '',
            },
          );
        }
        return json as AskResult;
      });
    },
    onSuccess: (res) => {
      setHistory((h) => [res, ...h].slice(0, 4));
    },
  });

  const submit = useCallback(
    (raw?: string) => {
      const value = (raw ?? term).trim();
      if (!value) return;
      mutation.mutate(value);
      setTerm('');
    },
    [mutation, term],
  );

  const submitRef = useRef<(raw?: string) => void>(() => {});
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  useEffect(() => {
    function onQuickAsk(e: Event) {
      const ce = e as CustomEvent<string>;
      if (typeof ce.detail !== 'string' || !ce.detail.trim()) return;
      if (!authenticated || mutation.isPending) return;
      submitRef.current(ce.detail);
    }
    window.addEventListener(POINTER_COPILOT_QUICK_ASK_EVENT, onQuickAsk as EventListener);
    return () =>
      window.removeEventListener(POINTER_COPILOT_QUICK_ASK_EVENT, onQuickAsk as EventListener);
  }, [authenticated, mutation.isPending]);

  return (
    <div className="rounded-sm border border-white/[0.08] bg-bg-raised px-3 py-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-fg-primary">
        <Sparkles className="h-3 w-3 text-fg-muted" strokeWidth={2.25} />
        Ask Pointer
      </div>

      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          disabled={!authenticated || mutation.isPending}
          placeholder="Ask about bonding curve, holders, risk, or entry…"
          aria-label="Ask Pointer"
          className={cn(
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary/40',
            'h-9 w-full rounded-sm border border-white/[0.08] bg-bg-base pr-10 pl-3 text-[12px] text-fg-primary placeholder:text-fg-muted',
            'disabled:opacity-50',
          )}
          maxLength={80}
        />
        <button
          type="submit"
          disabled={!authenticated || mutation.isPending || !term.trim()}
          aria-label="Send"
          className="btn-press absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm border border-white/[0.1] bg-white/[0.06] text-fg-primary transition hover:bg-white/[0.1] disabled:opacity-40"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.25} />
          )}
        </button>
      </form>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={!authenticated || mutation.isPending}
            onClick={() => submit(s)}
            className="btn-press rounded-sm border border-white/[0.08] bg-bg-base px-2 py-0.5 text-[10px] font-medium text-fg-muted transition hover:bg-white/[0.04] hover:text-fg-primary disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {mutation.isError ? (
        <div className="mt-2 flex flex-col gap-1.5 rounded-sm border border-signal-bear/20 bg-signal-bear/10 p-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-signal-bear" />
            <span className="text-xs font-medium text-signal-bear">AI unavailable</span>
          </div>
          <p className="text-[11px] leading-relaxed text-fg-muted">
            The AI assistant is temporarily unavailable. Token data and trading features are unaffected.
          </p>
        </div>
      ) : null}

      {history.length > 0 ? (
        <ul className="mt-2 space-y-1.5 border-t border-white/[0.08] pt-2">
          {history.map((entry, i) => (
            <li
              key={`${i}-${entry.modelUsed}`}
              className="border-b border-white/[0.06] pb-2 text-[11px] leading-snug text-fg-primary last:border-b-0 last:pb-0"
            >
              {entry.data.text}
              <div className="mt-1 flex gap-2 text-[9px] text-fg-muted">
                <span>{entry.cacheHit ? 'cached' : 'fresh'}</span>
                <span className="tabular-nums">{entry.modelUsed.split('-').slice(0, 2).join('-')}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
