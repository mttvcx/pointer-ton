# Pointer Extension — Architecture & Build Plan

The official, first-party Pointer browser extension. Not an overlay, not a fork —
a natural extension of Pointer that makes browsing crypto without it feel
incomplete. This document is the foundation: the decisions, the structure, and the
phased plan. Read before adding code.

> **North star:** invisible until needed · <80ms overlay · Apple-level polish ·
> reuse Pointer's session, design system, and API · never fake a finding.

---

## 1. Foundational decisions (CTO calls — override early if needed)

| Decision | Choice | Why |
| --- | --- | --- |
| **Build framework** | **WXT** (wxt.dev) + React + TypeScript + Tailwind | The modern MV3 framework: manifest gen, content-script HMR, cross-browser, code-split entrypoints. Fastest path to a polished, fast extension. |
| **Repo location** | `pointer-extension/` subfolder in the pointer-ton repo, on `feat/pointer-extension` | First-party. Reuses Pointer's design tokens + API response types directly. Isolated by its own `package.json` + `tsconfig`; **excluded from the Next build** so the two never collide. |
| **Styling** | Tailwind with Pointer's exact CSS-variable tokens (`--bg-base`, `--fg-primary`, `--accent-primary`, `--signal-*`), Shadow-DOM-scoped | One design system. The overlay inherits Pointer's look and any custom theme, with zero leakage to/from the host page. |
| **Isolation** | Every injected surface renders in a **closed Shadow DOM** | Host CSS can't bleed in; our CSS can't bleed out; XSS surface minimized. |
| **Auth** | **Scoped, revocable extension token** issued by Pointer (not the raw Privy bearer) | Addresses the readiness audit's auth-handoff + revocation blockers. The extension never holds the user's full session; the token is per-install, scoped to read-intel + trade-intent, and revocable from pointer.trade. |
| **AI** | Frontend is backend-agnostic — calls `POST /api/ext/ai/summarize` (streams). Claude today, Pointer-7 later, no client change | Matches the existing cascade gate (≥5 SOL OR subscription); the extension is just another caller. |
| **Data** | The extension **consumes** existing Pointer endpoints (wallet analytics, token data, InsightX, Ethos, identity). New `/api/ext/*` facade adds CORS + the scoped-token guard + ext-shaped responses | No duplicated DB, no duplicated logic. The facade is thin. |

---

## 2. The two codebases this touches

1. **`pointer-extension/`** (this folder) — the MV3 extension (content scripts, background, overlay UI).
2. **`pointer-ton` API** — a new **`/api/ext/*` facade**: CORS for `chrome-extension://<id>` (the `POINTER_EXTENSION_ORIGINS` allowlist already exists in `proxy.ts`), the scoped-token mint/verify/revoke, per-token rate limiting, and ext-shaped read endpoints that wrap the intelligence the app already computes.

The extension must NOT call internal app routes directly — only `/api/ext/*`. That keeps the surface auditable and rate-limited.

---

## 3. Directory structure

```
pointer-extension/
  ARCHITECTURE.md            ← this file
  package.json               ← WXT + React + Tailwind
  wxt.config.ts              ← manifest, permissions, content-script matches
  tsconfig.json
  src/
    entrypoints/
      background.ts          ← service worker: auth, fetch broker, cache, prefetch
      <site>.content.ts      ← one content script per supported site (adapters)
      popup/                 ← toolbar popup (status, connect, settings)
    adapters/                ← per-site DOM adapters (the extensibility seam)
      types.ts               ← SiteAdapter interface
      twitter.ts  dexscreener.ts  solscan.ts  pumpfun.ts  gmgn.ts
      axiom.ts    photon.ts  bullx.ts  github.ts  genericProject.ts
    pointer/
      client.ts              ← the ONLY way to reach Pointer (/api/ext/*)
      auth.ts                ← scoped-token handshake + storage + revocation
      cache.ts               ← tiered cache (memory → chrome.storage) + TTLs
      types.ts               ← shared response types (mirrors /api/ext shapes)
    ui/
      theme.css              ← Pointer design tokens (the bridge)
      ShadowHost.tsx         ← closed-shadow-DOM mount + theme injection
      cards/                 ← ProfileCard, TokenCard, WalletCard, ProjectScan
      primitives/            ← Card, Stat, Badge, Streamed text, Skeleton
    lib/
      detect.ts              ← entity detection (CA, wallet, handle) — deterministic
      perf.ts                ← timing budget guards, idle scheduling
      sanitize.ts            ← never trust host HTML; strip before AI/display
```

---

## 4. The adapter pattern (extensibility)

New sites must be cheap to add. Every site is a `SiteAdapter`:

```ts
interface SiteAdapter {
  id: string;                       // 'twitter' | 'dexscreener' | …
  matches: string[];                // host globs
  // Find entities already in the DOM (deterministic, no network).
  scan(root: ParentNode): DetectedEntity[];   // {kind:'token'|'wallet'|'profile', value, anchorEl}
  // Where/how to attach a hover trigger for an entity.
  decorate(entity: DetectedEntity): HoverTarget | null;
  // Optional: a site-level action (e.g. "Analyze with Pointer" on a project site).
  pageAction?(): PageAction | null;
}
```

