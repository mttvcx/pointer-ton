import type { PackType } from '@/types/pack';

/**
 * Premium 3D foil-pack renders (Blender), one per tier — the full pack face
 * (tier title, `pointer.` lockup, graded hero, tagline) baked into a transparent PNG.
 * When a tier has an entry here, PackFoilDesign shows the render instead of the
 * procedural foil. Set a tier to null to fall back to the procedural design.
 *
 * Assets live in public/packs/renders/ (source pipeline: pointer-pack-render/).
 */
export const PACK_RENDER_IMAGE: Record<PackType, string | null> = {
  bronze: '/packs/renders/pointer_bronze.png',
  silver: '/packs/renders/pointer_silver.png',
  gold: '/packs/renders/pointer_gold.png',
  diamond: '/packs/renders/pointer_diamond.png',
  legendary: '/packs/renders/pointer_legendary.png',
};

/**
 * Bump when the render PNGs are re-exported (same filenames) so browsers and the
 * CDN fetch the new bytes instead of serving the cached old pack. v5 = real 3D
 * crimped foil seals.
 */
export const PACK_RENDER_VERSION = 5;

export function packRenderImage(type: PackType): string | null {
  const src = PACK_RENDER_IMAGE[type];
  return src ? `${src}?v=${PACK_RENDER_VERSION}` : null;
}

/**
 * Flat pack-front panel (the portrait design only, no 3D packet) — used as the
 * printed-front texture on the interactive WebGL pack (Pack3D). Cropped from the
 * same posters as PACK_RENDER_IMAGE. Set a tier to null to fall back to the
 * procedural canvas front.
 */
export const PACK_FRONT_IMAGE: Record<PackType, string | null> = {
  bronze: '/packs/fronts/pointer_bronze.jpg',
  silver: '/packs/fronts/pointer_silver.jpg',
  gold: '/packs/fronts/pointer_gold.jpg',
  diamond: '/packs/fronts/pointer_diamond.jpg',
  legendary: '/packs/fronts/pointer_legendary.jpg',
};

export function packFrontImage(type: PackType): string | null {
  return PACK_FRONT_IMAGE[type] ?? null;
}
