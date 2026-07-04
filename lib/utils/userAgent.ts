/**
 * User-agent classification — pure, no I/O (unit-testable). Used to gate mobile
 * web visitors to the "get the native app" screen. Crawlers/link-preview bots
 * are deliberately NOT treated as mobile so SEO + OG previews keep working.
 */

export type MobilePlatform = 'ios' | 'android';

const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|telegrambot|whatsapp|linkedinbot|embedly|quora link preview|pinterest|redditbot|applebot|googlebot|google-inspectiontool|lighthouse|headlesschrome/i;

const IOS_RE = /iphone|ipod|ipad/i;
// iPadOS 13+ reports as desktop Safari but is multi-touch; catch it separately.
const IPADOS_RE = /macintosh/i;
const ANDROID_RE = /android/i;
const MOBILE_HINT_RE = /mobile|silk|kindle|blackberry|opera mini|iemobile|windows phone/i;

/** A real human on a phone/tablet browser (NOT a bot, NOT a desktop). */
export function isMobileUserAgent(ua: string | null | undefined, opts?: { touchPoints?: number }): boolean {
  if (!ua) return false;
  if (BOT_RE.test(ua)) return false;
  if (IOS_RE.test(ua) || ANDROID_RE.test(ua)) return true;
  if (MOBILE_HINT_RE.test(ua)) return true;
  // iPadOS masquerading as macOS Safari — only when we have a touch signal.
  if (IPADOS_RE.test(ua) && (opts?.touchPoints ?? 0) > 1) return true;
  return false;
}

/** Which app store to point the visitor at. Defaults to iOS for Apple devices,
 *  Android for the rest of mobile. */
export function getMobilePlatform(ua: string | null | undefined): MobilePlatform {
  if (!ua) return 'ios';
  if (ANDROID_RE.test(ua)) return 'android';
  if (IOS_RE.test(ua)) return 'ios';
  return 'ios';
}
