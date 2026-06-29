import 'server-only';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomBytes } from 'node:crypto';
import { getRedis } from '@/lib/redis/client';

/**
 * Scoped, revocable extension tokens — the auth bridge for the Pointer browser
 * extension. The extension NEVER holds the user's full Privy session; it holds a
 * short-lived access JWT (1h) scoped to `intel.read trade.intent`, tied to a
 * server-side "family" handle that is the refresh token AND the revocation lever
 * (delete the family → every token under it dies instantly). Mirrors the app's
 * `pointerSession` (jose/HS256) + `revocation` patterns.
 */

const ISS = 'pointer-ext';
const AUD = 'pointer-ext-api';
const ACCESS_TTL = '1h';
const FAMILY_TTL_SEC = 30 * 24 * 60 * 60; // 30d session lifetime
const CODE_TTL_SEC = 120; // one-time connect code
export const EXT_SCOPE = 'intel.read trade.intent';

function secretKey() {
  const raw = process.env.EXT_TOKEN_SECRET?.trim() || process.env.POINTER_SESSION_SECRET?.trim();
  if (!raw || raw.length < 16) {
    throw new Error('EXT_TOKEN_SECRET / POINTER_SESSION_SECRET missing or too short (min 16 chars)');
  }
  return new TextEncoder().encode(raw);
}

const famKey = (fam: string) => `ext:fam:${fam}`;
const codeKey = (code: string) => `ext:code:${code}`;

export interface ExtTokenPayload extends JWTPayload {
  ext: string; // chrome-extension id
  fam: string; // family handle (refresh + revocation)
  scope: string;
}

export interface VerifiedExt {
  userId: string;
  extId: string;
  fam: string;
  scope: string;
}

export interface ExtSession {
  token: string;
  refresh: string; // = family handle
  exp: number; // access-token expiry (epoch seconds)
}

async function mintAccess(userId: string, extId: string, fam: string): Promise<ExtSession> {
  const token = await new SignJWT({ ext: extId, fam, scope: EXT_SCOPE })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .setIssuer(ISS)
    .setAudience(AUD)
    .sign(secretKey());
  const { payload } = await jwtVerify(token, secretKey(), { issuer: ISS, audience: AUD });
  return { token, refresh: fam, exp: payload.exp ?? Math.floor(Date.now() / 1000) + 3600 };
}

/** Create a fresh session (new family) for a user+extension. */
export async function mintExtSession(userId: string, extId: string): Promise<ExtSession> {
  const fam = randomBytes(24).toString('base64url');
  await getRedis().set(famKey(fam), JSON.stringify({ userId, extId }), { ex: FAMILY_TTL_SEC });
  return mintAccess(userId, extId, fam);
}

/** Verify an access token AND confirm its family is still live (instant revoke). */
export async function verifyExtToken(token: string): Promise<VerifiedExt> {
  const { payload } = await jwtVerify(token, secretKey(), { issuer: ISS, audience: AUD });
  const p = payload as ExtTokenPayload;
  if (!p.sub || typeof p.ext !== 'string' || typeof p.fam !== 'string') {
    throw new Error('invalid_ext_token');
  }
  const fam = await getRedis().get<string>(famKey(p.fam));
  if (!fam) throw new Error('revoked'); // family deleted or expired
  return { userId: p.sub, extId: p.ext, fam: p.fam, scope: p.scope ?? '' };
}

/** Exchange a refresh (family) handle for a new access token. */
export async function refreshExtSession(fam: string, extId: string): Promise<ExtSession | null> {
  const raw = await getRedis().get<string>(famKey(fam));
  if (!raw) return null;
  let parsed: { userId?: string; extId?: string };
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw as never);
  } catch {
    return null;
  }
  if (!parsed.userId || parsed.extId !== extId) return null;
  return mintAccess(parsed.userId, extId, fam);
}

/** Revoke a family — every token under it dies on the next verify. */
export async function revokeExtFamily(fam: string): Promise<void> {
  await getRedis().del(famKey(fam));
}

/* ----------------------- one-time connect code ----------------------- */

/** Mint a single-use code (the logged-in web page calls this, then hands the code
 *  to the extension, which exchanges it server-side — so the token never touches
 *  the web page's JS). */
export async function mintConnectCode(userId: string, extId: string): Promise<string> {
  const code = randomBytes(24).toString('base64url');
  await getRedis().set(codeKey(code), JSON.stringify({ userId, extId }), { ex: CODE_TTL_SEC });
  return code;
}

/** Consume a connect code (single-use) → mint a session. */
export async function consumeConnectCode(code: string, extId: string): Promise<ExtSession | null> {
  const k = codeKey(code);
  const raw = await getRedis().get<string>(k);
  if (!raw) return null;
  await getRedis().del(k); // single-use
  let parsed: { userId?: string; extId?: string };
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw as never);
  } catch {
    return null;
  }
  if (!parsed.userId || parsed.extId !== extId) return null;
  return mintExtSession(parsed.userId, extId);
}
