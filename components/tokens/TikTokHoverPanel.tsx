'use client';

import { useTikTokPreview } from '@/lib/hooks/useTikTokPreview';
import { PulseLuminanceGlyph, PULSE_BRAND_SRC } from '@/components/tokens/PulseGlyphMask';

/** Same overlay/tech as the Twitter profile hover — grey panel, TikTok glyph, oEmbed preview. */
const PANEL_BG = '#1b1b1f';

export function TikTokHoverPanel({ url }: { url: string }) {
  const { data, isLoading } = useTikTokPreview(url);
  const handle = data?.handle ?? url.match(/@([\w.]+)/)?.[1] ?? null;
  const authorName = data?.authorName ?? (handle ? `@${handle}` : 'TikTok');

  return (
    <div className="w-[280px] overflow-hidden rounded-xl border border-white/10 text-white shadow-2xl" style={{ backgroundColor: PANEL_BG }}>
      <div className="flex items-center gap-2.5 px-3 pt-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
          <PulseLuminanceGlyph src={PULSE_BRAND_SRC.tiktok} size={18} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{authorName}</div>
          <div className="truncate text-[11px] text-white/45">{handle ? `@${handle}` : 'Profile'} · TikTok</div>
        </div>
      </div>

      {data?.thumbnailUrl ? (
        <div className="mt-3 px-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.thumbnailUrl}
            alt=""
            className="h-[150px] w-full rounded-lg object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      ) : null}

      {data?.title ? <div className="px-3 pt-2 text-[12px] leading-snug text-white/70">{data.title}</div> : null}
      {isLoading && !data ? <div className="px-3 pt-2 text-[11px] text-white/40">Loading preview…</div> : null}

      <div className="p-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-full bg-white/[0.06] py-2 text-center text-[12px] font-medium text-white/90 transition-colors hover:bg-white/[0.10]"
        >
          View on TikTok
        </a>
      </div>
    </div>
  );
}
