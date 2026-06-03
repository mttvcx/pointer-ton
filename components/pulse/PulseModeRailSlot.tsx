'use client';

import { usePathname } from 'next/navigation';
import { PulseModeRail } from '@/components/pulse/PulseModeRail';

export function PulseModeRailSlot() {
  const pathname = usePathname();
  if (!pathname?.startsWith('/pulse')) return null;
  return <PulseModeRail />;
}
