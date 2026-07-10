import { twitterAdapter } from '@/adapters/twitter';
import type { HoverTarget } from '@/adapters/types';
import { pointer } from '@/pointer/client';
import type { TokenIntel, WalletIntel } from '@/pointer/types';
import { TokenCard } from '@/ui/cards/TokenCard';
import { WalletCard } from '@/ui/cards/WalletCard';
import { showCard, scheduleHideCard } from '@/ui/cardHost';
import { startTwitterLabels } from '@/lib/twitterLabels';
import { startTwitterHoverCard } from '@/lib/twitterHoverCard';
import { startTwitterRightRail, startTwitterProfileInline } from '@/lib/twitterRightRail';
import { startPnlRing } from '@/lib/pnlRing';

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

    const PROFILE_RE = /^\/([A-Za-z0-9_]{1,15})\/?$/;
    const RESERVED = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search', 'compose']);
    const seenCas = new Set<string>(); // `${handle}:${mint}` — submit each once per session

    const FOLLOWERS_RE = /^\/([A-Za-z0-9_]{1,15})\/(followers|followers_you_follow|verified_followers)\/?$/;
    const seenFollowers = new Set<string>(); // `${handle}:${follower}`

    const scan = () => {
      const targets = Array.from(twitterAdapter.scan(document.body));
      for (const t of targets) bindHover(t);
      captureCas(targets);
      captureFollowers();
      captureProfileFollowers();
      captureProfileMeta();
    };

    // #1 — auto smart followers: on a profile, X shows "Followed by A, B, and N
    // others you follow". Capture those named mutuals + submit as this handle's
    // followers; the server keeps the known KOLs. Fills without visiting /followers.
    const seenProfileFollowers = new Set<string>();
    function captureProfileFollowers() {
      const m = PROFILE_RE.exec(location.pathname);
      const handle = m?.[1]?.toLowerCase();
      if (!handle || RESERVED.has(handle) || seenProfileFollowers.has(handle)) return;
      if (!document.querySelector('[data-testid="UserName"]')) return; // header not ready — retry
      seenProfileFollowers.add(handle);
      const link = document.querySelector<HTMLAnchorElement>(`a[href="/${handle}/followers_you_follow"]`);
      if (!link) return; // no "you follow" mutuals shown
      let box: HTMLElement = link;
      for (let i = 0; i < 4 && box.parentElement; i++) box = box.parentElement;
      const fresh: { handle: string; avatar?: string }[] = [];
      const seen = new Set<string>();
      for (const a of Array.from(box.querySelectorAll<HTMLAnchorElement>('a[href^="/"]'))) {
        const hm = /^\/([A-Za-z0-9_]{1,15})$/.exec(a.getAttribute('href') ?? '');
        const fh = hm?.[1]?.toLowerCase();
        if (!fh || fh === handle || RESERVED.has(fh) || seen.has(fh)) continue;
        seen.add(fh);
        const img = a.querySelector<HTMLImageElement>('img[src*="twimg.com"]');
        fresh.push({ handle: fh, avatar: img?.src });
      }
      if (fresh.length) void pointer.submitFollowers(handle, fresh);
    }

    // AI auto-labeler: on a profile page, send the account's public name + bio so
    // Claude can label what they do (any domain — many "key followers" aren't crypto).
    // Fires once per handle per session; the server dedups + only classifies once ever.
    const seenMeta = new Set<string>();
    function captureProfileMeta() {
      const m = PROFILE_RE.exec(location.pathname);
      const handle = m?.[1]?.toLowerCase();
      if (!handle || RESERVED.has(handle) || seenMeta.has(handle)) return;
      const nameEl = document.querySelector<HTMLElement>('[data-testid="UserName"]');
      const bioEl = document.querySelector<HTMLElement>('[data-testid="UserDescription"]');
      if (!nameEl || !bioEl) return; // wait until the header + bio have rendered
      seenMeta.add(handle);
      const name = (nameEl.querySelector('span')?.textContent ?? '').trim();
      const bio = (bioEl.textContent ?? '').trim();
      if (!bio) return;
      void pointer.aiLabel({ handle, name, bio });
    }

    // Smart followers: on a handle's followers page, submit the @handles X rendered;
    // the server keeps the ones that are known KOLs. Built from public X data.
    function captureFollowers() {
      const m = FOLLOWERS_RE.exec(location.pathname);
      const handle = m?.[1]?.toLowerCase();
      if (!handle) return;
      const fresh: { handle: string; avatar?: string }[] = [];
      for (const c of Array.from(document.querySelectorAll<HTMLElement>('[data-testid="UserCell"]'))) {
        let fh = '';
        for (const s of Array.from(c.querySelectorAll<HTMLElement>('span'))) {
          const hm = /^@([A-Za-z0-9_]{1,15})$/.exec((s.textContent ?? '').trim());
          if (hm?.[1]) {
            fh = hm[1].toLowerCase();
            break;
          }
        }
        if (!fh) continue;
        const key = `${handle}:${fh}`;
        if (seenFollowers.has(key)) continue;
        seenFollowers.add(key);
        const img = c.querySelector<HTMLImageElement>('img[src*="twimg.com"]');
        fresh.push({ handle: fh, avatar: img?.src });
      }
      if (fresh.length) void pointer.submitFollowers(handle, fresh);
    }

    // CA history: when viewing a profile, record the contract addresses in that
    // account's tweets — Pointer's own dataset, built from what we already detect.
    function captureCas(targets: HoverTarget[]) {
      const m = PROFILE_RE.exec(location.pathname);
      const handle = m?.[1]?.toLowerCase();
      if (!handle || RESERVED.has(handle)) return;
      const fresh: { mint: string }[] = [];
      for (const t of targets) {
        if (t.entity.kind !== 'token') continue;
        const key = `${handle}:${t.entity.value}`;
        if (seenCas.has(key)) continue;
        seenCas.add(key);
        fresh.push({ mint: t.entity.value });
      }
      if (fresh.length) void pointer.submitCas(handle, fresh);
    }
    const schedule = () =>
      (window.requestIdleCallback ?? window.setTimeout)(() => scan(), { timeout: 500 } as never);

    schedule();
    let debounce: number | undefined;
    new MutationObserver(() => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(schedule, 250);
    }).observe(document.body, { childList: true, subtree: true });

    // Universal label badges (KOL directory + the user's own) stamped on profiles.
    startTwitterLabels();
    // Pointer panel injected INTO Twitter's native hover card (Ethos-style).
    startTwitterHoverCard();
    // Right-rail Pointer card on profile pages.
    startTwitterRightRail();
    // Same card in the MAIN column under the bio (FrontRun's spot).
    startTwitterProfileInline();
    // Ethos-style PnL ring around the profile avatar.
    startPnlRing();

    function bindHover(target: HoverTarget) {
      const k = target.entity.kind;
      // Every on-chain address gets a card: token / EVM / ambiguous / wallet.
      if (k !== 'token' && k !== 'evm' && k !== 'unknown' && k !== 'wallet') return;
      target.anchor.addEventListener('pointerenter', () => {
        hoverTimer = window.setTimeout(() => openEntity(target), HOVER_INTENT_MS);
      });
      target.anchor.addEventListener('pointerleave', () => {
        window.clearTimeout(hoverTimer);
        scheduleHideCard();
      });
    }

    async function openEntity(target: HoverTarget) {
      const { anchor, entity } = target;
      showCard(anchor, <LoadingCard />);
      // Known wallet → wallet card straight away.
      if (entity.kind === 'wallet') {
        await openWallet(anchor, entity.value);
        return;
      }
      // token / EVM / ambiguous → resolve as a token; if the backend says it's not
      // a token (no market anywhere), it's a wallet — fall back cleanly.
      const res = await pointer.token(entity.value);
      if (res.ok) {
        const data = res.data as TokenIntel & { notToken?: boolean };
        if (data.notToken) {
          await openWallet(anchor, entity.value);
          return;
        }
        showCard(anchor, <TokenCard data={data} />);
      } else if (needsConnect(res.error)) {
        showCard(anchor, <ConnectCard />);
      } else {
        showCard(anchor, <ConnectCard note="Couldn't load — retry, or open the popup." />);
      }
    }

    async function openWallet(anchor: HTMLElement, address: string) {
      const res = await pointer.wallet(address);
      if (res.ok) {
        showCard(anchor, <WalletCard data={res.data as WalletIntel} />);
      } else if (needsConnect(res.error)) {
        showCard(anchor, <ConnectCard />);
      } else {
        showCard(anchor, <ConnectCard note="Couldn't load — retry, or open the popup." />);
      }
    }
  },
});

/** Treat "no token" and transient SW-wake/messaging failures as "please connect". */
function needsConnect(error?: string): boolean {
  if (!error) return true;
  return /not_connected|connect|receiving end|extension_unavailable|message channel/i.test(error);
}

const LOGO_URL = chrome.runtime.getURL('pointer-bird.png');

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-card" style={{ padding: 14, fontSize: 12.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <img src={LOGO_URL} alt="" width={16} height={16} style={{ objectFit: 'contain' }} />
        <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '-0.02em', color: 'var(--fg-primary)' }}>
          pointer
        </span>
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

const connectBtn: React.CSSProperties = {
  width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontWeight: 700, fontSize: 12, color: 'var(--bg-base)', background: 'var(--accent-glow)',
};
