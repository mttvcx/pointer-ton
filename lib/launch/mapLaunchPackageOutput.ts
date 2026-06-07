import type { LaunchPackageOutput } from '@/lib/ai/schemas';
import {
  LAUNCH_PACKAGE_LAUNCHPADS,
  type LaunchPackage,
  type LaunchPackageLaunchpad,
  type LaunchPackageVariant,
} from '@/lib/launch/types';

function normalizeLaunchpad(raw: string): LaunchPackageLaunchpad {
  const s = raw.trim().toLowerCase();
  if (s === 'pump' || s === 'pumpfun') return 'pump.fun';
  if (s.includes('moon')) return 'moonshot';
  if (s.includes('bonk') && s.includes('er')) return 'bonkers';
  if (s.includes('bonk')) return 'bonk';
  const hit = LAUNCH_PACKAGE_LAUNCHPADS.find((id) => id === s || s.includes(id.replace('.fun', '')));
  return hit ?? 'pump.fun';
}

function normalizeVariant(v: LaunchPackageOutput['options'][number]): LaunchPackageVariant {
  return {
    suggestedName: v.suggestedName.trim().slice(0, 32),
    suggestedTicker: v.suggestedTicker.trim().replace(/^\$/, '').toUpperCase().slice(0, 10),
    narrative: v.narrative.trim().slice(0, 500),
    suggestedLaunchpad: normalizeLaunchpad(v.suggestedLaunchpad),
    imageStrategy: v.imageStrategy,
    reasoning: v.reasoning.trim().slice(0, 500),
  };
}

/** Safe "no launch" package — also used as a per-tweet fallback when AI fails. */
export const EMPTY_LAUNCH_PACKAGE: LaunchPackage = {
  shouldLaunch: false,
  confidence: 0,
  suggestedName: '',
  suggestedTicker: '',
  narrative: '',
  suggestedLaunchpad: 'pump.fun',
  imageStrategy: 'no_image',
  reasoning: '',
};

export function mapLaunchPackageOutput(raw: LaunchPackageOutput): LaunchPackage {
  if (!raw.shouldLaunch || raw.options.length === 0) {
    return {
      ...EMPTY_LAUNCH_PACKAGE,
      shouldLaunch: false,
      confidence: Math.min(1, Math.max(0, raw.confidence)),
      reasoning: raw.reasoning?.trim() || 'Not a strong launch signal.',
    };
  }

  const variants = raw.options.slice(0, 3).map(normalizeVariant) as [
    LaunchPackageVariant,
    LaunchPackageVariant,
    LaunchPackageVariant,
  ];
  while (variants.length < 3) {
    variants.push({ ...variants[variants.length - 1]! });
  }

  const primary = variants[0]!;
  return {
    shouldLaunch: true,
    confidence: Math.min(1, Math.max(0, raw.confidence)),
    suggestedName: primary.suggestedName,
    suggestedTicker: primary.suggestedTicker,
    narrative: primary.narrative,
    suggestedLaunchpad: primary.suggestedLaunchpad,
    imageStrategy: primary.imageStrategy,
    reasoning: primary.reasoning,
    variants: [variants[0]!, variants[1]!, variants[2]!],
  };
}
