'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { Bell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function WebPushControls({ className }: { className?: string }) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    // Push / Notification APIs are only defined in the browser; sync after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client-only feature detect
    setSupported(
      typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window,
    );
  }, []);

  useEffect(() => {
    if (!authenticated || !supported) return;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        await reg.update();
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(Boolean(sub));
      } catch {
        /* ignore */
      }
    })();
  }, [authenticated, supported]);

  const subscribe = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      toast.error('Sign in required');
      return;
    }

    const keyRes = await fetch('/api/push/vapid-public-key');
    if (!keyRes.ok) {
      toast.error('Push is not configured on this server');
      return;
    }
    const { publicKey } = (await keyRes.json()) as { publicKey: string };

    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        toast.error('Notification permission denied');
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const j = sub.toJSON();
      if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) {
        toast.error('Invalid subscription');
        return;
      }

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: j.endpoint,
          keys: { p256dh: j.keys.p256dh, auth: j.keys.auth },
        }),
      });

      if (!res.ok) {
        toast.error('Failed to save subscription');
        return;
      }

      setSubscribed(true);
      toast.success('Browser alerts enabled');
    } catch {
      toast.error('Could not enable push');
    } finally {
      setBusy(false);
    }
  }, [getAccessToken]);

  const unsubscribe = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      const endpoint = sub?.endpoint;
      if (sub) await sub.unsubscribe();
      if (endpoint) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ endpoint }),
        });
      }
      setSubscribed(false);
      toast.success('Browser alerts off');
    } catch {
      toast.error('Could not disable push');
    } finally {
      setBusy(false);
    }
  }, [getAccessToken]);

  if (!authenticated || !supported) return null;

  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    return (
      <span
        className={cn('hidden text-[10px] text-fg-muted lg:inline', className)}
        title="Unblock notifications in browser settings"
      >
        Push blocked
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void (subscribed ? unsubscribe() : subscribe())}
      className={cn(
        'focus-ring flex h-8 items-center gap-1 rounded-md border border-border-subtle px-2 text-[11px] font-medium transition-all duration-150 lg:px-2.5',
        subscribed
          ? 'border-signal-bull/30 text-signal-bull hover:border-signal-bull/50'
          : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary',
        className,
      )}
      title={
        subscribed
          ? 'Disable browser push (limit orders & tracker alerts)'
          : 'Enable browser push for alerts'
      }
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : <Bell className="h-3.5 w-3.5 shrink-0" />}
      <span className="hidden lg:inline">{subscribed ? 'Push on' : 'Push'}</span>
    </button>
  );
}
