/** Pointer bird mark on all pack fronts. */
export const PACK_POINTER_LOGO = '/branding/pointer-bird-transparent.png';

/** Display SOL/USD for showcase cards (not live oracle). */
export const PACK_SHOWCASE_SOL_USD = 142;

/**
 * Platform fee (basis points) charged when SELLING a token acquired from a pack.
 * Double the standard 1% trade fee, and pack-item sells earn NO cashback. This
 * is a distinct *product* fee (packs), separate from the per-user tier fee seam
 * (`getFeeBpsForUser`).
 */
export const PACK_ITEM_SELL_FEE_BPS = 200;
