import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EntityLocker } from '@/components/ai/EntityLocker';
import { StockDetailView } from '@/components/stocks/StockDetailView';
import { getMockMarketBySymbol } from '@/lib/stocks/mockStocks';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const key = decodeURIComponent(symbol).trim().toUpperCase();
  const market = getMockMarketBySymbol(key);
  const label = market?.symbol ?? key;
  return {
    title: `${label} | Pointer`,
    description: `Trade ${label} perp on Pointer`,
  };
}

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const key = decodeURIComponent(symbol).trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.]{0,15}$/.test(key)) {
    notFound();
  }

  const market = getMockMarketBySymbol(key);
  if (!market) {
    notFound();
  }

  return (
    <>
      <EntityLocker type="token" id={key} label={market.symbol} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto xl:overflow-hidden">
        <Suspense
          fallback={<div className="min-h-[40vh] animate-pulse bg-bg-elevated/15" aria-hidden />}
        >
          <StockDetailView market={market} />
        </Suspense>
      </div>
    </>
  );
}
