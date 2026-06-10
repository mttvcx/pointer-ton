'use client';

import { useUIStore } from '@/store/ui';
import { LandingSignInModal } from '@/components/auth/LandingSignInModal';

/** App-wide Pointer sign-in overlay — Google/X open in a popup, not a full-page redirect. */
export function PointerSignInHost() {
  const open = useUIStore((s) => s.signInModalOpen);
  const setOpen = useUIStore((s) => s.setSignInModalOpen);
  return <LandingSignInModal open={open} onClose={() => setOpen(false)} />;
}
