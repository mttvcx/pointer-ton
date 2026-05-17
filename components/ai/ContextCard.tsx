'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import {
  AlertTriangle,
  Loader2,
  MapPin,
  Pin,
  PinOff,
  Sparkles,
  TrendingDown,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import {
  type ExplainTokenOutput,
  type ExplainWalletOutput,
} from '@/lib/ai/schemas';
import {
  selectCopilotSurfaceOpen,
  selectLockSource,
  useUIStore,
  type EntityRef,
} from '@/store/ui';
import { CopyButton } from '@/components/shared/CopyButton';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';

type CommonResult = {
  cacheHit: boolean;
  modelUsed: string;
  costUsd: number;
};
type TokenResult = CommonResult & { data: ExplainTokenOutput };
type WalletResult = CommonResult & { data: ExplainWalletOutput };

const COPILOT = {
  card: 'rgba(255, 255, 255, 0.04)',
  border: 'rgba(255, 255, 255, 0.1)',
  muted: '#9ba3b0',
  text: '#f0f4fc',
  accent: '#0077b6',
  cyan: '#34d5ff',
} as const;

function dispatchCopilotAsk(detail: string) {
  window.dispatchEvent(new CustomEvent('pointer-copilot-quick-ask', { detail }));
}

const DEBOUNCE_MS = 350;

function useDebouncedEntity(entity: EntityRef | null): EntityRef | null {
  const [value, setValue] = useState<EntityRef | null>(entity);
  useEffect(() => {
    const delay = entity ? DEBOUNCE_MS : 0;
    const handle = setTimeout(() => setValue(entity), delay);
    return () => clearTimeout(handle);
  }, [entity?.type, entity?.id, entity?.label, entity]);
  return value;
}

