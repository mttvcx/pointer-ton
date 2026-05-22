import type { PulseTokenBundle } from '@/types/tokens';
import type { AppChainId } from '@/lib/chains/appChain';
import { inferMintKind } from '@/lib/chains/mintKind';
import { launchPadToProtocolId, protocolBrand } from '@/lib/tokens/protocolBrand';
import { quoteSymbolFromBundle, resolveQuoteTokenKind, quoteTokenLabel } from '@/lib/tokens/quoteToken';

export type PulseTechTag = {
  key: string;
  label: string;
  title?: string;
};

function ingestSourceFromBundle(bundle: PulseTokenBundle): string | null {
  const raw = bundle.token.raw_metadata;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const src =
    (typeof r.pointerIngestSource === 'string' ? r.pointerIngestSource : null) ??
    (typeof r.ingestSource === 'string' ? r.ingestSource : null);
  if (src?.trim()) return src.trim();
  if (r.geckoNetwork === 'bsc' || r.geckoNetwork === 'base') return 'gecko_terminal';
  if (r.geckoHydrate === true) return 'gecko_hydrate';
  if (typeof r.geckoPool === 'object' && r.geckoPool) return 'gecko_terminal';
  return null;
}

/** Compact QA tags for Pulse rows — protocol, quote pair, ingest source, chain. */
export function resolvePulseTechTags(bundle: PulseTokenBundle, chain: AppChainId): PulseTechTag[] {
  const tags: PulseTechTag[] = [];
  const mintKind = inferMintKind(bundle.token.mint);

  tags.push({
    key: 'chain',
    label: mintKind.toUpperCase(),
    title: `Mint kind: ${mintKind}`,
  });

  const pad = bundle.token.launch_pad?.trim();
  if (pad) {
    const proto = launchPadToProtocolId(pad, chain);
    const brand = proto ? protocolBrand(proto) : null;
    tags.push({
      key: 'launch',
      label: brand?.label ?? pad,
      title: `launch_pad: ${pad}`,
    });
  }

  const quoteKind = resolveQuoteTokenKind(bundle, chain);
  if (quoteKind) {
    tags.push({
      key: 'quote',
      label: quoteTokenLabel(quoteKind, chain),
      title: `Pair quote: ${quoteSymbolFromBundle(bundle) ?? quoteTokenLabel(quoteKind, chain)}`,
    });
  }

  const src = ingestSourceFromBundle(bundle);
  if (src) {
    tags.push({
      key: 'src',
      label: src.replace(/_/g, ' '),
      title: `Ingest source: ${src}`,
    });
  }

  return tags;
}

export function pulseTechLabelsEnabled(): boolean {
  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage.getItem('pointer-pulse-tech-labels') === '1') return true;
    } catch {
      /* ignore */
    }
  }
  const v = process.env.NEXT_PUBLIC_POINTER_PULSE_TECH_LABELS;
  return v === '1' || v === 'true';
}
