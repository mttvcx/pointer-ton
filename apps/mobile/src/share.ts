import { Share } from 'react-native';

/** Opens the native iOS/Android share sheet. No-op if the user cancels. */
export async function shareText(message: string, url?: string) {
  try {
    await Share.share(url ? { message, url } : { message });
  } catch {
    // user dismissed — ignore
  }
}

/** "Join Pointer" invite carrying the user's referral code (falls back to a plain
 *  invite if they haven't claimed one yet). Used by the Social + Profile share. */
export function shareReferral(code: string) {
  const base = 'https://pointer.am';
  const url = code ? `${base}/?ref=${encodeURIComponent(code)}` : base;
  const message = code
    ? `Join me on Pointer — use my code ${code} and get 50% of your trading fees back. Buy any token with Apple Pay in seconds.`
    : `Join me on Pointer — buy any token with Apple Pay in seconds, and get 50% of your fees back.`;
  return shareText(message, url);
}
