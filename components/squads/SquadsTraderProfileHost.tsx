'use client';

import { TraderProfileDrawer } from '@/components/squads/TraderProfileDrawer';
import { useSquadsUiStore } from '@/store/squadsUiStore';

export function SquadsTraderProfileHost() {
  const drawer = useSquadsUiStore((s) => s.drawer);
  const close = useSquadsUiStore((s) => s.closeTrader);

  return (
    <TraderProfileDrawer
      open={Boolean(drawer)}
      payload={drawer}
      onClose={close}
    />
  );
}
