import { CREATOR_TIER_OFFERS } from '@/lib/creators/config';

export default function CreatorOffersPage() {
  const tiers = [CREATOR_TIER_OFFERS.basic, CREATOR_TIER_OFFERS.elite];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Current Offers</h1>
        <p className="mt-0.5 text-[13px] text-fg-muted">
          Accounts are placed into an earning tier based on verified audience demographics (admin review).
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {tiers.map((t) => (
          <div key={t.id} className="creator-glass creator-lift rounded-2xl p-5">
            <h2 className="creator-gradient-text inline-block text-sm font-bold uppercase tracking-[0.12em]">
              {t.label}
            </h2>
            <p className="mt-2 text-[12px] text-fg-muted">{t.countryLabel}</p>
            <p className="mt-1 text-[11px] text-fg-muted">{t.countries.join(' ')}</p>
            <ul className="mt-4 space-y-1.5">
              {t.milestones.map((m) => (
                <li
                  key={m.views}
                  className="flex items-center justify-between border-b border-white/[0.05] pb-1.5 text-[13px] tabular-nums last:border-0"
                >
                  <span className="text-fg-secondary">{(m.views / 1000).toFixed(0)}k views</span>
                  <span className="font-semibold text-signal-bull">+${(m.usdCents / 100).toFixed(0)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-lg bg-accent-primary/10 px-3 py-2 text-center text-[12px] font-semibold text-accent-glow ring-1 ring-inset ring-accent-primary/20">
              ${(t.maxPerVideoUsdCents / 100).toFixed(0)} max per video
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-signal-warn/25 bg-signal-warn/[0.06] p-4 text-[12px] leading-relaxed text-fg-secondary">
        <strong className="text-fg-primary">Anti-abuse (from program rules):</strong> Botting views, stolen/reposted
        clips, and low Tier-1 audience (&lt;20%) lead to rejection, reduced pay, or permanent ban. Duplicate URLs are
        blocked automatically. Appeals available in Settings.
      </div>
    </div>
  );
}
