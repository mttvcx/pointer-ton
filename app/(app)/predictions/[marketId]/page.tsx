import { PredictionsDetailDesk } from '@/components/predictions/PredictionsDesk';

export default async function PredictionMarketPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PredictionsDetailDesk marketId={marketId} />
    </div>
  );
}
