import { NextResponse, type NextRequest } from 'next/server';
import {
  getCreatorById,
  isDiscordBlacklisted,
} from '@/lib/db/creators';
import {
  readCreatorSessionFromCookies,
  type CreatorSessionPayload,
} from '@/lib/creators/session';

export type CreatorAuthSuccess = { session: CreatorSessionPayload; creator: Awaited<ReturnType<typeof getCreatorById>> };

export async function requireCreator(
  req: NextRequest,
): Promise<CreatorAuthSuccess | { error: NextResponse }> {
  const session = await readCreatorSessionFromCookies();
  if (!session) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }

  if (await isDiscordBlacklisted(session.discordId)) {
    return { error: NextResponse.json({ error: 'blacklisted' }, { status: 403 }) };
  }

  const creator = await getCreatorById(session.creatorId);
  if (!creator || creator.status === 'blacklisted') {
    return { error: NextResponse.json({ error: 'blacklisted' }, { status: 403 }) };
  }
  if (creator.status === 'suspended') {
    return { error: NextResponse.json({ error: 'suspended' }, { status: 403 }) };
  }

  return { session, creator };
}
