import type { Metadata } from 'next';
import { SibylDashboard } from '@/components/sibyl/SibylDashboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sibyl — crypto intelligence engine',
  description: 'The AI that knows crypto: Solana memecoins, KOL wallets, narratives, on-chain markets.',
};

export default function SibylPage() {
  return <SibylDashboard />;
}
