'use client';

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { ALERT_TYPE_TWITTER_LISTEN } from '@/lib/alerts/alertRuleModel';
import { tweetInputFromAlertPayload } from '@/lib/launch/alertTweet';
import { openLaunchFromPackage } from '@/lib/launch/openLaunchModal';
import type { LaunchPackageVariant } from '@/lib/launch/types';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import { useLaunchPackages } from '@/lib/hooks/useLaunchPackages';
import { protocolBrand } from '@/lib/tokens/protocolBrand';
import { ProtocolBrandIcon } from '@/components/tokens/ProtocolBrandIcon';
import { cn } from '@/lib/utils/cn';

function variantLabel(v: LaunchPackageVariant, index: number): string {
  return `${index + 1}. ${v.suggestedName} · $${v.suggestedTicker.replace(/^\$/, '')}`;
}

export function LaunchSuggestionsRail() {
  const { data: alerts } = useAlertsTickerQuery({ pollAggressively: true });

  const tweetInputs = useMemo(() => {
    const list = alerts ?? [];
    const seen = new Set<string>();
    const out: ReturnType<typeof tweetInputFromAlertPayload>[] = [];
    for (const a of list) {
      if (a.type !== ALERT_TYPE_TWITTER_LISTEN) continue;
      const t = tweetInputFromAlertPayload(a.payload);
      if (!t) continue;
      const key = t.id ?? `${t.authorHandle}:${t.text.slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= 6) break;
    }
    return out.filter(Boolean) as NonNullable<ReturnType<typeof tweetInputFromAlertPayload>>[];
  }, [alerts]);

  const { data: packages, isFetching, isError } = useLaunchPackages(tweetInputs, tweetInputs.length > 0);

  const launchWorthy = useMemo(() => {
    if (!packages) return [];
    return packages
      .filter((row) => row.package.shouldLaunch)
      .sort((a, b) => b.package.confidence - a.package.confidence)
      .slice(0, 3);
  }, [packages]);

  return (
    <section className="flex min-h-0 shrink-0 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-raised">
      <header className="shrink-0 border-b border-border-subtle bg-bg-hover px-3 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-300" aria-hidden />
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-fg-primary">
            AI Suggestions
          </h2>
        </div>
        <p className="mt-1 text-[9px] leading-snug text-fg-muted/90">
          Launch packages cached per tweet · click a variant to pre-fill deploy
        </p>
      </header>

      <div className="max-h-[min(280px,35vh)] overflow-y-auto px-2 py-2 xl:max-h-[min(360px,42vh)]">
        {isFetching && launchWorthy.length === 0 ? (
          <p className="px-1 py-2 text-[10px] text-fg-muted">Scanning tweets…</p>
        ) : null}
        {isError ? (
          <p className="rounded-md border border-amber-500/25 bg-amber-500/8 px-2 py-1.5 text-[9px] text-amber-100/90">
            AI launch scan unavailable — check quota or try again.
          </p>
        ) : null}
        {!isFetching && launchWorthy.length === 0 ? (
          <p className="px-1 py-2 text-[10px] leading-snug text-fg-muted">
            No launch-worthy tweets in recent X listens. Phrase hits with strong meme
            signal will appear here.
          </p>
        ) : null}

        <ul className="flex flex-col gap-2">
          {launchWorthy.map((row) => {
            const variants =
              row.package.variants ??
              ([
                {
                  suggestedName: row.package.suggestedName,
                  suggestedTicker: row.package.suggestedTicker,
                  narrative: row.package.narrative,
                  suggestedLaunchpad: row.package.suggestedLaunchpad,
                  imageStrategy: row.package.imageStrategy,
                  reasoning: row.package.reasoning,
                },
              ] as LaunchPackageVariant[]);
            const pad = protocolBrand(row.package.suggestedLaunchpad);
            return (
              <li
                key={row.subject}
                className="rounded-md border border-violet-500/20 bg-violet-500/[0.06] px-2 py-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-[10px] font-medium leading-snug text-fg-primary">
                    @{row.tweet.authorHandle.replace(/^@/, '')}
                  </p>
                  <span className="shrink-0 rounded-full bg-violet-500/15 px-1.5 py-px text-[8px] font-bold tabular-nums text-violet-200">
                    {Math.round(row.package.confidence * 100)}%
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[9px] text-fg-muted">{row.tweet.text}</p>
                <div className="mt-2 flex flex-col gap-1">
                  {variants.slice(0, 3).map((v, idx) => (
                    <button
                      key={`${row.subject}-${idx}`}
                      type="button"
                      onClick={() => openLaunchFromPackage(row.subject, row.tweet, row.package, idx)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-sunken/80 px-2 py-1.5 text-left transition hover:border-violet-400/35 hover:bg-violet-500/10',
                      )}
                    >
                      <span className="min-w-0 truncate text-[10px] font-semibold text-fg-primary">
                        {variantLabel(v, idx)}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-[9px] text-fg-muted">
                        <ProtocolBrandIcon protocolId={v.suggestedLaunchpad} dotClassName="h-3 w-3" />
                        {protocolBrand(v.suggestedLaunchpad)?.label ?? v.suggestedLaunchpad}
                      </span>
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
