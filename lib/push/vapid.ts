import 'server-only';

import webpush from 'web-push';

let configured = false;

/** Returns public key for clients; configures web-push once when private key is set. */
export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;
}

export function configureWebPushIfNeeded(): boolean {
  if (configured) return Boolean(process.env.VAPID_PRIVATE_KEY?.trim());

  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:dev@localhost';

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}
