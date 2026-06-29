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
      showCard(target.anchor, <CardShell>Loading {target.entity.value.slice(0, 6)}…</CardShell>);
      const res = await pointer.token(target.entity.value);
      if (res.ok) {
        showCard(target.anchor, <TokenCard data={res.data as TokenIntel} />);
      } else if (res.error === 'not_connected') {
        showCard(
          target.anchor,
          <CardShell>
            <button onClick={() => void pointer.connect()} style={connectBtn}>
              Connect Pointer
            </button>
          </CardShell>,
        );
      } else {
        showCard(target.anchor, <CardShell>Unavailable</CardShell>);
      }
    }
  },
});

const connectBtn: React.CSSProperties = {
  width: '100%',
  padding: '8px 0',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 12,
  color: 'var(--bg-base)',
  background: 'var(--accent-glow)',
};

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-card" style={{ padding: 14, fontSize: 12.5, color: 'var(--fg-secondary)' }}>
      {children}
    </div>
  );
}
