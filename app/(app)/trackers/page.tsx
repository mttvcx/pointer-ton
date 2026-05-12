import { redirect } from 'next/navigation';

export default async function TrackersPage({
  searchParams,
}: {
  searchParams: Promise<{ wallet?: string }>;
}) {
  const { wallet } = await searchParams;
  redirect(wallet ? `/wallets?wallet=${encodeURIComponent(wallet)}` : '/track');
}
