import type { Metadata } from 'next';
import { PortfolioDashboard } from '@/components/portfolio/PortfolioDashboard';

export const metadata: Metadata = {
  title: 'Portfolio',
};

export default function PortfolioPage() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#080d14] px-1 py-1.5 sm:px-2">
      <PortfolioDashboard className="min-h-0 flex-1" />
    </div>
  );
}
