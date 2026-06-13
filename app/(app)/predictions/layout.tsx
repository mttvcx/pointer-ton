import { PredictionsTourHost } from '@/components/predictions/PredictionsTourHost';

export default function PredictionsLayout({ children }: { children: React.ReactNode }) {
  return <PredictionsTourHost>{children}</PredictionsTourHost>;
}
