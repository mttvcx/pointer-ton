/**
 * Celebration lines for the PnL share card. Instead of FOMO's "@handle's position"
 * attribution, we rotate a random whimsical line (Claude-login-message energy) so
 * the card never names the trader — it just brags. Founder gave the first three;
 * the rest match the vibe. Add/trim freely.
 */
export const SHARE_PHRASES: string[] = [
  "Holy bubbleballs, that's huge!",
  'God-loving barnacles, we made it!',
  'Mom did always tell me to use Pointer.',
  'Sweet mother of gains, look at this.',
  'Well butter my chart and call me rich.',
  'Great galloping green candles!',
  "Somebody pinch me — I'm still up.",
  'By the beard of Satoshi, we ate.',
  'Not to flex, but... okay, to flex.',
  "Certified 'told you so' material.",
];

/** Random line (varies each time the card opens). */
export function randomPhrase(): string {
  return SHARE_PHRASES[Math.floor(Math.random() * SHARE_PHRASES.length)] ?? SHARE_PHRASES[0];
}
