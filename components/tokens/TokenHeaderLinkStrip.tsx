'use client';

import { useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { getPulseSocialModel } from '@/lib/tokens/pulseSocialLinks';
import { getPulseRowTraitFlags } from '@/lib/tokens/pumpTokenSignals';
import {
  PulseGlyphMask,
  PulseLuminanceGlyph,
  PULSE_BRAND_SRC,
  PULSE_GLYPH,
  PULSE_INSTAGRAM_SRC,
} from '@/components/tokens/PulseGlyphMask';
import type { PulseTokenBundle } from '@/types/tokens';

const ICON = 13;

const hit =
  'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-fg-muted/85 transition-colors hover:text-fg-primary';

function LinkIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={hit}>
      {children}
    </a>
  );
}

/** Token page — linked socials only (no holder / pro / dev stats from Pulse rows). */
export function TokenHeaderLinkStrip({ bundle }: { bundle: PulseTokenBundle }) {
  const model = useMemo(() => getPulseSocialModel(bundle), [bundle]);
  const traits = useMemo(() => getPulseRowTraitFlags(bundle), [bundle]);

  const profileUrl =
    model.twitterProfile?.url ??
    (() => {
      const h = bundle.token.twitter_handle?.replace(/^@/, '').trim();
      return h && !h.includes('/') ? `https://x.com/${encodeURIComponent(h)}` : null;
    })();

  const nodes: React.ReactNode[] = [];

  if (profileUrl) {
    nodes.push(
      <LinkIcon key="profile" href={profileUrl} label="X profile">
        <PulseGlyphMask name="profile" size={ICON} />
      </LinkIcon>,
    );
  }

  if (model.twitterTweet?.url) {
    nodes.push(
      <LinkIcon key="tweet" href={model.twitterTweet.url} label="Linked post on X">
        <PulseLuminanceGlyph src={PULSE_GLYPH.feather} size={ICON} className="text-fg-secondary" />
      </LinkIcon>,
    );
  }

  if (model.twitterSearch?.url) {
    nodes.push(
      <LinkIcon key="x-search" href={model.twitterSearch.url} label="Search on X">
        <PulseGlyphMask name="xLogo" size={ICON} />
      </LinkIcon>,
    );
  }

  if (model.telegram) {
    nodes.push(
      <LinkIcon key="telegram" href={model.telegram} label="Telegram">
        <PulseGlyphMask name="telegram" size={ICON} />
      </LinkIcon>,
    );
  }

  if (model.instagram) {
    nodes.push(
      <LinkIcon key="instagram" href={model.instagram} label="Instagram">
        <PulseLuminanceGlyph src={PULSE_INSTAGRAM_SRC} size={ICON} />
      </LinkIcon>,
    );
  }

  if (model.github) {
    nodes.push(
      <LinkIcon key="github" href={model.github} label="GitHub">
        <PulseLuminanceGlyph src={PULSE_BRAND_SRC.github} size={ICON} />
      </LinkIcon>,
    );
  }

  if (model.youtube) {
    nodes.push(
      <LinkIcon key="youtube" href={model.youtube} label="YouTube">
        <PulseLuminanceGlyph src={PULSE_BRAND_SRC.youtube} size={ICON} />
      </LinkIcon>,
    );
  }

  if (model.tiktok) {
    nodes.push(
      <LinkIcon key="tiktok" href={model.tiktok} label="TikTok">
        <PulseLuminanceGlyph src={PULSE_BRAND_SRC.tiktok} size={ICON} />
      </LinkIcon>,
    );
  }

  if (model.website) {
    nodes.push(
      <LinkIcon key="website" href={model.website} label="Website">
        <PulseGlyphMask name="globe" size={ICON} />
      </LinkIcon>,
    );
  }

  if (traits.agent) {
    nodes.push(
      <span key="agent" className={cn(hit, 'cursor-default')} aria-label="Pump agent" role="img">
        <PulseLuminanceGlyph src={PULSE_GLYPH.agent} size={ICON} className="text-signal-positive" />
      </span>,
    );
  }

  if (traits.cashback) {
    nodes.push(
      <span key="cashback" className={cn(hit, 'cursor-default')} aria-label="Cashback" role="img">
        <PulseGlyphMask name="cashback" size={ICON} variant="mono" />
      </span>,
    );
  }

  if (traits.feeShare) {
    nodes.push(
      <span key="fee-share" className={cn(hit, 'cursor-default')} aria-label="Fee share" role="img">
        <PulseGlyphMask name="feeShare" size={ICON} variant="mono" />
      </span>,
    );
  }

  if (nodes.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-hidden">
      {nodes}
    </div>
  );
}
