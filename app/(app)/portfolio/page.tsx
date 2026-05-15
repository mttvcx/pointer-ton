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
    <div className="flex w-full min-w-0 flex-1 flex-col bg-[#080d14] px-1 py-1.5 sm:px-2">
      <PortfolioDashboard
        initialTab={initialTab}
        prefillTrackerWallet={wallet}
      />
    </div>
  );
}
