import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SquadsHubShell } from '@/components/squads/SquadsHubShell';

export const metadata: Metadata = {
  description: 'Trusted operator rooms and trader discovery on Pointer',
};

export default function SquadsLayout({ children }: { children: ReactNode }) {
  return <SquadsHubShell>{children}</SquadsHubShell>;
}
