'use client';

import {
  CHAMPIONSHIP_REGIONS,
  LOW_SAMPLE_MIN_TRADES,
  LOW_SAMPLE_MIN_VOLUME_USD,
  SOLO_PLACEMENT_POINTS,
  SOLO_WC_QUALIFIER_POINTS,
  SQUAD_PLACEMENT_POINTS,
  SQUAD_SCORE_TOP_MEMBERS,
  SQUAD_WC_QUALIFIER_POINTS,
} from '@/lib/championship/config';

function PointsTable({ title, rows }: { title: string; rows: { maxRank: number; points: number }[] }) {
  return (
    <div className="rounded-md border border-border-subtle/60 bg-bg-base/40 p-4">
      <h4 className="text-sm font-semibold text-fg-primary">{title}</h4>
      <ul className="mt-3 space-y-1.5 text-sm">
        {rows.map((r, i) => {
          const prev = rows[i - 1]?.maxRank ?? 0;
          const label = r.maxRank === prev + 1 ? `#${r.maxRank}` : `#${prev + 1}–#${r.maxRank}`;
          return (
            <li key={r.maxRank} className="flex justify-between gap-4 text-fg-secondary">
              <span>{label}</span>
              <span className="font-mono tabular-nums font-medium text-fg-primary">+{r.points}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RulesPanel() {
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-md border border-border-subtle/70 bg-bg-raised/40 p-5">
        <h2 className="text-base font-bold text-fg-primary">How PTCS works</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
          Weekly cups run Monday through Sunday in your region. Rankings use{' '}
          <strong className="font-medium text-fg-primary">realized PnL only</strong> — open positions
          do not count in v1.
        </p>
      </section>

      <section className="rounded-md border border-border-subtle/70 bg-bg-raised/40 p-5">
        <h3 className="text-sm font-bold text-fg-primary">PTCS Score</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-fg-secondary">
          <li>PnL points: +1 per $10 realized profit (0 if negative).</li>
          <li>ROI multiplier on performance + profit events (0.25× to 1.75×).</li>
          <li>Profit events: bonuses at +50%, +100%, +500%, +1000% trade ROI.</li>
          <li>Volume: +1 per $1,000 traded.</li>
          <li>Placement bonuses after preliminary rank.</li>
          <li>Drawdown penalty above 50% / 75% max drawdown.</li>
        </ol>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <PointsTable title="Solo placement" rows={SOLO_PLACEMENT_POINTS} />
        <PointsTable title="Squad placement" rows={SQUAD_PLACEMENT_POINTS} />
      </div>

      <section className="rounded-md border border-border-subtle/70 bg-bg-raised/40 p-5">
        <h3 className="text-sm font-bold text-fg-primary">Regions</h3>
        <ul className="mt-2 space-y-1 text-sm text-fg-secondary">
          {(Object.keys(CHAMPIONSHIP_REGIONS) as (keyof typeof CHAMPIONSHIP_REGIONS)[]).map((k) => (
            <li key={k}>
              <span className="font-medium text-fg-primary">{CHAMPIONSHIP_REGIONS[k].label}</span>
              <span className="text-fg-muted"> · {CHAMPIONSHIP_REGIONS[k].timeZone}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border border-border-subtle/70 bg-bg-raised/40 p-5 text-sm text-fg-secondary">
        <h3 className="text-sm font-bold text-fg-primary">Squads</h3>
        <p className="mt-2 leading-relaxed">
          Squad score = top {SQUAD_SCORE_TOP_MEMBERS} member scores combined. Everyone can rank — low
          volume accounts may show as low sample internally during review.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <PointsTable title="Solo World Cup QP" rows={SOLO_WC_QUALIFIER_POINTS} />
        <PointsTable title="Squad World Cup QP" rows={SQUAD_WC_QUALIFIER_POINTS} />
      </div>

      <section className="rounded-md border border-border-subtle/60 bg-bg-sunken/30 p-4 text-sm text-fg-muted">
        <p>
          Live rankings are provisional. Anti-abuse checks run after each cup — accounts may be adjusted
          before prizes and World Cup qualification. Minimum volume for full sample: $
          {LOW_SAMPLE_MIN_VOLUME_USD} / {LOW_SAMPLE_MIN_TRADES} trades.
        </p>
      </section>
    </article>
  );
}
