import { redirect } from 'next/navigation';

export default async function WalletsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ wallet?: string }>;
}) {
  const { wallet } = await searchParams;
  const qs = wallet
    ? `?tab=trackers&wallet=${encodeURIComponent(wallet)}`
    : '?tab=trackers';
  redirect(`/portfolio${qs}`);
}
