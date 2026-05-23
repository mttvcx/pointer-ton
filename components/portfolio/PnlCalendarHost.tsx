'use client';



import { PnlCalendarModal } from '@/components/portfolio/PnlCalendarModal';

import { usePnlCalendarStore } from '@/store/pnlCalendar';



/** App-shell host so the calendar portal always paints above dock / copilot layers. */

export function PnlCalendarHost() {

  const open = usePnlCalendarStore((s) => s.open);

  const closedSells = usePnlCalendarStore((s) => s.closedSells);

  const trades = usePnlCalendarStore((s) => s.trades);

  const solUsd = usePnlCalendarStore((s) => s.solUsd);

  const usdMode = usePnlCalendarStore((s) => s.usdMode);

  const close = usePnlCalendarStore((s) => s.close);



  return (

    <PnlCalendarModal

      open={open}

      onClose={close}

      closedSells={closedSells}

      trades={trades}

      solUsd={solUsd}

      usdMode={usdMode}

    />

  );

}

