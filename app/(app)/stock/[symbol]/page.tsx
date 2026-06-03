import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EntityLocker } from '@/components/ai/EntityLocker';
import { StockDetailView } from '@/components/stocks/StockDetailView';
import { StockHeader } from '@/components/stocks/StockHeader';
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
    description: `Trade ${label} on Pointer`,
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-auto bg-bg-raised [-ms-overflow-style:auto] [scrollbar-gutter:stable]">
          <div className="shrink-0 bg-bg-raised">
            <StockHeader market={market} />
          </div>

          <Suspense
            fallback={<div className="min-h-[40vh] animate-pulse bg-bg-elevated/15" aria-hidden />}
          >
            <StockDetailView market={market} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
