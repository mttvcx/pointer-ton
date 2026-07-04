import { authToken } from '../auth';
import { api } from './client';

/**
 * Social graph + identity client. These consume the web backend's routes:
 *  - /api/me/pointer-identity (Redis-backed → live now, no migration)
 *  - /api/social/* (follow one-way + friends mutual → needs social-schema.sql)
 *  - /api/squads/* (needs squads-schema.sql)
 * All degrade gracefully: routes return `{ provisioned: false }` (or throw) until
 * their tables exist, and callers treat that as "not set up yet".
 */

/* ---------- Pointer identity (X handle, bio, etc.) ---------- */

export type PointerIdentity = {
  displayName?: string | null;
  bio?: string | null;
  xUsername?: string | null;
  telegramUsername?: string | null;
  farcasterUsername?: string | null;
  ethereumAddress?: string | null;
  privacy?: Record<string, boolean>;
  updatedAt?: number;
};

export async function getPointerIdentity(): Promise<PointerIdentity | null> {
  try {
    const r = await api<{ identity: PointerIdentity }>('/api/me/pointer-identity', { token: await authToken() });
    return r.identity ?? null;
  } catch {
    return null;
  }
}

/** Save the connected X handle onto the Pointer identity (get → patch → put). */
export async function saveXUsername(handle: string): Promise<void> {
  const clean = handle.replace(/^@/, '').trim();
  if (!clean) return;
  const current = (await getPointerIdentity()) ?? {};
  const next = { ...current, xUsername: clean };
  await api('/api/me/pointer-identity', { token: await authToken(), method: 'PUT', body: { identity: next } });
}

/* ---------- Follow (one-way) ---------- */

export type FollowTargetType = 'user' | 'wallet' | 'twitter';

export async function follow(targetType: FollowTargetType, targetRef: string): Promise<{ ok: boolean; provisioned?: boolean }> {
  return api('/api/social/follow', { token: await authToken(), method: 'POST', body: { targetType, targetRef } });
}
export async function unfollow(targetType: FollowTargetType, targetRef: string): Promise<{ ok: boolean }> {
  return api('/api/social/unfollow', { token: await authToken(), method: 'POST', body: { targetType, targetRef } });
}

export type FollowEdge = { targetType: FollowTargetType; targetRef: string; username?: string | null; walletAddress?: string | null; twitterHandle?: string | null; createdAt: string };

export async function getFollowing(): Promise<{ edges: FollowEdge[]; provisioned: boolean }> {
  try {
    const r = await api<{ following?: FollowEdge[]; edges?: FollowEdge[]; provisioned?: boolean }>('/api/social/following', { token: await authToken() });
    return { edges: r.following ?? r.edges ?? [], provisioned: r.provisioned !== false };
  } catch {
    return { edges: [], provisioned: false };
  }
}

/* ---------- Friends (mutual) ---------- */

export type FriendView = { userId: string; username: string | null; walletAddress: string | null; twitterHandle: string | null; since: string };
export type FriendRequestView = { requestId: string; userId: string; username: string | null; twitterHandle: string | null };

export async function sendFriendRequest(targetUserId: string): Promise<{ ok: boolean; status?: string }> {
  return api('/api/social/friend-request', { token: await authToken(), method: 'POST', body: { targetUserId } });
}
export async function respondFriendRequest(requestId: string, accept: boolean): Promise<{ ok: boolean }> {
  return api('/api/social/friend-respond', { token: await authToken(), method: 'POST', body: { requestId, accept } });
}
export async function getFriends(): Promise<{ friends: FriendView[]; provisioned: boolean }> {
  try {
    const r = await api<{ friends?: FriendView[]; provisioned?: boolean }>('/api/social/friends', { token: await authToken() });
    return { friends: r.friends ?? [], provisioned: r.provisioned !== false };
  } catch {
    return { friends: [], provisioned: false };
  }
}
export async function getFriendRequests(): Promise<{ requests: FriendRequestView[]; provisioned: boolean }> {
  try {
    const r = await api<{ requests?: FriendRequestView[]; provisioned?: boolean }>('/api/social/friend-requests', { token: await authToken() });
    return { requests: r.requests ?? [], provisioned: r.provisioned !== false };
  } catch {
    return { requests: [], provisioned: false };
  }
}

/* ---------- Squads ---------- */

export type SquadSummary = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  chainFocus?: string[];
  tradingStyles?: string[];
  visibility?: string;
  memberCount: number;
  isMember: boolean;
  createdAt?: string;
};

export async function getSquads(): Promise<{ squads: SquadSummary[]; provisioned: boolean }> {
  try {
    const r = await api<{ squads?: SquadSummary[]; provisioned?: boolean }>('/api/squads/list', { token: await authToken() });
    return { squads: r.squads ?? [], provisioned: r.provisioned !== false };
  } catch {
    return { squads: [], provisioned: false };
  }
}
export async function discoverSquads(): Promise<{ squads: SquadSummary[]; provisioned: boolean }> {
  try {
    const r = await api<{ squads?: SquadSummary[]; provisioned?: boolean }>('/api/squads/discover', { token: await authToken() });
    return { squads: r.squads ?? [], provisioned: r.provisioned !== false };
  } catch {
    return { squads: [], provisioned: false };
  }
}

export type CreateSquadInput = {
  name: string;
  description?: string;
  chainFocus: string[];
  tradingStyles: string[];
  visibility: string;
};

export async function createSquad(input: CreateSquadInput): Promise<{ squad?: SquadSummary }> {
  return api('/api/squads/create', {
    token: await authToken(),
    method: 'POST',
    body: { ...input, joinRequirements: {} },
  });
}
export async function joinSquad(id: string): Promise<{ ok: boolean }> {
  return api(`/api/squads/${id}/join`, { token: await authToken(), method: 'POST', body: {} });
}
export async function leaveSquad(id: string): Promise<{ ok: boolean }> {
  return api(`/api/squads/${id}/leave`, { token: await authToken(), method: 'POST', body: {} });
}
