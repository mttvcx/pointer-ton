import { Instrument_Serif } from 'next/font/google';

/**
 * Sibyl's display face — an elegant high-contrast serif (Venice/premium feel) used
 * for the wordmark, hero line, and verdicts. Body copy, labels, and menus stay on the
 * app sans (Geist). Self-hosted by next/font, so no external font request at runtime.
 */
export const sibylSerif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-sibyl-serif',
});