V1 ships: twitter, dexscreener, solscan, pumpfun, gmgn, axiom, photon, bullx,
github, genericProject. Adding a site = one file + a manifest match.

---

## 5. Performance contract (non-negotiable)

| Surface | Budget | Strategy |
| --- | --- | --- |
| Overlay open | <80ms | Pre-mounted shadow host; render skeleton instantly, hydrate from cache/network |
| Hover card | <120ms | 50ms hover intent → cache-first; network only on miss |
| Cached response | <50ms | Memory LRU in the content script + `chrome.storage` mirror |
| AI quick summary | 0.3–0.6s | Stream from `/api/ext/ai/summarize`; show first token ASAP |

Rules: never block scroll (all DOM scans in `requestIdleCallback`, `IntersectionObserver` for visibility), virtualize any list >50 rows, lazy-load every card bundle, debounce/coalesce identical in-flight requests, prefetch on hover-intent for likely-next entities.

---

## 6. Security (every item is a requirement)

- **No arbitrary script execution. No `eval`. No `new Function`.** Strict MV3 CSP.
- **Closed Shadow DOM** for all injected UI; host page can't read or style it.
- **Never trust host HTML** — `sanitize.ts` strips/normalizes any scraped text before it's displayed or sent to AI. The page is data, not instructions.
- **Prompt-injection defense** — scraped content is fenced + labeled untrusted before hitting `/api/ext/ai/*` (reuse Pointer's `promptSanitize` posture server-side).
- **Read-only by default.** The only write actions are explicit, user-initiated trade intents that open Pointer — the extension never signs.
- **Token scope** — the extension token can read intelligence + create a trade-intent deeplink; it cannot move funds, change settings, or read another user's data. Revocable from pointer.trade. Short TTL + silent refresh.
- **Minimal permissions** — `activeTab`/`scripting` over broad host permissions where possible; request per-site.

---

## 7. Auth handshake (the critical Phase-1 bridge)

1. User clicks **Connect** in the popup → opens `pointer.trade/extension/connect` (already-logged-in session).
2. User approves → Pointer mints a **scoped extension token** (`ext_…`, JWT, short TTL + refresh), tied to this `chrome-extension://<id>`, scope `intel.read trade.intent`.
3. Token returned to the extension via a one-time code exchange (not URL params) → stored in `chrome.storage.session`.
4. Background attaches it to every `/api/ext/*` call. Silent refresh before expiry.
5. **Revocation:** pointer.trade lists connected extensions; revoke kills the token server-side (a `ext_revocations` check, mirroring the existing `lib/auth/revocation`).

State that syncs (read): subscription, AI credits, SOL balance, monthly volume, labels, watchlists, alerts, notes, AI history — all from `/api/ext/me` + topic endpoints.

---

## 8. Phased plan

- **Phase 0 — Foundation (this commit).** Structure, WXT scaffold, design-token bridge, adapter interface, Pointer client + auth design, one proving slice (Twitter CA/profile hover skeleton). Root Next build untouched.
- **Phase 1 — Auth bridge + API facade.** `/api/ext/*` in pointer-ton: CORS confirm, scoped-token mint/verify/revoke, rate-limit, `/api/ext/me`. Extension connect flow end-to-end.
- **Phase 2 — Token/CA hover.** The flagship: detect any CA → chart, liquidity, holders, bundlers/snipers, smart money, creator history, AI summary, Quick-Buy→Pointer. Reuses InsightX + token endpoints.
- **Phase 3 — Twitter intelligence.** Profile hover card (wallets, smart followers, Ethos, labels, AI), Smart-Follower badge hovers.
- **Phase 4 — Wallet hover.** Net worth, realized/unrealized PnL, hold time, recent trades, behavior type, labels, AI.
- **Phase 5 — Project Scan.** Deterministic investigation (domain/WHOIS/DNS/SSL/tech/repo/contract/holders/socials/scam-reports/similarity) → AI summarizes verified signals only.
- **Phase 6 — Notes, Ethos depth, watchlists/alerts sync, more adapters.**
- **Stages (rollout):** internal → founder beta → private beta → Chrome Store. No public launch until all pass.

---

## 9. Free-usage model (wired to trading)

Base 10 project scans · trading milestones unlock more · subscription = unlimited ·
**OR ≥5 SOL across tracked wallets unlocks AI** (same gate as the app's
`assertAiAccess`). Volume syncs from `/api/ext/me`. Progress is shown as encouragement,
never a wall: *"Traded 486 SOL this month — 14 more unlocks 10 scans."*

---

## 10. What this is NOT

Not Frontrun, not Axiom, not GMGN. Not a separate account or DB. Not a signer. Not a
scraper that invents data. It is Pointer, present everywhere you browse crypto,
always funneling discovery back into Pointer.
