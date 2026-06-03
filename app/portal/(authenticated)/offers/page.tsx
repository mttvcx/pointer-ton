import { CREATOR_TIER_OFFERS } from '@/lib/creators/config';

export default function CreatorOffersPage() {
  const tiers = [CREATOR_TIER_OFFERS.basic, CREATOR_TIER_OFFERS.elite];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Current Offers</h1>
        <p className="text-[13px] text-fg-muted">
          Accounts are placed into an earning tier based on verified audience demographics (admin review).
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {tiers.map((t) => (
          <div key={t.id} className="rounded-lg border border-border-subtle bg-bg-raised p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-accent-glow">{t.label}</h2>
            <p className="mt-2 text-[12px] text-fg-muted">{t.countryLabel}</p>
            <p className="mt-1 text-[11px] text-fg-muted">{t.countries.join(' ')}</p>
            <ul className="mt-4 space-y-1 text-[13px] tabular-nums">
              {t.milestones.map((m) => (
                <li key={m.views}>
                  +${(m.usdCents / 100).toFixed(0)} @ {(m.views / 1000).toFixed(0)}k views
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] font-semibold text-accent-primary">
              ${(t.maxPerVideoUsdCents / 100).toFixed(0)} max per video
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-signal-warn/30 bg-signal-warn/5 p-4 text-[12px] leading-relaxed text-fg-secondary">
        <strong className="text-fg-primary">Anti-abuse (from program rules):</strong> Botting views, stolen/reposted
        clips, and low Tier-1 audience (&lt;20%) lead to rejection, reduced pay, or permanent ban. Duplicate URLs are
        blocked automatically. Appeals available in Settings.
      </div>
    </div>
  );
}
