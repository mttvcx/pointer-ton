'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { ArrowUp, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { TooltipOutput } from '@/lib/ai/schemas';
import type { EntityRef } from '@/store/ui';

const COPILOT = {
  card: '#11141b',
  border: '#202636',
  elevated: '#151924',
  muted: '#7f8aa3',
  text: '#f5f7ff',
  accent: '#0077b6',
} as const;

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

const QUICK_ASK_EVENT = 'pointer-copilot-quick-ask';

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
      const res = await fetch('/api/ai/tooltip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ term: t, context }),
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
    window.addEventListener(QUICK_ASK_EVENT, onQuickAsk as EventListener);
    return () => window.removeEventListener(QUICK_ASK_EVENT, onQuickAsk as EventListener);
  }, [authenticated, mutation.isPending]);

  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{ borderColor: COPILOT.border, backgroundColor: COPILOT.card }}
    >
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: COPILOT.text }}>
        <Sparkles className="h-3.5 w-3.5" style={{ color: COPILOT.accent }} />
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
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0077b6]/50',
            'h-11 w-full rounded-full border pr-11 pl-4 text-[13px] placeholder:font-normal',
            'disabled:opacity-50',
          )}
          style={{
            borderColor: COPILOT.border,
            backgroundColor: COPILOT.elevated,
            color: COPILOT.text,
          }}
          maxLength={80}
        />
        <button
          type="submit"
          disabled={!authenticated || mutation.isPending || !term.trim()}
          aria-label="Send"
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition disabled:opacity-40"
          style={{
            backgroundImage: `linear-gradient(135deg, ${COPILOT.accent} 0%, #5b8cff 100%)`,
            color: '#080d14',
          }}
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
          )}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={!authenticated || mutation.isPending}
            onClick={() => submit(s)}
            className="rounded-full border px-2 py-0.5 text-[10px] font-medium transition hover:border-[#0077b6]/40 hover:text-[#f5f7ff] disabled:opacity-50"
            style={{
              borderColor: COPILOT.border,
              backgroundColor: COPILOT.elevated,
              color: COPILOT.muted,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {mutation.isError ? (
        <p className="mt-2 text-[11px] text-amber-400/95">
          {(mutation.error as Error)?.message ?? 'Request failed'}
        </p>
      ) : null}

      {history.length > 0 ? (
        <ul className="mt-2 space-y-1.5 border-t pt-2" style={{ borderColor: COPILOT.border }}>
          {history.map((entry, i) => (
            <li
              key={`${i}-${entry.modelUsed}`}
              className="border-b pb-2 text-[11px] leading-snug last:border-b-0 last:pb-0"
              style={{ borderColor: COPILOT.border, color: COPILOT.text }}
            >
              {entry.data.text}
              <div className="mt-1 flex gap-2 text-[9px]" style={{ color: COPILOT.muted }}>
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
