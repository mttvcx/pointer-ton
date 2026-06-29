# Provably-Fair Packs (Phase 1 · Mission 6)

## The problem

Pack outcomes were rolled server-side from `Math.random()` — unseeded,
server-chosen, with no commitment and no record. A player had no way to prove the
server didn't bias their roll (toward the house, or away from whales). For a
real-money loot-box product that is both a trust problem and a compliance risk.

## The scheme — commit-reveal (HMAC-SHA256)

The same model audited gaming platforms use. Three inputs determine every roll:

| Input | Who controls it | Visibility |
| --- | --- | --- |
| `serverSeed` | server (32 random bytes) | **secret** until rotation; only `sha256(serverSeed)` is published up front |
| `clientSeed` | the player (or a random default) | public |
| `nonce` | incrementing, one per roll | public |

Flow:

1. **Commit** — the server publishes `serverSeedHash = sha256(serverSeed)` before
   any roll. It cannot change the seed afterwards without breaking the hash.
2. **Roll** — every random draw is the next 32 bits of the
   `HMAC-SHA256(serverSeed, "clientSeed:nonce:counter")` keystream. Deterministic
   given the three inputs.
3. **Reveal** — when the player rotates their seed, the server reveals the old
   `serverSeed`. The player checks `sha256(serverSeed) == serverSeedHash` and
   replays the keystream to reproduce every past roll on that seed.

Because the server is bound to `serverSeedHash` before it knows the clientSeed/
usage and cannot alter the seed undetected, it cannot grind outcomes; because the
keystream is deterministic, the player can reproduce them. This is non-custodial
trust: verification needs no trust in Pointer.

## Code

- **`lib/packs/provablyFair.ts`** (pure, `node:crypto`, 9 unit tests) —
  `generateServerSeed` / `hashServerSeed` / `verifyServerSeed`, and
  `createFairRng(serverSeed, clientSeed, nonce)` → unbounded deterministic `[0,1)`
  stream (8 uint32 per HMAC block, counter advances across blocks).
- **`lib/packs/fairnessSeeds.ts`** (Redis I/O) — per-user seed lifecycle: one
  active pair, atomic `nonce` via `INCR`, `getCommitment` / `reserveRoll` /
  `setClientSeed` / `rotateSeed`. The seed blob has **no TTL** (it must survive
  until the user rotates, or past opens become unverifiable).
- **`lib/packs/openPack.ts`** — `openPackServer` already took an injectable `rng`;
  production now injects the fair keystream instead of `Math.random`.
- **`app/api/packs/open`** — reserves a roll (lazily, so a forced override/dev
  outcome never burns a nonce), rolls with `createFairRng`, and attaches the
  `fairness` proof to the persisted `pack_opens.result` + the response. Anonymous
  opens get an ephemeral seed revealed inline (no future opens to protect).
  Admin-override / dev-test outcomes are marked `fairness: { forced: true }` —
  they are honestly NOT RNG-derived, so they are not presented as verifiable rolls.

## Player-facing API

- `GET /api/packs/fairness` — current commitment `{ serverSeedHash, clientSeed,
  nonce }` (the nonce the next roll will use).
- `POST /api/packs/fairness` `{ action: "setClientSeed", clientSeed }` — set your
  own entropy.
- `POST /api/packs/fairness` `{ action: "rotate", clientSeed? }` — reveal the
  current `serverSeed` (verify past rolls) and commit a fresh pair.
- `POST /api/packs/fairness/verify` `{ serverSeed, clientSeed, nonce, packType }`
  (public) — recomputes the outcome so the player can confirm what they received.
  The random selection (rarities, token, value-in-SOL) is fully reproducible; USD
  display pricing depends on market data and is intentionally omitted.

## What's stored

The proof rides in the existing `pack_opens.result` JSON — **no schema
migration**. Per open: `serverSeedHash`, `clientSeed`, `nonce` (and, for anonymous
opens, the revealed `serverSeed`). The secret `serverSeed` for signed-in users is
revealed only on rotation.

## Threat model & properties

- **No server grinding** — committed `serverSeedHash` binds the seed before use.
- **Tamper-evident** — any seed change breaks the published hash.
- **Replayable / independently verifiable** — the algorithm is public; a player
  can recompute without trusting our endpoint.
- **Per-roll isolation** — unique nonce per roll; revealing a seed exposes only
  that seed's already-completed rolls.
- **Overrides are explicit** — promos/dev outcomes are flagged `forced`, never
  dressed up as fair rolls. (Overrides remain a four-eyes-approved admin path.)

## Tradeoffs / future

- **Pre-commit timing:** a signed-in user's `serverSeedHash` is committed and
  returned before each roll and is stable until rotation, which is the standard
  guarantee. A user who wants the strongest "committed before I chose my seed"
  ordering can `setClientSeed` then `GET` the commitment before opening.
- **Anonymous opens** reveal the seed inline (verifiable, but not pre-committed) —
  acceptable since demo/anon opens don't move money.
- **VRF / drand** (on-chain or beacon randomness) is a possible future upgrade for
  a fully trustless server seed; commit-reveal is the pragmatic, audited baseline
  and is sufficient for verifiability.

## Tests

`lib/packs/provablyFair.test.ts` — 9 cases: known sha256 vector, commitment
verify (incl. case-insensitivity + wrong-seed rejection), determinism, `[0,1)`
range over 1k draws, distinct streams per input, cross-block determinism,
uniformity (mean ~0.5 over 20k), and a full commit→roll→reveal→replay round-trip.
