'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Portal overlays to `document.body` so `position:fixed` isn't trapped by ancestor transforms. */
export function usePortalToBody() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

export function PortalToBody({ children }: { children: ReactNode }) {
  const ready = usePortalToBody();
  if (!ready) return null;
  return createPortal(children, document.body);
}
