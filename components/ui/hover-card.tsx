'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import { cn } from '@/lib/utils/cn';

/** Invisible padding so the pointer can travel from trigger into the panel without closing. */
export function hoverCardBridgeClass(side: 'top' | 'right' | 'bottom' | 'left'): string {
  switch (side) {
    case 'bottom':
      return 'pt-3 -mt-3';
    case 'top':
      return 'pb-3 -mb-3';
    case 'right':
      return 'pl-3 -ml-3';
    case 'left':
      return 'pr-3 -mr-3';
  }
}

/**
 * Bridge padding overlaps the trigger via negative margin. The bridge shell is
 * pointer-events-none so clicks still reach the trigger anchor; only the panel
 * body receives pointer events for hover / scroll inside the card.
 */
export function HoverCardBridge({
  side,
  children,
}: {
  side: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
}) {
  return (
    <div className={cn(hoverCardBridgeClass(side), 'pointer-events-none')}>
      <div className="pointer-events-auto">{children}</div>
    </div>
  );
}

export const HOVER_CARD_POINTER_BRIDGE_MS = 400;

const HoverCard = HoverCardPrimitive.Root;
const HoverCardTrigger = HoverCardPrimitive.Trigger;
const HoverCardPortal = HoverCardPrimitive.Portal;

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content> & { instant?: boolean }
>(({ className, align = 'start', side = 'right', sideOffset = 8, instant = false, ...props }, ref) => (
  <HoverCardPrimitive.Portal>
    <HoverCardPrimitive.Content
      ref={ref}
      align={align}
      side={side}
      sideOffset={sideOffset}
      className={cn(
        // Sit above the sticky topbar (z-100) and any other app chrome.
        // The Radix portal already renders to <body> so this is the only
        // stacking layer that matters.
        'z-[400] outline-none',
        instant
          ? 'duration-0 animate-none data-[state=open]:animate-none data-[state=closed]:animate-none'
          : [
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            ],
        className,
      )}
      {...props}
    />
  </HoverCardPrimitive.Portal>
));
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName;

export { HoverCard, HoverCardTrigger, HoverCardContent, HoverCardPortal };
