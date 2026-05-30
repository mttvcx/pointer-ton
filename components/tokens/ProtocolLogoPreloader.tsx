'use client';

import { useEffect } from 'react';
import { warmPulseProtocolLogos } from '@/lib/tokens/protocolPreload';

export function ProtocolLogoPreloader() {
  useEffect(() => {
    const run = () => warmPulseProtocolLogos();
    const id = requestAnimationFrame(run);
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}
