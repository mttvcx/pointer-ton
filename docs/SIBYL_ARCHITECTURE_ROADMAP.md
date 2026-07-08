# Sibyl — 3-Year Architecture Proposal
### Building the Bloomberg Terminal of crypto AI: two moats, one execution path

> Status: internal architecture review + roadmap. This is **not** a build order — Year 1
> priorities (best crypto AI, Pointer integration, benchmarks, API, agents) are unchanged.
> Everything here is layered so the privacy/trust moat arrives **later without stealing
> focus from intelligence today.**

---

## 0. Thesis

Sibyl wins on **two moats**, not one:

1. **Intelligence** — be the best-benchmarked crypto reasoning engine in the world.
2. **Trust** — be the platform a fund can point at its own wallets, positions, and research
   without leaking its edge or creating legal/commercial exposure.

The second moat is the one Wisp gestured at — but **we must not copy Wisp's framing.**
Wisp protects your *files and chats* (personal opsec). That's the wrong threat model for us.

**Sibyl's privacy product is alpha-privacy, not personal-privacy.** In crypto:

- The on-chain data is *already public*. The secret is your **attention and strategy** —
  *which* wallets are yours, *what* you're researching, *when*, and *why*.
- The adversary is not "Dario reading logs at dinner." It's a **rival fund, an MEV bot, an
  exchange, or a data broker inferring your thesis from your query stream** — plus the
  **regulatory/subpoena exposure** of a hosted log of your trading research.

Funds, whales, market makers, and treasuries will pay a large premium to not leak their edge.
That is a sharper, more monetizable thesis than "obscenely private AI," and it's *native* to
who we already serve.

The rest of this doc shows the two moats are **complementary, not contradictory** — provided
we separate *what we learn from public outcomes* (always allowed) from *what we log about a
user* (privacy-gated). Get that separation right and privacy makes the intelligence moat
**stronger**, not weaker.

---

## 1. Where Sibyl actually is today

Grounding the proposal in the real codebase (not aspiration):

- **One intelligence layer.** `askSibyl(query, tier)` in `sibyl/orchestrator.ts` is the single
  entry the dashboard, mobile, extension, and the future public API all call. Query →
  `classifyIntent` → plan-clamped mode → **specialist fan-out** (`market`, `wallet`,
  `narrative`, `social`, `risk`, `dune`, `analog` in `sibyl/agents/runners.ts`) → **judge** →
  a structured `SibylAnswer` (verdict, confidence, `why`, interactive cards, sources).
- **Data providers** (`sibyl/data/providers/`): birdeye, dexscreener, dune, helius, x,
  grok-or-search, pointer. Free-tier-heavy today.
- **Model routing** via `sibyl/modelRouter.ts` (OpenRouter), tiered by plan (`sibyl/pricing.ts`),
  usage-metered (`getSibylUsage`, daily caps).
- **Live flywheel** — `recordScan` / `recallSubject` (`sibyl/memory/persist.ts`) persist to
  `sibyl_scans` / `sibyl_entities` / `sibyl_outcomes`. This is already a **proprietary,
  outcome-labeled dataset** accumulating on every scan.
- **Streaming** — real per-agent SSE trace + typed answer (shipped) via `/api/sibyl/chat/stream`.
- **Identity-registry moat** — Pointer's ~2,260-wallet KOL directory, wallet labels, top-holder
  credentials. This is data no competitor has.

**What this means:** we already have the two hardest things to bootstrap — a *single clean
inference seam* and a *compounding proprietary dataset*. Every pillar below hangs off those two.

---

## 2. Pillar 1 — Intelligence (the primary moat; Year 1 focus)

We have a good fan-out/judge skeleton. To be *best-in-world* we need five upgrades, roughly in
order of ROI:

### 2.1 Retrieval (highest ROI, lowest effort)
Today each scan starts cold except for `recallSubject`. Add a **vector layer over the flywheel**:
embed every past scan, entity dossier, and outcome; retrieve the most similar prior situations
into the judge's context ("last 5 tokens with this holder pattern → 4 rugged in 48h").
- **Why it wins:** turns our data moat into a *reasoning* advantage no frontier model has,
  because the retrieval corpus is ours.
