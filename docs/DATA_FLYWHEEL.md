# Data Flywheel — capture taps (proprietary dataset → future API)

**Strategy:** don't build/buy a year of history up front. Instrument the pipelines
so **every valuable signal is persisted as it flows**. The dataset compounds
passively; months later it becomes a Gold-tier API (FrontRun-style). History only
accumulates **forward from when a tap is turned on** — so the highest-leverage
early move is switching these on the moment the DB is healthy.

Good news: most capture tables already exist. This is mostly "turn on + timestamp",
not "build from scratch."

## FrontRun endpoint → what we already have → the tap to add/verify

| Product endpoint | Existing table(s) | Status | Tap (write-point) |
|---|---|---|---|
| **High PnL leaderboard** | `mint_swaps` → `deriveWalletStatsFromSwaps` (`lib/indexer/deriveWalletStats.ts`) → `wallet_stats` / `mint_wallet_stats` / `dev_wallet_stats` | ✅ derivable now | Schedule `aggregateGlobalWalletStats` on a cron; index more wallets' swaps. No new table. |
| **CA history** (CAs KOLs mentioned) | `social_mentions` (mint, source, author_handle, author_followers, content, url, posted_at) — written by `lib/db/social.ts` / `lib/social/twitter.ts` | ✅ table exists | At the X-Monitor CA-detection point (`lib/alerts/twitterListenMintPick.ts` / `emitTwitterListenAlerts.ts`), **insert every detected mint** into `social_mentions`. Verify it fires on the live listen path, not just on-demand. |
| **Mentioned wallets** (wallet addrs in tweets) | — (`social_mentions` is keyed by `mint`) | ⚠️ gap | Add a `wallet_mentions` table (or a `kind` col on social_mentions) and, in the same tweet-parse tap, extract base58 wallet addresses and insert them. |
| **Smart follower list** | `kol_smart_followers` (handle, follower_handle) via `submitSmartFollowers` (`lib/ext/smartFollowers.ts`, extension) | ✅ captured | Already flowing from the extension. Keep the extension tap on. |
| **First followers** (follow order) | `kol_smart_followers` — **no timestamp** | ⚠️ gap | Add `first_seen_at timestamptz default now()` to `kol_smart_followers` (upsert keeps earliest). Then follow-order = order by first_seen_at. Forward-only. |
| **Trending accounts** (gaining smart-follower attention) | `kol_smart_followers` snapshots | ⚠️ gap | With `first_seen_at`, compute deltas (new smart-followers per handle per window). Optional `kol_follower_counts(handle, count, snapshot_at)` daily snapshot cron for clean time-series. |
| **Linked wallets** (wallets ↔ twitter) | `identity_profiles` + `identity_wallets` | ✅ table exists | Populate `identity_wallets` from on-chain links, tweet bios, and mention co-occurrence. Tap at the same tweet-parse + KOL-import points. |
| **Wallet labels** | `wallet_labels` (user-scoped) + KOL directory (`tracked_wallets`, `tracker_groups`, `lib/track/starterKolPacks.ts`, InsightX) | ✅ mostly | Add a public/global labels view (aggregate user + KOL-directory labels) for the API; keep per-user in `wallet_labels`. |

## The single tweet-parse tap (covers 3 endpoints at once)

The X ingest already writes `twitter_ingest_tweets`. Add ONE persist step in the
tweet-processing path (right where CA detection runs) that, per tweet, upserts:
1. every **mint** → `social_mentions` (CA history)
2. every **wallet address** → `wallet_mentions` (mentioned wallets)
3. author → `identity_profiles`, and any explicit wallet link → `identity_wallets` (linked wallets)

One function, three durable outputs. That's the highest-value tap.

## Switch-on checklist (when the DB is healthy)

1. **DB healthy + on adequate compute** (Micro is the current blocker — see [[supabase-capacity-incident]]).
2. **Set `TWITTER_BEARER_TOKEN`** so the X ingest actually runs → `twitter_ingest_tweets` fills (see [[x-monitor-architecture]]).
3. **Migrations:** `first_seen_at` on `kol_smart_followers`; new `wallet_mentions` table (or `kind` col + wallet index).
4. **Add the tweet-parse tap** (mints + wallets + identity) at the CA-detection point.
5. **Cron:** run `aggregateGlobalWalletStats` (PnL leaderboard) + a daily `kol_follower_counts` snapshot.
6. **Storage/cost:** these are append-heavy — dedup on write, TTL/rollup raw rows, budget disk. Don't let capture re-crush a small compute.

## Notes
- Retroactive history (first followers, past CA mentions) **cannot be reconstructed** — only captured forward. Turning the taps on early is the moat.
- Some inputs still cost money (X API for tweets/followers, price data for PnL). Not a free flywheel, but cheap relative to the dataset value.
- The API itself is the easy last 10%; the dataset (these taps, running for months) is the moat.
