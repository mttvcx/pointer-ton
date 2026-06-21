'use client';

import { useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';

export function SharePnlCardButton({
  tradeId,
  displayRealizedPnlSol,
  displayRealizedPnlUsd,
  onSuccess,
  className,
}: {
  tradeId: string;
  displayRealizedPnlSol: number;
  displayRealizedPnlUsd: number;
  onSuccess?: () => void;
  className?: string;
}) {
  const { getAccessToken } = usePointerAuth();
  const [busy, setBusy] = useState(false);

  async function onShare() {
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error('Sign in required');
        return;
      }
      const res = await fetch('/api/pnl-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tradeId,
          backgroundType: 'plain',
          displayRealizedPnlSol,
          displayRealizedPnlUsd,
        }),
      });
      const j: unknown = await res.json();
      if (!res.ok) {
        console.error('[SharePnlCardButton] create share card failed', j);
        toast.error('Couldn’t create share card — please try again');
        return;
      }
      const path =
        typeof j === 'object' && j && 'path' in j && typeof (j as { path: unknown }).path === 'string'
          ? (j as { path: string }).path
          : null;
      if (!path) {
        toast.error('Invalid response');
        return;
      }
      const url = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied');
      onSuccess?.();
    } catch {
      toast.error('Could not create share card');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onShare()}
      title="Copy PnL share link"
      className={cn(
        'inline-flex items-center gap-1 rounded border border-border-subtle px-1.5 py-0.5 text-[10px] font-medium text-fg-muted transition hover:border-border-default hover:text-accent-primary disabled:opacity-50',
        className,
      )}
    >
      <Share2 className="h-3 w-3" />
      {busy ? '...' : 'Share'}
    </button>
  );
}
