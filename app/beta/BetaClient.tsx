'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { KeyRound, Loader2, LogIn } from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '@/lib/utils/constants';
import { cn } from '@/lib/utils/cn';

/** Interactive lanyard badge + pendulum; drag/hold to swing (Glyde-inspired). */
function BetaLanyardBadge() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const velRef = useRef(0);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const [, tick] = useState(0);

  useEffect(() => {
    let frame = 0;
    const run = () => {
      if (!draggingRef.current) {
        const g = 0.00115;
        const damp = 0.988;
        const acc = -g * Math.sin(angleRef.current);
        velRef.current = velRef.current * damp + acc;
        angleRef.current += velRef.current;
      }
      wrapRef.current?.style.setProperty('--tilt', `${angleRef.current}rad`);
      tick((n) => (n + 1) % 10_000);
      frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    lastXRef.current = e.clientX;
    velRef.current = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    angleRef.current += dx * 0.004;
    velRef.current += dx * 0.00035;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ok */
    }
  };

  return (
    <div className="relative z-20 flex flex-col items-center pt-[min(18vh,8rem)]">
      <div
        className="relative flex h-[220px] w-[2px] justify-center bg-gradient-to-b from-white/50 to-white/10"
        aria-hidden
      />
      <div
        ref={wrapRef}
        style={
          {
            transform: 'rotate(var(--tilt, 0rad))',
            transformOrigin: 'top center',
          } as React.CSSProperties
        }
        className="relative -mt-px flex flex-col items-center"
      >
        <div
          className="relative w-[min(88vw,280px)] cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className={cn(
              'relative overflow-hidden rounded-xl border border-white/15 bg-black/80 p-5 shadow-[0_0_60px_rgba(124,92,255,0.35)] backdrop-blur-md',
              'before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:opacity-90',
              'before:bg-[radial-gradient(120%_80%_at_15%_100%,rgba(255,60,172,0.45),rgba(124,92,255,0.25)_35%,transparent_65%)]',
            )}
          >
            <div className="relative z-10 flex flex-col items-center gap-3 text-center">
              <Image
                src="/branding/pointer-mark.png"
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 opacity-95"
                priority
              />
              <div>
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.35em] text-white/80">
                  {APP_NAME} pass
                </p>
                <p className="mt-1 text-[10px] text-white/50">Private beta / single-use invite</p>
              </div>
              <p className="tabular-nums text-[9px] uppercase tracking-widest text-fuchsia-200/90">
                Hold &amp; drag to swing
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BetaGateClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextSafe = sp.get('next')?.startsWith('/') && !sp.get('next')?.startsWith('//') ? sp.get('next')! : '/pulse';
  const { ready, authenticated, login, getAccessToken } = usePointerAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 50, y: 45 });

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const nx = (e.clientX / window.innerWidth) * 100;
      const ny = (e.clientY / window.innerHeight) * 100;
      setMouse({ x: nx, y: ny });
    }
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  async function onRedeem(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErr('Sign in first');
        return;
      }
      const res = await fetch('/api/beta/redeem', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof json === 'object' && json && 'message' in json
            ? String((json as { message: unknown }).message)
            : 'Could not redeem';
        setErr(msg);
        return;
      }
      router.replace(nextSafe);
      router.refresh();
    } catch {
      setErr('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060708] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{
          background: `radial-gradient(ellipse 80% 70% at ${mouse.x}% ${mouse.y}%, rgba(124,92,255,0.55), transparent 55%),
            radial-gradient(ellipse 50% 40% at 20% 80%, rgba(0,255,180,0.12), transparent 50%)`,
        }}
        aria-hidden
      />
      <header className="relative z-30 flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 opacity-90 transition hover:opacity-100">
          <Image src="/branding/pointer-mark.png" alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-sans text-sm tracking-tight">{APP_NAME}</span>
        </Link>
        <a
          href="#access"
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur transition hover:border-white/25 hover:text-white"
        >
          Get access
        </a>
      </header>

      <main className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 pb-28 pt-4">
        <h1 className="pointer-events-none relative z-0 -mb-6 max-w-[95vw] select-none text-center font-sans text-[clamp(2rem,8vw,3.25rem)] font-semibold leading-[0.95] tracking-tight text-white/[0.12]">
          The gateway to
          <span className="block bg-gradient-to-r from-violet-200/25 via-white/20 to-teal-200/20 bg-clip-text text-transparent">
            on-chain signal
          </span>
        </h1>

        <BetaLanyardBadge />

        <p className="relative z-20 mt-10 max-w-md text-center text-sm leading-relaxed text-white/55">
          {APP_TAGLINE}
        </p>

        <section id="access" className="relative z-20 mt-14 w-full max-w-sm scroll-mt-24 rounded-2xl border border-white/10 bg-black/50 p-5 backdrop-blur-md">
          <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
            <KeyRound className="h-3.5 w-3.5" />
            Beta access
          </div>

          {!ready ? (
            <div className="flex items-center gap-2 py-6 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : !authenticated ? (
            <div className="space-y-3">
              <p className="text-xs text-white/55">Sign in with Privy, then enter your single-use invite code.</p>
              <button
                type="button"
                onClick={() => void login()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#7C5CFF] py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(124,92,255,0.35)] transition hover:bg-[#8f72ff]"
              >
                <LogIn className="h-4 w-4" />
                Continue with Privy
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => void onRedeem(e)} className="space-y-3">
              <label className="block text-[10px] font-medium uppercase tracking-wide text-white/40">
                Invite code
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="PTR-XXXX-XXXX"
                autoComplete="off"
                className="w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2.5 tabular-nums text-sm text-white placeholder:text-white/25 focus:border-violet-400/50 focus:outline-none"
              />
              {err ? <p className="text-xs text-rose-300">{err}</p> : null}
              <button
                type="submit"
                disabled={busy || !code.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Enter app
              </button>
            </form>
          )}
        </section>
      </main>

      <footer className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-3">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/60 px-4 py-2 backdrop-blur-md">
          <Image src="/branding/pointer-mark.png" alt="" width={22} height={22} className="h-5 w-5 opacity-80" />
          <span className="text-[10px] tabular-nums uppercase tracking-widest text-white/35">Solana</span>
        </div>
        <button
          type="button"
          onClick={() => document.getElementById('access')?.scrollIntoView({ behavior: 'smooth' })}
          className="rounded-full bg-[#7C5CFF] px-8 py-2.5 text-sm font-semibold text-white shadow-[0_0_32px_rgba(124,92,255,0.45)] transition hover:bg-[#8f72ff]"
        >
          Get access
        </button>
      </footer>
    </div>
  );
}
