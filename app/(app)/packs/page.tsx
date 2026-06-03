import type { Metadata } from 'next';
import { PacksTerminal } from '@/components/packs/PacksTerminal';

export const metadata: Metadata = {
  title: 'Packs',
  description: 'Pointer Packs — tiered pack openings with transparent odds',
};

export default function PacksPage() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--app-topbar-h)-var(--app-bottombar-h))] min-h-0 flex-col bg-bg-base">
      <PacksTerminal className="min-h-0 flex-1" />
    </div>
  );
}
