import { PortfolioPageClient } from './PortfolioPageClient';

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
    <PortfolioPageClient initialTab={initialTab} prefillTrackerWallet={wallet} />
  );
}
