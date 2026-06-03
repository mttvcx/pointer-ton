import 'server-only';
import { DEV_ADMIN_DISCORD_ID } from '@/lib/creators/devAuth';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const CREATOR_SESSION_COOKIE = 'pointer_creator_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

function secret(): Uint8Array {
  const raw =
    process.env.CREATOR_PORTAL_SESSION_SECRET?.trim() ||
    process.env.POINTER_SESSION_SECRET?.trim();
  if (!raw || raw.length < 16) {
    throw new Error('CREATOR_PORTAL_SESSION_SECRET or POINTER_SESSION_SECRET required');
  }
  return new TextEncoder().encode(raw);
}

export type CreatorSessionPayload = {
  creatorId: string;
  discordId: string;
  discordUsername: string;
};

export async function signCreatorSession(payload: CreatorSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret());
}

export async function verifyCreatorSession(token: string): Promise<CreatorSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const creatorId = payload.creatorId;
    const discordId = payload.discordId;
    const discordUsername = payload.discordUsername;
    if (
      typeof creatorId !== 'string' ||
      typeof discordId !== 'string' ||
      typeof discordUsername !== 'string'
    ) {
      return null;
    }
    return { creatorId, discordId, discordUsername };
  } catch {
    return null;
  }
}

export async function readCreatorSessionFromCookies(): Promise<CreatorSessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(CREATOR_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyCreatorSession(token);
}

export function creatorSessionCookieOptions(token: string) {
  return {
    name: CREATOR_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE_SEC,
  };
}

export function clearCreatorSessionCookieOptions() {
  return {
    name: CREATOR_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
}

export function isCreatorAdmin(discordId: string): boolean {
  if (discordId === DEV_ADMIN_DISCORD_ID) return true;
  const raw = process.env.CREATOR_ADMIN_DISCORD_IDS?.trim() ?? '';
  if (!raw) return false;
  return raw.split(',').map((s) => s.trim()).includes(discordId);
}
