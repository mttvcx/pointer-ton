# Pointer — Where We're At (context handoff)

_Last updated: 2026-07-03. This file is a recovery anchor: if a session is lost, read this + the memory index (below) to resume._

## 🧭 Recovery basics
- **Memory (persists across all Claude sessions):** `C:\Users\moust\.claude\projects\C--Users-moust-Downloads-pointer-ton\memory\` — start with `MEMORY.md` (one-line index of every fact). Chats are NOT the source of truth; memory + committed code + this file are.
- **Branches:**
  - `main` → **the web app** (pointer.trade). Vercel prod (`pointer2-team` / `pointer-ton-orcin.vercel.app`) deploys from `origin/main`. **All web work goes here.**
  - `feat/pointer-extension` → **the browser extension only** (`pointer-extension/` subfolder). Do not mix web work into it.
  - Mobile app lives in its **own repo/worktree** — do not edit from here.
- **Before pushing web changes:** `npm run build` must pass (Next 16 uses `proxy.ts`, not middleware; `tsc` alone misses build-convention breaks). Then confirm `git rev-list --count origin/main..HEAD` == 0.

## 🔴 THE ONE BLOCKER: Supabase DB is down
- Prod DB project `ajngsbnwtkmkvbgpntkd` **died** (~1 Jul): Micro compute exhausted (RAM ~90%, ~150k errors) + coincided with a global Supabase incident. Returns HTTP 522 (Cloudflare can't reach the origin).
- Self-serve restore is **blocked** because the source is unreachable. A restore-to-new-project produced an **empty** project (`hlozzzcptaoadvesvtai`, 0 tables) — the source had no reachable data to copy.
- **Your data is safe in backups.** The 30 Jun physical backup is the one to restore ("the 1st it died, 30th prob wasn't dead").
- **Action owned by YOU (not Claude — billing/support are yours):** open a **Supabase support ticket** to restore the 30 Jun backup of `ajngsbnwtkmkvbgpntkd` into a healthy project. Claude will not touch billing/compute/restore on your behalf.
- App code (GitHub/Vercel) and settings (localStorage) are untouched by any DB restore.
- Details: memory `supabase-capacity-incident.md`.

## ✅ Built this session (all on `main`, all INERT until DB restored + schema applied)
Everything below returns `{ provisioned: false }` gracefully while the tables don't exist, so mobile/web UIs can be wired against real contracts NOW.

### Squads (groups) — memory `squads-backend.md`
- Schema: `scripts/squads-schema.sql` (`squads` + `squad_members`, member_count trigger, RLS).
- Data: `lib/db/squads.ts`. Routes: `POST /api/squads/create`, `GET /api/squads/discover`, `GET /api/squads/[id]`, `POST /api/squads/[id]/join`, `POST /api/squads/[id]/leave`, `GET /api/squads/list`, `GET /api/me/squads`.

### Social graph (follow + friend) + Expo push — memory `social-graph-backend.md`
- **Web had NEITHER follow nor friend before this.** Built both.
- Schema: `scripts/social-schema.sql` (`follows`, `friendships`, `device_push_tokens`).
- Data: `lib/db/socialGraph.ts`, `lib/db/devicePushTokens.ts`. Send: `lib/push/expo.ts` + unified `notifyUser()` / `notifyFollowersOf()` in `lib/push/notifyUser.ts`.
- Routes: `POST /api/social/{follow,unfollow}` (wallet follow also mirrors `tracked_wallets`), `GET /api/social/{following,followers}`, `POST /api/social/{friend-request,friend-respond}`, `GET /api/social/{friends,friend-requests}`, `POST /api/push/register` (Expo token).
- Web push (VAPID) already existed: `/api/push/{subscribe,unsubscribe,vapid-public-key}`.

## 🟡 Go-live checklist (once the DB is healthy)
1. Apply `scripts/squads-schema.sql` + `scripts/social-schema.sql` (SQL editor or MCP `apply_migration`).
2. Point Vercel env at the restored project (URL + anon/publishable + service-role/secret keys).
3. Wire `notifyFollowersOf(actorUserId, …)` into the trade-execute / Crossmint accrual path (deliberately NOT wired yet — it's the money path, do it live so it's tested).
4. Flip web Squads UI from `lib/squads/sampleData.ts` to the real endpoints; mobile wires to the same.

## 📋 Still open (asked by mobile, NOT built yet — cheap, next up)
- `users.twitter_handle` (+ name/avatar) populated in `/api/wallets/sync-privy` from Privy twitter_oauth.
- `GET /api/me/balance` — wallet USDC (on-chain via Helius).
- `POST /api/crossmint/webhook` — mirror `/api/trade/execute` accrual (insertTrade → cashback + points + referral), idempotent by `tx_signature='crossmint:<orderId>'`, Solana-only.

## 🗺️ Other in-flight threads (see memory for each)
- **X Monitor rebuild** (`x-monitor-rebuild.md`): 11-phase J7-parity feed. Deploy cards / wallets / automations / settings / toasts done. **Vamp intentionally skipped.** Pending: real X ingest (`TWITTER_BEARER_TOKEN` empty), 4-col, discord.
- **Wallet-tracker trades feed** (`wallet-tracker-trades-feed.md`): Axiom-style color-coded table + KOLs tab + Groups tab + Pulse wallet-group chips — shipped. Demo data gated behind Preview toggles (never fake in prod).
- **Data flywheel** (`data-flywheel.md`): capture-taps plan in `docs/DATA_FLYWHEEL.md` → proprietary dataset → Gold-tier API later.
- **Financial layer** (`pointer-financial-layer.md`): neobanking/Pointer card + AI taxes — a layer ON TOP of the core, excluded from the product bible; documented, not built.
- **Extension** (`pointer-extension-initiative.md`) and **Mobile** (`pointer-mobile-initiative.md`): separate branches/repos.

## ⚠️ Standing rules
- Web work → `main` only. Never fake data in prod (demo behind Preview toggles).
- Don't do billing/compute/payment/restore actions on the user's behalf.
- Deploy-key security: pasted deploy private key is in localStorage — use a burner wallet; move signing server-side before public launch.
