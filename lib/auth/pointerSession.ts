import 'server-only';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const ISS = 'pointer-ton';
const AUD = 'pointer-api';

function secretKey() {
  const raw = process.env.POINTER_SESSION_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error('POINTER_SESSION_SECRET missing or too short (min 16 chars)');
  }
  return new TextEncoder().encode(raw);
}

export interface PointerSessionClaims extends JWTPayload {
  /** Canonical TON address (bounceable, url-safe). */
  w: string;
}

export async function signPointerSession(authSubject: string, walletCanonical: string): Promise<string> {
  return new SignJWT({ w: walletCanonical })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(authSubject)
    .setIssuedAt()
    .setExpirationTime('7d')
    .setIssuer(ISS)
    .setAudience(AUD)
    .sign(secretKey());
}

export interface VerifiedPointerSession {
  /** Same value persisted in `users.privy_id` for TonConnect users (`ton:…`). */
  authSubject: string;
  walletAddress: string;
}

export async function verifyPointerAccessToken(token: string): Promise<VerifiedPointerSession> {
  const { payload } = await jwtVerify(token, secretKey(), {
    issuer: ISS,
    audience: AUD,
  });
  const sub = payload.sub;
  const w = payload.w;
  if (!sub || typeof w !== 'string') throw new Error('invalid session token');
  return { authSubject: sub, walletAddress: w };
}
