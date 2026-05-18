import { PortfolioDashboard } from '@/components/portfolio/PortfolioDashboard';

const VALID_TABS = ['spot', 'wallets', 'trackers'] as const;
type PortfolioTabParam = (typeof VALID_TABS)[number];

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; wallet?: string }>;
}) {
  const { tab, wallet } = await searchParams;
  const initialTab: PortfolioTabParam | undefined =
    tab && (VALID_TABS as readonly string[]).includes(tab)
      ? (tab as PortfolioTabParam)
      : undefined;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-bg-base px-1 py-1.5 sm:px-2">
      <PortfolioDashboard
        className="min-h-0 flex-1"
        initialTab={initialTab}
        prefillTrackerWallet={wallet}
      />
    </div>
  );
}
