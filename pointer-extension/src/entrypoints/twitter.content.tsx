import { twitterAdapter } from '@/adapters/twitter';
import type { HoverTarget } from '@/adapters/types';
import { pointer } from '@/pointer/client';
import type { TokenIntel } from '@/pointer/types';
import { TokenCard } from '@/ui/cards/TokenCard';
import { showCard, scheduleHideCard } from '@/ui/cardHost';

/**
 * Twitter/X content script. Flagship slice: a contract address in a tweet → hover →
 * real Pointer token card (live `/api/ext/token/[mint]`). Idle-scheduled scan (never
 * blocks scroll), 50ms hover-intent, closed-Shadow-DOM React card. Profile + wallet
 * hovers land in Phase 3/4 (their endpoints already exist).
 */
export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'manual',
  main() {
    const HOVER_INTENT_MS = 50;
    let hoverTimer: number | undefined;

    const scan = () => {
      for (const t of twitterAdapter.scan(document.body)) bindHover(t);
    };
    const schedule = () =>
      (window.requestIdleCallback ?? window.setTimeout)(() => scan(), { timeout: 500 } as never);

    schedule();
    let debounce: number | undefined;
    new MutationObserver(() => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(schedule, 250);
    }).observe(document.body, { childList: true, subtree: true });

    function bindHover(target: HoverTarget) {
      // Only token/CA entities have a live card today; profiles are Phase 3.
      if (target.entity.kind !== 'token' && target.entity.kind !== 'evm') return;
      target.anchor.addEventListener('pointerenter', () => {
        hoverTimer = window.setTimeout(() => openToken(target), HOVER_INTENT_MS);
      });
      target.anchor.addEventListener('pointerleave', () => {
        window.clearTimeout(hoverTimer);
        scheduleHideCard();
      });
    }

    async function openToken(target: HoverTarget) {
      showCard(target.anchor, <LoadingCard />);
      const res = await pointer.token(target.entity.value);
      if (res.ok) {
        showCard(target.anchor, <TokenCard data={res.data as TokenIntel} />);
      } else if (needsConnect(res.error)) {
        // No scoped token yet, or the service worker was waking — either way the
        // user just needs to connect. Show a clean prompt, never a dead end.
        showCard(target.anchor, <ConnectCard />);
      } else {
        showCard(target.anchor, <ConnectCard note="Couldn't load — retry, or open the popup." />);
      }
    }
  },
});

/** Treat "no token" and transient SW-wake/messaging failures as "please connect". */
function needsConnect(error?: string): boolean {
  if (!error) return true;
  return /not_connected|connect|receiving end|extension_unavailable|message channel/i.test(error);
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-card" style={{ padding: 14, fontSize: 12.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <div style={brandDot}>P</div>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg-primary)' }}>Pointer</span>
      </div>
      {children}
    </div>
  );
}

function LoadingCard() {
  return (
    <CardShell>
      <div style={{ color: 'var(--fg-muted)' }}>Loading intelligence…</div>
    </CardShell>
  );
}

function ConnectCard({ note }: { note?: string }) {
  return (
    <CardShell>
      <p style={{ color: 'var(--fg-muted)', margin: '0 0 10px' }}>
        {note ?? 'Connect Pointer to see token intelligence as you browse.'}
      </p>
      <button onClick={() => void pointer.connect()} style={connectBtn}>
        Connect Pointer
      </button>
    </CardShell>
  );
}

const brandDot: React.CSSProperties = {
  width: 18, height: 18, borderRadius: 5, background: 'var(--fg-primary)',
  display: 'grid', placeItems: 'center', color: 'var(--bg-base)', fontWeight: 800, fontSize: 11,
};
const connectBtn: React.CSSProperties = {
  width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontWeight: 700, fontSize: 12, color: 'var(--bg-base)', background: 'var(--accent-glow)',
};