- **Effort:** M. Dependency: a vector store (see §7 — pick one that can later run *local/TEE*).

### 2.2 Evaluation harness (the thing that makes "best-benchmarked" true)
We currently have **no eval system**. This is the single biggest gap.
- Build a **golden set** of crypto questions with graded answers, plus an **outcome-backtest**:
  `sibyl_outcomes` already records what actually happened (did the token rug? did the call
  hit?). Grade past verdicts against reality → a *self-improving accuracy metric*.
- **CryptoBench:** publish our own benchmark. Owning the benchmark is both an eval tool **and**
  a marketing/credibility moat ("Sibyl scores X on CryptoBench" becomes the industry yardstick).

### 2.3 Reasoning depth
Judge is one LLM call. Add, gated by tier: **tool-use loops** (ReAct — let an agent pull more
data mid-reasoning), **self-critique/verification** (a second pass that tries to refute the
verdict — we already use this pattern elsewhere), and **ensemble/debate** for high-stakes calls.

### 2.4 Data breadth (memes/lowcaps first — that's who we are)
Prioritize on-chain *depth* over CEX/derivatives (we're not a majors desk): full tx-graph +
dev-wallet lineage, LP add/remove + lock events, bridge flows, funding of deployer wallets,
first-buyer clustering. These feed `risk` and `wallet` agents directly.

### 2.5 Domain fine-tuning / distillation
The flywheel is a **training-data moat**: outcome-labeled crypto reasoning traces. Two moves —
(a) fine-tune/distill a **small fast model** for cheap tiers (latency + margin), and (b)
eventually a domain model that out-reasons frontier models *on crypto specifically*. This is a
Year 2–3 move; the eval harness (§2.2) must exist first or you can't measure gains.

---

## 3. Pillar 2 — Persistent Memory

Today memory is **subject-scoped** (entities in the flywheel). We need three tiers:

| Tier | Scope | Contents | Storage |
|---|---|---|---|
| **Entity memory** | Global / shared | Wallet & token dossiers, KOL identities, outcomes | Flywheel (exists) + vector index |
| **User memory** | Private per-user | Watchlists, tracked wallets, preferences, past research, workflows, positions | New `sibyl_user_memory` (privacy-gated) |
| **Episodic memory** | Per-conversation | Chat history, threads | Exists (chat store) |

Design principle: **entity memory is the moat and is public-outcome-derived (always allowed to
learn); user memory is private and privacy-gated.** This split is what lets us offer
zero-retention (Pillar 6) *without* starving the intelligence moat — we keep learning from what
happened on-chain, we just don't retain *who asked*.

Effort: M. Semantic recall via the same vector layer as §2.1.

---

## 4. Pillar 3 — Workspace (the "Terminal" layer)

This is what turns a chatbot into Bloomberg. Data model: **workspaces → folders → items**, where
items are watchlists, trade journals, saved reports, research notes, and shared projects; plus a
**knowledge base** and **search across everything** (full-text + vector).

- **Individual:** private research folders, journals, saved Sibyl reports.
- **Institutional:** shared projects, roles/permissions (RBAC), audit log — the seed of
  "confidential workspaces" in Pillar 6.
- **Search-across-everything** reuses the Pillar-1 vector layer — one retrieval substrate serves
  intelligence *and* workspace. Don't build it twice.

Effort: L (this is a real product surface). Highest *enterprise* value of any pillar besides
privacy — it's the daily-driver surface that creates lock-in.

---

## 5. Pillar 4 — Agent (chat → autonomous analyst)

Sibyl should become the **brain over rails Pointer already has.** We don't build automation from
scratch — we already own `alert_rules` (X Monitor, tracked-wallet, price triggers), auto-buy,
auto-sell, and auto-launch. The agent evolution:

1. **Monitor** — Sibyl watches wallets/tokens/narratives (reuse `alert_rules`).
2. **Research on schedule** — cron'd deep-dives ("morning brief on my watchlist").
3. **Summarize + alert** — push structured intelligence, not raw pings.
4. **Execute (gated)** — Sibyl *proposes*, existing execution rails act, behind the same
   client-side/delegated-signing model we just built for launch. **Never a shared keystore.**

Effort: M (mostly orchestration over existing primitives). This is where "intelligence" and
"terminal" fuse into a product no one else has, because we own both the brain and the rails.

---

## 6. Pillar 5 — API Platform

Largely **productizing what already exists** — `askSibyl` was built as the one endpoint. Formalize
typed intelligence endpoints:

`/v1/wallet/analyze` · `/v1/token/summary` · `/v1/risk/score` · `/v1/narrative/detect` ·
`/v1/portfolio/analyze` · `/v1/research`

- Auth: API keys + tiers + usage metering (the metering already exists).
- The **data flywheel → Gold-tier API** (per the existing flywheel plan) is the premium surface:
  proprietary signals (KOL clustering, outcome-backtested risk) other companies literally can't
  compute.
- **Business value:** every crypto company (wallets, exchanges, launchpads, tax tools) becomes a
  distribution channel *and* a flywheel data source. This is the highest-*margin* pillar.

Effort: M. Mostly hardening, docs, SDKs, billing — not new intelligence.

---

## 7. Pillar 6 — Trust & Privacy (the second moat)

**The central architectural tension, stated plainly:** the intelligence moat is fed by retention
(the flywheel); privacy is the *absence* of retention. If we're naive, they cancel.

**Resolution — the two-track model:**
- **Consumer track (free/pro):** consented, aggregated capture powers the flywheel. This is the
  training + eval corpus. Privacy here = good hygiene (encryption, no selling data), not zero-retention.
- **Fund/enterprise track:** **zero-retention + confidential inference + attestation.** A fund pays
  100–1000× a retail user, which *more than offsets* the lost datum.
- **The unlock:** the flywheel learns primarily from **public on-chain outcomes** (did the token
  rug/moon), which we can capture **without** the user's identity or query text. So even in a
  fully private session, Sibyl keeps getting smarter from *what happened*, just not from *who asked*.
  Separate "learn from outcomes" (always on) from "log the user" (privacy-gated) and the moats stop
  fighting.

### 7.1 Per-feature evaluation
Fit is judged **for a crypto intelligence platform**, using the alpha-privacy threat model above.

| Feature | Fits Sibyl? | Why (crypto-specific) | Complexity | Effort | Dependencies | Enterprise value | User value |
|---|---|---|---|---|---|---|---|
| **Zero-retention mode** | ✅ Strong | Funds can't have a subpoenable/leakable log of their research. Cheapest privacy win. | Low | S | Session flag + flywheel split (§7 track model) | **Very high** | Med–high |
| **Anonymous web-search routing** | ✅ Strong | Our agents do WebSearch/profiling; routing via an anonymizer stops a broker linking "who's researching $X" to you. Directly protects alpha. | Low–Med | S–M | Proxy/relay (Brave/Tor-style) in the provider layer | High | High |
| **Confidential workspaces (RBAC + enc)** | ✅ Strong | Institutions need per-seat access + audit; natural extension of Pillar 3. | Med | M | Pillar 3 workspace model | **Very high** | Med |
| **Confidential inference (TEE GPU)** | ✅ Strong (later) | The provider (and we) can't see a fund's prompts/positions; **attestable** "no human can read this." In 2026 this runs at **95–99% of native** on H100/H200 — a *procurement*, not research, problem. | Med–High | L | TEE GPU provider (Phala / Azure CVM + H100) + open-source LLMs | **Very high** | Med–high |
| **Cryptographic attestation** | ✅ Strong | The *verifiable* half of the pitch — client checks a signed CPU+GPU quote before sending data. This is what makes "trust us" into "verify us." | Med | M | Comes with the TEE provider (SEV-SNP/TDX + NVIDIA attestation, dual quote) | **Very high** | Med |
| **AMD SEV-SNP / Intel TDX / Azure CC** | ✅ (substrate) | The CPU-TEE floor under confidential inference; protects the orchestrator + anonymizer, not just the model. | Med | (part of above) | Cloud w/ confidential VMs | High | Low (invisible) |
| **Zero-retention enterprise / fund-grade tier** | ✅ Strong | The *package*: zero-retention + confidential inference + attestation + SOC2 + confidential workspace = the sellable "fund-grade" SKU. | — (bundle) | — | All of the above | **Very high** | — |
| **Local encrypted memory** | 🟡 Partial | Useful for a whale's *private* watchlist/journal, but Sibyl's value is server-side live data + big models. Only meaningful **inside a desktop app**. | Med | M | Desktop app (below) | Med | Med (niche) |
| **Local encrypted workspace** | 🟡 Partial | Same — follows the desktop app; the collaborative/institutional value actually wants *cloud* confidential workspaces, not local. | Med | M | Desktop app | Low–Med | Med (niche) |
| **Local vector DB** | 🟡 Partial | Private RAG over *your* research on-device is nice for opsec-max users; but our core retrieval corpus (the flywheel) is inherently server-side. | Med | M | Desktop app | Low | Med (niche) |
| **Desktop application** | 🟡 Situational | Real opsec appeal for funds/whales, but it's a **client**, not the moat, and a large surface. Do it only once the fund tier demands "nothing sensitive leaves my machine unencrypted." | High | XL | Tauri/Electron + local crypto + local models for the on-device parts | Med–High | Med |
| **"Confidential inference of frontier closed models"** | ❌ (caveat) | TEE inference realistically means **open-source models** (Kimi/GLM/Llama-class) in the enclave — you can't run a closed frontier model in *your* TEE. Be honest: the private tier trades a little raw model quality for verifiable privacy. Our domain fine-tune (§2.5) closes that gap. | — | — | — | — | — |

### 7.2 What this implies
- The **cheap, high-value privacy wins** are **zero-retention + anonymous search routing** — low
  effort, directly protect alpha, sellable immediately. These belong in **Year 2** and cost us
  almost nothing architecturally if we build the §7 two-track split early.
- **Confidential inference + attestation** is the flagship enterprise feature and is *feasible now*
  (95–99% native), but it's a provider integration + a domain-model quality tradeoff → **Year 3**,
  as the fund-grade SKU.
- **Desktop + local everything** is the *most Wisp-like* and the *least aligned* with our
  server-side-intelligence core. It's a **niche Year 3+** option for opsec-max funds, not a
  headline. Don't let it distract.

---

## 8. Revised 3-year roadmap

Sequenced so **Year 1 is 100% intelligence/API/agent** (current priorities untouched), and
privacy compounds *on top* later using seams we lay early.

### Year 1 — "Best crypto AI" (intelligence, no privacy distraction)
- **Retrieval over the flywheel** (§2.1) + **evaluation harness / CryptoBench** (§2.2) — the two
  highest-ROI intelligence moves.
- **Reasoning depth**: tool-loops + self-critique (§2.3).
- **API v1** hardening + Gold-tier signals (Pillar 5).
- **Agent v1**: monitor + scheduled research over existing `alert_rules` (Pillar 4, steps 1–3).
- **Seam we lay now (cheap):** the **two-track data split** (§7) — mark every capture as
  outcome-derived vs user-identifying. Costs little today, unlocks all of privacy later.

### Year 2 — "Terminal + first trust wins"
- **Workspace** (Pillar 3) + **user/persistent memory** (Pillar 2) on the shared vector substrate.
- **Zero-retention mode** + **anonymous search routing** (cheap, high-value privacy — Pillar 6).
- **Agent v2**: propose-and-execute over existing signing rails (Pillar 4, step 4).
- **Domain distillation** of a fast cheap model (§2.5), measured against Year-1 evals.

### Year 3 — "Fund-grade"
- **Confidential inference + attestation** on TEE GPU (Phala/Azure H100) → the **fund-grade SKU**
  (zero-retention + confidential + SOC2 + confidential workspaces).
- **Domain model** that out-reasons frontier models on crypto (closes the open-model gap of §7.1).
- **Optional:** desktop app + local encrypted memory/vector for opsec-max funds — *only if* the
  fund tier pulls for it.

---

## 8b. Adopted refinements (naming + council + surfaces)

Sharpened after review. These are decided direction, folded into the pillars above.

**Naming — why, not arbitrary** (source of truth: `lib/sibyl/models.ts`):
- **Sibyl** — a prophetess/oracle → prophetic crypto intelligence (the family).
- **Sibyl 7.0** — the flagship model.
- **Oracle Council** — the multi-agent reasoning ENGINE (never call it "multi-agent"
  internally — it's the *Council*). A council of diverse top models fused by the judge
  → out-reasons any single model (mixture-of-agents).
- **Sibyl Veil** — the confidential model (a "veiled" oracle in an attested enclave).
- **Institution**, not "Enterprise" — funds think *Fund / Desk / Trading Firm / VC*.
  Tiers read Free → Pro → Professional → **Institution**.

**The Council roster (Pillar 1 §2.3) — expanded:**
`Wallet · Narrative · Social · Risk · Analog · Macro · Culture · Execution → Judge`
- **+ Macro agent** — *crypto* macro (not econ 101): ETF flows, stablecoin supply,
  BTC dominance, ETH rotation, alt-season, listings, unlocks/treasury, VC funding,
  liquidity, regulation. High-signal context the specialists lack.
- **Split Narrative → Narrative / Social / + Culture agent.** Culture is the moat:
  70%/PvE/cards metas, CT in-jokes, who's-who (Ansem/Brez/Luke), attention mechanics —
  exactly what generic models have *no* clue about. Ours because of the flywheel + KOL
  registry.

**The flywheel is THE moat (elevate Pillar 1 §2.5 + Pillar-5 framing):**
`User → question → reasoning → OUTCOME → dataset → retrieval → fine-tune → better Sibyl`
— and Pointer is the fuel: millions of trades, wallet behavior, **hover/attention**,
charts viewed, alerts created, narratives watched, executions → outcomes. **Pointer =
the world's best crypto telemetry**, and Sibyl is what it's for. No one else has this.
Privacy note: behavioral capture is **consented + privacy-gated** (the outcomes-vs-user
split from Pillar 6), and zero in Veil sessions.

**Extension = a data agent, not just UI** (feeds the flywheel): hovered→didn't buy→
bought→closed→ignored is high-value behavioral signal (with consent + controls).

**CryptoBench deserves its own loop** (promote from a bullet to the engine of the
company): `Sibyl → CryptoBench → model selection → training → CryptoBench → repeat`.
Owning the benchmark is both the eval that makes "best" *provable* and a marketing moat.

**Reports / artifacts** (new surface, Pillar 3): not just chat answers —
`Analyze token → generate memo → export PDF → investment committee`. Artifacts are what
an Institution actually circulates; this is a major Y2 workspace deliverable.

## 9. One-paragraph summary (for the top of the deck)

Sibyl already has the two hard-to-copy assets: a single clean inference seam and a compounding,
outcome-labeled proprietary dataset. Year 1 turns that dataset into a *reasoning* edge (retrieval
+ evals + CryptoBench) and ships the API/agent — pure intelligence, no distraction. The second
moat is **alpha-privacy**, not personal-privacy: crypto's on-chain data is public, but a fund's
*attention and strategy* are its edge, and today that edge leaks into hosted logs and search
brokers. By splitting "learn from public outcomes" (always on) from "log the user" (privacy-gated)
early, we can later offer zero-retention, anonymous routing, and — by Year 3 — attestable
confidential inference as a **fund-grade tier**, *strengthening* the intelligence moat instead of
starving it. That combination — best-benchmarked crypto reasoning **and** verifiable trust — is
what makes Sibyl the Bloomberg Terminal of crypto AI rather than another chatbot.
