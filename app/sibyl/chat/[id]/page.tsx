import type { Metadata } from 'next';
import { SibylDashboard } from '@/components/sibyl/SibylDashboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Harve — crypto intelligence engine',
};

export default async function SibylChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SibylDashboard initialChatId={id} />;
}
