import type { ImageSourcePropType } from 'react-native';
import type { PackType } from './api'; // bronze|silver|gold|diamond|legendary

/**
 * The finished pack FRONTS (matching web). Each JPG is the whole clean face —
 * tier title, PACK, the pointer. lockup, hero art, subline and collection id are
 * ALL baked in. Never overlay text on the image itself. The `titleFont` / `accent`
 * / `subline` here are for the heading rendered ABOVE the card in the app chrome.
 */
export type PackArt = {
  image: ImageSourcePropType; // the clean pack front
  themedName: string; // baked into the art — for a11y label only
  titleFont: string; // loaded font family for the card heading
  subline: string; // tagline shown near the title/price
  accent: string; // tier accent color (title + glow)
  aspectRatio: number; // pack card proportions (w/h)
};

export const PACK_ART: Record<PackType, PackArt> = {
  bronze: { image: require('../../assets/packs/pointer_bronze.jpg'), themedName: 'STARTER', titleFont: 'PackStarter', subline: 'everyone starts at zero', accent: '#d4a574', aspectRatio: 685 / 1200 },
  silver: { image: require('../../assets/packs/pointer_silver.jpg'), themedName: 'DEGEN', titleFont: 'PackDegen', subline: 'aped. leveraged. praying', accent: '#93c5fd', aspectRatio: 685 / 1200 },
  gold: { image: require('../../assets/packs/pointer_gold.jpg'), themedName: 'WHALE', titleFont: 'PackWhale', subline: 'size is everything', accent: '#fde047', aspectRatio: 685 / 1200 },
  diamond: { image: require('../../assets/packs/pointer_diamond.jpg'), themedName: 'DIAMOND', titleFont: 'PackDiamond', subline: "hands don't shake", accent: '#a5f3fc', aspectRatio: 685 / 1200 },
  legendary: { image: require('../../assets/packs/pointer_legendary.jpg'), themedName: 'ORACLE', titleFont: 'PackOracle', subline: 'sees the top', accent: '#e9d5ff', aspectRatio: 685 / 1200 },
};

/** Safe lookup — the API delivers `type` as a string; fall back to silver. */
export function packArtFor(type: string): PackArt {
  return PACK_ART[type as PackType] ?? PACK_ART.silver;
}
