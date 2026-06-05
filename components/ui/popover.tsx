'use client';

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { useOverlayPresence, POPOVER_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { popoverPanelClasses } from '@/lib/ui/overlayMotion';
import { cn } from '@/lib/utils/cn';

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
};

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error('Popover components must be used within Popover.Root');
  return ctx;
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

type RootProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

function Root({ open: openProp, onOpenChange, children }: RootProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const open = openProp ?? uncontrolledOpen;

  function setOpen(next: boolean) {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef }}>
      {children}
    </PopoverContext.Provider>
  );
}

type TriggerProps = {
  asChild?: boolean;
  children: ReactElement;
};

function Trigger({ asChild, children }: TriggerProps) {
  const { open, setOpen, triggerRef } = usePopoverContext();

  if (!isValidElement(children)) {
    throw new Error('Popover.Trigger expects a single React element child');
  }

  const child = children as ReactElement<{
    onClick?: (e: React.MouseEvent) => void;
    ref?: Ref<HTMLElement>;
  }>;

  const props = {
    ref: mergeRefs(child.props.ref, triggerRef),
    onClick: (e: React.MouseEvent) => {
      child.props.onClick?.(e);
      setOpen(!open);
    },
    'aria-haspopup': 'dialog' as const,
    'aria-expanded': open,
  };

  if (asChild) return cloneElement(child, props);
  return (
    <button type="button" {...props}>
      {child}
    </button>
  );
}

type ContentProps = {
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  /** Skip fade in/out — avoids double-animation feel on fast toggle (e.g. wallet chip). */
  disableAnimation?: boolean;
  className?: string;
  children: ReactNode;
};

function Content({
  align = 'end',
  sideOffset = 8,
  disableAnimation = false,
  className,
  children,
}: ContentProps) {
  const { open, setOpen, triggerRef } = usePopoverContext();
  const { mounted, visible } = useOverlayPresence(
    open,
    disableAnimation ? 0 : POPOVER_ANIM_CLOSE_MS,
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useLayoutEffect(() => {
    if (!mounted || !visible) return;

    function updatePosition() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      let right = Math.max(8, window.innerWidth - r.right);
      if (align === 'start') {
        right = Math.max(8, window.innerWidth - r.left - 280);
      } else if (align === 'center') {
        right = Math.max(8, window.innerWidth - (r.left + r.width / 2) - 140);
      }
      setPos({ top: r.bottom + sideOffset, right });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [mounted, visible, align, sideOffset, triggerRef]);

  useEffect(() => {
    if (!mounted) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (contentRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [mounted, setOpen, triggerRef]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={contentRef}
      role="dialog"
      className={cn(
        'fixed z-[200]',
        !disableAnimation && popoverPanelClasses(visible),
        disableAnimation && 'opacity-100',
        className,
      )}
      style={{ top: pos.top, right: pos.right }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Radix Popover–compatible primitives (align / sideOffset / portal). */
export const Popover = { Root, Trigger, Content };
