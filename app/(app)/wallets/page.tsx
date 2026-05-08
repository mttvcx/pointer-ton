import type { Metadata } from 'next';
import { WalletsManage } from '@/components/wallets/WalletsManage';

export const metadata: Metadata = {
  title: 'Wallets',
};

export default function WalletsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#080d14] px-2 py-2 pb-[calc(var(--app-bottombar-h)+12px)]">
      <WalletsManage className="min-h-0 flex-1" />
    </div>
  );
}