export function ContextCard({ entity }: { entity: EntityRef | null }) {
  const debounced = useDebouncedEntity(entity);
  const copilotSurfaceOpen = useUIStore(selectCopilotSurfaceOpen);
  const { authenticated, getAccessToken } = usePointerAuth();
  const [mode, setMode] = useState<'fast' | 'deep'>('fast');
  const lastEntityKeyRef = useRef<string | null>(null);
  const lockSource = useUIStore(selectLockSource);
  const pinHovered = useUIStore((s) => s.pinHovered);
  const clearLocked = useUIStore((s) => s.clearLocked);

  const entityKey = debounced ? `${debounced.type}:${debounced.id}` : null;
  useEffect(() => {
    if (entityKey !== lastEntityKeyRef.current) {
      lastEntityKeyRef.current = entityKey;
      setMode('fast');
    }
  }, [entityKey]);

  const queryKey = useMemo(
    () => ['ai-explain', debounced?.type, debounced?.id, mode] as const,
    [debounced?.type, debounced?.id, mode],
  );

  const enabled = Boolean(authenticated && debounced && copilotSurfaceOpen);

  const openAlertBuilder = useCallback(() => {
    useUIStore.getState().setAlertRulesModalOpen(true);
    queueMicrotask(() => {
      document.getElementById('copilot-alert-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

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
          ? { mint: debounced.id, mode }
          : { address: debounced.id, mode };
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
        const code =
          typeof json === 'object' && json && 'error' in json
            ? String((json as { error: unknown }).error)
            : '';
        throw Object.assign(new Error(msg), { status: res.status, code });
      }
      return json as TokenResult | WalletResult;
    },
  });

  if (!authenticated) {
    return (
      <div
        className="rounded-2xl border px-3 py-2.5 text-[12px] leading-snug backdrop-blur-md shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]"
        style={{ borderColor: COPILOT.border, backgroundColor: COPILOT.card, color: COPILOT.muted }}
      >
        Sign in to use Pointer Co-Pilot.
      </div>
    );
  }

  if (!debounced) {
    return (
      <div
        className="rounded-2xl border px-3 py-2.5 backdrop-blur-md shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]"
        style={{ borderColor: COPILOT.border, backgroundColor: COPILOT.card }}
      >
        <div className="flex items-start gap-2.5">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
            style={{
              borderColor: `${COPILOT.accent}55`,
              color: COPILOT.cyan,
              boxShadow: `0 0 14px -3px ${COPILOT.accent}55`,
              backgroundColor: 'rgba(21, 25, 36, 0.55)',
            }}
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-tight" style={{ color: COPILOT.text }}>
              Co-Pilot is ready
            </p>
            <p className="mt-1 text-[11px] leading-snug" style={{ color: COPILOT.muted }}>
              Hover a token, open a token page, or ask anything about market structure, holders, or alerts.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(
                [
                  ['explain', 'Explain token', () => dispatchCopilotAsk('What should I check first on a new TON token?')],
                  ['risks', 'Find risks', () => dispatchCopilotAsk('What are the most common rug and bundle risks on fresh launches?')],
                  ['alert', 'Build alert', openAlertBuilder],
                ] as const
              ).map(([key, label, fn]) => (
                <button
                  key={key}
                  type="button"
                  onClick={fn}
                  className="inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-medium transition hover:bg-white/[0.04]"
                  style={{ borderColor: COPILOT.border, color: COPILOT.text }}
                >
                  {label}
                  <ChevronRight className="h-2.5 w-2.5 opacity-60" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const subjectLabel =
    debounced.label ??
    (debounced.type === 'token' ? `Mint ${shortenAddress(debounced.id)}` : shortenAddress(debounced.id, 6));
  const detailHref =
    debounced.type === 'token' ? `/token/${debounced.id}` : `/wallet/${debounced.id}`;

  return (
    <div
      className="rounded-2xl border px-3 py-2.5 backdrop-blur-md shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]"
      style={{ borderColor: COPILOT.border, backgroundColor: COPILOT.card }}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: COPILOT.muted }}>
            <span className="capitalize">{debounced.type === 'token' ? 'Token' : 'Wallet'}</span>
            <PinIndicator
              source={lockSource}
              onPin={pinHovered}
              onUnpin={() => clearLocked({ onlyManual: true })}
            />
          </p>
          <Link
            href={detailHref}
            className="mt-0.5 block truncate text-[14px] font-semibold transition hover:text-[#9b87ff]"
            style={{ color: COPILOT.text }}
            title={debounced.id}
          >
            {subjectLabel}
          </Link>
          <div className="mt-0.5">
            <CopyButton
              value={debounced.id}
              toastLabel={`${debounced.type} address copied`}
              label={`Copy ${debounced.type} address`}
              className="tabular-nums text-[10px] text-fg-muted hover:text-fg-secondary"
            >
              {shortenAddress(debounced.id, 4)}
            </CopyButton>
          </div>
        </div>
        <ModeToggle mode={mode} onChange={setMode} disabled={query.isFetching} />
      </div>

      {query.isFetching ? (
        <div className="flex items-center gap-2 border-b border-border-subtle py-1.5 text-[11px] text-fg-muted">
          <Loader2 className="h-3 w-3 animate-spin text-accent-primary" />
          {mode === 'deep' ? 'Pointer is thinking deeply...' : 'Pointer is thinking...'}
        </div>
      ) : null}

      {query.isError && !query.isFetching ? (
        <ErrorBox
          message={(query.error as Error)?.message ?? 'Request failed'}
          code={(query.error as { code?: string })?.code}
        />
      ) : null}

      {query.data ? (
        <ResultBody entityType={debounced.type} result={query.data} />
      ) : null}
      </div>
    </div>
  );
}

function PinIndicator({
  source,
  onPin,
  onUnpin,
}: {
  source: 'route' | 'manual' | null;
  onPin: () => void;
  onUnpin: () => void;
}) {
  if (source === 'route') {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full bg-bg-hover px-1.5 py-px text-[9px] font-medium normal-case tracking-normal text-fg-secondary"
        title="Pinned by current page; navigate away to unpin."
      >
        <MapPin className="h-2.5 w-2.5" />
        page
      </span>
    );
  }
  if (source === 'manual') {
    return (
      <button
        type="button"
        onClick={onUnpin}
        title="Unpin (Esc)"
        aria-label="Unpin"
        className="focus-ring inline-flex items-center gap-0.5 rounded-full border border-accent-primary/40 px-1.5 py-px text-[9px] font-medium normal-case tracking-normal text-accent-primary transition-all duration-150 hover:border-accent-primary"
      >
        <PinOff className="h-2.5 w-2.5" />
        pinned
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onPin}
      title="Pin to keep on screen while you browse"
      aria-label="Pin"
      className="focus-ring inline-flex items-center gap-0.5 rounded-full border border-border-subtle bg-bg-base px-1.5 py-px text-[9px] font-medium normal-case tracking-normal text-fg-muted transition hover:border-border-default hover:text-fg-primary"
    >
      <Pin className="h-2.5 w-2.5" />
      pin
    </button>
  );
}

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: 'fast' | 'deep';
  onChange: (m: 'fast' | 'deep') => void;
  disabled: boolean;
}) {
  return (
    <div className="flex shrink-0 divide-x divide-border-subtle overflow-hidden border border-border-subtle text-[10px]">
      {(['fast', 'deep'] as const).map((m) => (
        <button
          key={m}
          type="button"
          disabled={disabled}
          onClick={() => onChange(m)}
          className={cn(
            'btn-press focus-ring px-2 py-0.5 font-semibold uppercase tracking-wide transition-all duration-150 disabled:opacity-50',
            mode === m
              ? 'text-fg-primary'
              : 'text-fg-muted hover:text-fg-secondary',
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function ErrorBox({ message: _message, code: _code }: { message: string; code?: string }) {
  void _message;
  void _code;
  return (
    <div className="flex flex-col gap-1.5 rounded border border-signal-bear/20 bg-signal-bear/10 p-2">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-signal-bear" />
        <span className="text-xs font-medium text-signal-bear">AI unavailable</span>
      </div>
      <p className="text-[11px] leading-relaxed text-fg-muted">
        The AI assistant is temporarily unavailable. Token data and trading features are unaffected.
      </p>
    </div>
  );
}

function ResultBody({
  entityType,
  result,
}: {
  entityType: 'token' | 'wallet';
  result: TokenResult | WalletResult;
}) {
  const verdict = pickVerdict(entityType, result);
  return (
    <div className="space-y-3 text-xs">
      <VerdictBadge verdict={verdict} />
      <p className="leading-relaxed text-fg-primary">{result.data.summary}</p>

      {entityType === 'token' ? (
        <TokenSections data={result.data as ExplainTokenOutput} />
      ) : (
        <WalletSections data={result.data as ExplainWalletOutput} />
      )}

      <ResultMeta result={result} />
    </div>
  );
}

interface Verdict {
  label: string;
  tone: 'bull' | 'bear' | 'warn' | 'neutral';
  confidence: 'low' | 'medium' | 'high';
}

function pickVerdict(
  entityType: 'token' | 'wallet',
  result: TokenResult | WalletResult,
): Verdict {
  if (entityType === 'token') {
    const d = result.data as ExplainTokenOutput;
    const bull = d.bullCase.length;
    const bear = d.bearCase.length;
    const risk = d.riskFlags.length;
    if (risk >= 2 || (bear > 0 && bear >= bull * 2)) {
      return { label: 'High Risk', tone: 'bear', confidence: d.confidence };
    }
    if (bull > bear) return { label: 'Bullish lean', tone: 'bull', confidence: d.confidence };
    if (bear > bull) return { label: 'Bearish lean', tone: 'bear', confidence: d.confidence };
    if (risk > 0) return { label: 'Watch', tone: 'warn', confidence: d.confidence };
    return { label: 'Neutral', tone: 'neutral', confidence: d.confidence };
  }
  const d = result.data as ExplainWalletOutput;
  if (d.cautions.length >= 2) return { label: 'Caution', tone: 'warn', confidence: d.confidence };
  if (d.strengths.length > d.cautions.length)
    return { label: d.archetype, tone: 'bull', confidence: d.confidence };
  return { label: d.archetype, tone: 'neutral', confidence: d.confidence };
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const tone = verdict.tone;
  const Icon =
    tone === 'bull' ? TrendingUp : tone === 'bear' ? TrendingDown : tone === 'warn' ? AlertTriangle : Sparkles;
  const palette =
    tone === 'bull'
      ? 'border-signal-bull/40 text-signal-bull'
      : tone === 'bear'
        ? 'border-signal-bear/40 text-signal-bear'
        : tone === 'warn'
          ? 'border-signal-warn/40 text-signal-warn'
          : 'border-border-subtle text-fg-secondary';
  return (
    <div className={cn('flex items-center justify-between border p-2', palette)}>
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.02em]">{verdict.label}</span>
      </div>
      <ConfidenceTag confidence={verdict.confidence} />
    </div>
  );
}

function ResultMeta({ result }: { result: CommonResult }) {
  return (
    <div className="flex items-center gap-2 border-t border-border-subtle pt-2 text-[10px] text-fg-muted">
      <span
        className={cn(
          'rounded px-1.5 py-px tabular-nums uppercase tracking-wide ring-1 ring-inset ring-border-subtle',
          result.cacheHit ? 'text-fg-muted' : 'text-accent-primary',
        )}
      >
        {result.cacheHit ? 'cached' : 'fresh'}
      </span>
      <span className="tabular-nums">{shortModel(result.modelUsed)}</span>
      <span className="ml-auto tabular-nums tabular-nums">${result.costUsd.toFixed(4)}</span>
    </div>
  );
}

function TokenSections({ data }: { data: ExplainTokenOutput }) {
  return (
    <>
      {data.bullCase.length > 0 ? (
        <Section title="Bull case" tone="bull">
          {data.bullCase.map((line, i) => <li key={`b-${i}`}>{line}</li>)}
        </Section>
      ) : null}
      {data.bearCase.length > 0 ? (
        <Section title="Bear case" tone="bear">
          {data.bearCase.map((line, i) => <li key={`r-${i}`}>{line}</li>)}
        </Section>
      ) : null}
      {data.riskFlags.length > 0 ? (
        <Section title="Risk flags" tone="warn">
          {data.riskFlags.map((line, i) => <li key={`f-${i}`}>{line}</li>)}
        </Section>
      ) : null}
    </>
  );
}

function WalletSections({ data }: { data: ExplainWalletOutput }) {
  return (
    <>
      {data.strengths.length > 0 ? (
        <Section title="Strengths" tone="bull">
          {data.strengths.map((line, i) => <li key={`s-${i}`}>{line}</li>)}
        </Section>
      ) : null}
      {data.cautions.length > 0 ? (
        <Section title="Cautions" tone="warn">
          {data.cautions.map((line, i) => <li key={`c-${i}`}>{line}</li>)}
        </Section>
      ) : null}
    </>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'bull' | 'bear' | 'warn';
  children: React.ReactNode;
}) {
  const toneClass =
    tone === 'bull'
      ? 'text-signal-bull'
      : tone === 'bear'
        ? 'text-signal-bear'
        : 'text-signal-warn';
  const markerColor =
    tone === 'bull'
      ? '[&>li]:before:bg-signal-bull'
      : tone === 'bear'
        ? '[&>li]:before:bg-signal-bear'
        : '[&>li]:before:bg-signal-warn';
  return (
    <div>
      <div className={cn('text-[10px] font-semibold uppercase tracking-[0.02em]', toneClass)}>
        {title}
      </div>
      <ul
        className={cn(
          'mt-1 space-y-1 text-[11px] leading-snug text-fg-secondary',
          '[&>li]:relative [&>li]:pl-3',
          '[&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[7px] [&>li]:before:h-1 [&>li]:before:w-1 [&>li]:before:rounded-full',
          markerColor,
        )}
      >
        {children}
      </ul>
    </div>
  );
}

function ConfidenceTag({ confidence }: { confidence: 'low' | 'medium' | 'high' }) {
  const dots = confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1;
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide opacity-90"
      title={`Confidence: ${confidence}`}
    >
      <span className="flex items-center gap-0.5">
        {Array.from({ length: 3 }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 w-1.5 rounded-full transition',
              i < dots ? 'bg-current' : 'bg-current/25',
            )}
          />
        ))}
      </span>
      {confidence}
    </span>
  );
}

function shortModel(model: string): string {
  if (model.includes('gemini')) return 'gemini';
  if (model.includes('haiku')) return 'haiku';
  if (model.includes('sonnet')) return 'sonnet';
  return model.split('-').slice(-1)[0] ?? model;
}
