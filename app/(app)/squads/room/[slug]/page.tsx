import { SquadRoomMvp } from '@/components/squads/views/SquadRoomMvp';

export default async function SquadRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SquadRoomMvp slug={decodeURIComponent(slug)} />;
}
