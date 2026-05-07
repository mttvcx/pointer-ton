export const BETA_COOKIE_NAME = 'ptr_beta';

function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b = btoa(bin);
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '===='.slice(s.length % 4);
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)!;
  return out;
}

export async function signBetaSessionCookie(userId: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 400;
  const payload = JSON.stringify({ sub: userId, exp });
  const payloadBytes = enc.encode(payload);
  const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign({ name: 'HMAC' }, key, payloadBytes);
  const payloadB64 = bytesToB64url(payloadBytes);
  const sigB64 = bytesToB64url(new Uint8Array(sig));
  return `${payloadB64}.${sigB64}`;
}

export async function verifyBetaSessionCookie(
  raw: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!raw || !secret) return false;
  const parts = raw.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return false;
  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = b64urlToBytes(payloadB64);
    sigBytes = b64urlToBytes(sigB64);
  } catch {
    return false;
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sigView = new Uint8Array(sigBytes);
  const payloadView = new Uint8Array(payloadBytes);
  const ok = await crypto.subtle.verify({ name: 'HMAC' }, key, sigView, payloadView);
  if (!ok) return false;
  let payloadStr: string;
  try {
    payloadStr = new TextDecoder().decode(payloadView);
  } catch {
    return false;
  }
  try {
    const body = JSON.parse(payloadStr) as { sub?: string; exp?: number };
    if (!body.sub || typeof body.exp !== 'number') return false;
    if (body.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}
