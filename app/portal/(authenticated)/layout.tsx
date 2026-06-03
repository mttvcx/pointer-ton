import { redirect } from 'next/navigation';
import { readCreatorSessionFromCookies, isCreatorAdmin } from '@/lib/creators/session';
import { getCreatorById } from '@/lib/db/creators';
import { CreatorPortalShell } from '@/components/creators/CreatorPortalShell';

export default async function PortalAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readCreatorSessionFromCookies();
  if (!session) redirect('/portal');

  const creator = await getCreatorById(session.creatorId);
  if (!creator || creator.status === 'blacklisted') redirect('/portal?error=blacklisted');

  const username = creator.discord_global_name ?? creator.discord_username;

  return (
    <CreatorPortalShell username={username} avatar={creator.discord_avatar} isAdmin={isCreatorAdmin(session.discordId)}>
      {children}
    </CreatorPortalShell>
  );
}
