# Sibyl — Confidential Compute (TEE) Engineering Design
### Can confidential inference be a core infra layer without hurting the intelligence roadmap?

> **One-line answer:** Yes — because Sibyl already has the seam (`sibyl/modelRouter.ts` +
> the single `askSibyl` entry). Confidential inference is an **optional execution mode behind
> the router**, not a rewrite. Build the *seam* now (cheap), prototype the *mode* now (days),
> productionize the *tier* after the intelligence layer + benchmarks are strong. **Privacy is a
> multiplier layered on top; it never sits on the critical path of Pillar 1.**

Priority order is unchanged: **best crypto intelligence → best benchmarks → best retrieval/
reasoning → best proprietary dataset → verifiable privacy.** This doc is scoped so #5 can't
delay #1–#4.

---

## 0. TL;DR recommendation

| Question | Answer |
|---|---|
| Should Sibyl build this? | **Yes — but as an optional mode, phased.** |
| Does it force a rewrite? | **No.** It's a new backend behind the existing inference router. |
| Does it cost us quality? | **No — TEE doesn't touch model math (benchmark loss ≈ 0).** Quality depends only on *which open model* you run in the enclave; our crypto fine-tune closes that gap. |
| Is it "one week"? | **A prototype, yes (~3–5 days). Production is ~2–3 months. Enterprise-ready is ~4–8 months (SOC2 dominates).** |
| When? | **Seam + throwaway prototype: now (v1, days). Confidential *mode*: v2 (post-benchmarks). Enterprise/fund tier: v3 (post-PMF, when a fund is paying).** |
| Who is it for economically? | **Enterprise/funds** (they pay for dedicated confidential GPUs). Retail stays on normal per-token mode — the economics forbid putting free users on dedicated TEE GPUs. |

The user's own heuristic applies cleanly: **the low-effort part (router seam + prototype) is
worth doing now; the high-cost part (dedicated GPU fleet + SOC2) waits for validated demand.**

---

## 1. Confidential computing stack — provider comparison

TEE for LLM inference needs a **CPU TEE + a confidential GPU** (the GPU is where the model runs;
CPU-only TEEs like AWS Nitro **cannot** run GPU inference inside the enclave — disqualifying for
us). The confidential-GPU tech is **NVIDIA H100/H200/B200 Confidential Computing** (encrypted
VRAM + on-die root of trust + attestation). You don't buy NVIDIA CC directly — you get it through
a provider.

| Provider | Maturity / prod-ready | GPU support | Attestation | Pricing model | DX | Scaling | Limitations |
|---|---|---|---|---|---|---|---|
| **Azure Confidential Inferencing** | **Highest** — GA, compliance certs | SEV-SNP (AMD EPYC) + **H100** unified TEE | MAA + **OHTTP**: KMS releases key only on a valid attestation token | On-demand cloud VM | Enterprise-grade, documented | Elastic (Azure) | Azure lock-in; least "crypto-native" story |
| **Google Confidential Space + H100** | **High** — H100 support **GA** | Intel **TDX** + **H100** | Intel **Tiber Trust Authority** (free tier); great for **multi-party** | On-demand cloud VM | Good; strongest for multi-party sealing | Elastic (GCP) | GCP lock-in; multi-party focus is overkill for single-tenant |
| **Phala Cloud (GPU TEE)** | **Medium-High** — live, crypto-native | **H100 / H200 / B300** | **Dual quote** (TDX + NVIDIA) via one verifier — on-chain-friendly | **Pay-as-you-go, by the hour, no minimums** | Best for a crypto team; verifiable/on-chain attestation | Good; reserve for steady state | Younger than hyperscalers; capacity by workload |
| **Marlin Oyster** | **Medium** — crypto-native, decentralized | Primarily Nitro/CPU coprocessor; GPU-LLM at scale less proven | On-chain verifiable | Serverless / rent-by-task | Great for verifiable-compute narrative | Decentralized pool | Not yet the pick for heavy GPU LLM serving |
| **NVIDIA Confidential Computing** | (substrate, not a vendor) | The H100/H200/B200 tech itself | NVIDIA NRAS / local | via the clouds above | — | — | You consume it *through* a provider |
| **AWS Nitro Enclaves** | High (CPU TEE) | **None inside enclave** | Nitro attestation | On-demand | Good | Elastic | **CPU-only → cannot serve GPU LLMs. Disqualified.** |

**Performance reality across all of them:** NVIDIA H100/H200 CC runs at **~95–99% of native**
(memory-encryption overhead only). TEE is a *cost/ops* tax, not a *quality* tax.

### Recommendation — dual-provider, staged
- **Prototype + crypto-native tier → Phala Cloud.** Pay-as-you-go (no reserved fleet to start),
  dual on-chain-verifiable attestation, and it *is* the crypto-trust brand story. Cheapest way to
  stand up a real attested endpoint this week.
- **Enterprise/fund tier → Azure Confidential Inferencing.** Most mature, on-demand, compliance
  certs, OHTTP+KMS key-release — this is what a hedge fund's security team will actually accept in
  procurement. Google Confidential Space is the credible backup (GA H100, free-tier attestation).
- Keep the **inference router provider-agnostic** (below) so this is a config choice, never a
  rewrite. Start Phala; add Azure when the first fund signs.

---

## 2. Models — what runs in a TEE, and does it cost quality?

**The precise answer the question asks for: confidential inference sacrifices *infrastructure*,
not *quality*.** A TEE encrypts VRAM and adds attestation; it runs the *identical* weights and
kernels. Benchmark loss from the TEE itself is **≈ 0** (throughput overhead ~1–10%, worse only on
tiny memory-bandwidth-bound models). **The only quality lever is which model you can run — and in
*your* TEE that means an open-weights model** (you cannot run Claude/GPT-class closed models inside
a TEE you attest; the labs don't ship weights).

Open models realistically servable in H100/H200 TEE today:

| Model | Strength | VRAM / GPUs (H100-80GB) | Latency/throughput | Crypto-reasoning fit | Notes |
|---|---|---|---|---|---|
| **DeepSeek-V3 / R1** | Top open reasoning | Large MoE — multi-GPU (fp8) | Good at scale | High (R1 reasoning) | Best open reasoning ceiling |
| **Qwen 2.5 / 3 (32B–72B / MoE)** | Excellent, many sizes | 1–4 GPUs by size | Strong | High | Best size/quality flexibility |
| **GLM 4.5 / 4.6** | Strong, agentic | Multi-GPU | Strong | High (tool-use) | Good agent behavior |
| **Kimi K2** | Large MoE, strong | Multi-GPU | Moderate | High | Heavy; premium tier only |
| **Llama 3.x / 4** | Solid baseline | 1–8 GPUs | Strong | Medium | Safe default / fallback |
| **Gemma 2 / 3** | Efficient, small | Single GPU | Fast | Medium | Cheap confidential tier |

**Strategic move:** the confidential tier runs a strong open base (Qwen/DeepSeek/GLM) **fine-tuned
on Sibyl's proprietary crypto flywheel** (`sibyl_scans/entities/outcomes`). That domain tune is how
a confidential *open* model matches — or beats, *on crypto specifically* — a generic frontier closed
model. This is the same fine-tune already on the intelligence roadmap (Pillar 1 §2.5), so **privacy
and intelligence share the investment instead of competing.** The eval harness / CryptoBench is the
gate: never ship a confidential model that regresses crypto benchmarks vs the normal tier.

---

## 3. Architecture — Sibyl stays architecturally identical

Yes. The product does not change. Today:

```
Client (web / mobile / terminal / API / Pointer)
      │
      ▼
/api/sibyl/chat[/stream]      ← unchanged
      │
      ▼
askSibyl()  →  intent → agents fan-out → judge      ← unchanged
                                   │
                                   ▼
                          modelRouter.ts            ← the seam we extend
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
        NORMAL backend                        CONFIDENTIAL backend
     (OpenRouter: closed+open,            (attested TEE endpoint,
      per-token, cheapest)                 open model, dedicated GPU)
```

The **only** thing that changes is *where the final LLM call goes*. Intent classification, the
seven specialist agents, the judge, the cards, the flywheel — untouched. Concretely:

- Generalize `modelRouter` to select a **backend** (`normal` | `confidential`) as well as a model,
  keyed off a request `mode` + the caller's tier.
- Add a `ConfidentialBackend` that (a) fetches + verifies the provider's attestation, (b) opens an
  attested channel, (c) sends the prompt, (d) enforces zero-retention.
- **Graceful degradation:** if the TEE backend is unavailable and the caller allows it, fall back
  to normal mode *with an explicit, logged downgrade* (never silently pretend a session was
  confidential). Enterprise/fund mode = **no fallback** (fail closed).

**The subtlety most people miss (and the reason "just route the LLM" is incomplete):** Sibyl's
*data providers* (birdeye, helius, dexscreener, x, web search) make **external calls that leak the
query** — a search provider learns you're researching `$FOO`; an RPC learns which wallet you asked
about. True confidential mode therefore also routes **retrieval** through the anonymizer / inside
the enclave (Section 6). Confidential mode = **TEE inference + anonymized retrieval + zero-retention**,
composed. Each is independently shippable behind the same `mode` flag.

**Cost of the seam itself: ~1 engineer, a few days.** It's formalizing an interface Sibyl already
has. This is the piece to do in v1 — it's the "don't force a rewrite later" insurance.

---

## 4. UX — users never learn the words "confidential computing"

Three modes, plain language, security framed as *speed/assurance*, not cryptography:

| Mode | Label | Sub-label | Who | Under the hood |
|---|---|---|---|---|
| Normal | **⚡ Fast** | Best models, fastest | Everyone (default) | OpenRouter, per-token |
| Secure | **🛡 Private** | "Your research stays yours — verified, not stored" | Pro / whale | TEE inference + anon retrieval + zero-retention |
| Enterprise | **🏛 Confidential Workspace** | "Attested. Nothing leaves the enclave. Auditable." | Funds / firms | Reserved TEE + no-fallback + confidential workspace + audit log |

A single toggle. The proof (attestation) lives one tap deeper ("🔒 Verified — view proof") for the
people who care; everyone else just sees **Private** vs **Fast**. Default is Fast — privacy is
opt-in, never a tax on the 99% who don't need it.

---

## 5. Attestation — how "trust us" becomes "verify us"

**Mechanism.** The confidential GPU/CPU produce a hardware-signed **quote** (measurements of the
firmware, the VM image, and — critically — the **model + serving code hash**) chained to the
vendor's root of trust. A verifier checks the signature + measurements against an expected policy.
On Azure this is wired as **OHTTP + KMS key-release**: the model's decryption key is only released
to an enclave whose attestation matches policy — so an un-attested box literally can't decrypt/serve.

**Who verifies, and how:**
- **User:** nothing to do — the client verifies for them, shows a green "🔒 Verified" pill.
- **Enterprise / fund security team:** we expose the raw quote + our expected measurements so *their*
  tooling can independently verify (they won't take our word — and shouldn't have to).
- **API consumers:** the SDK verifies **before the first prompt leaves the device** (below).
- **Funds specifically:** they verify the **model hash** (they're running the model *they* audited,
  not a swapped one) and that **no logging path exists** in the attested image.

**SDK — automatic pre-flight verification:**
```ts
const sibyl = new Sibyl({ apiKey, mode: 'confidential' });
// SDK fetches the attestation, verifies signature + measurements against our
// published policy, and REFUSES to send if it doesn't match — before any prompt leaves.
await sibyl.verifySession();          // throws on mismatch
```
Exposed, one-liner each:
- `verifySession()` — full attested handshake, gate before sending.
- `getAttestation()` — raw quote + parsed measurements (for the fund's own verifier).
- `verifyModelHash(expected)` — pin the exact model you audited.
- `attestationBadge()` — UI component (green/verify state).

This is the whole product wedge: **verifiable** privacy, not promised privacy. It's what separates
us from "we swear we don't log."

---

## 6. Anonymous retrieval — the crypto-specific leak (funds *will* care)

Confidential inference protects the prompt at the model. It does **not** protect the **retrieval**
Sibyl does on your behalf — and *that* is where a fund's alpha actually leaks: a web-search provider,
an RPC node, or a data API learns **which token/wallet you're researching, from which IP, when**.
For our market this matters as much as the inference.

| Feature | Include? | Why (crypto-specific) | Effort |
|---|---|---|---|
| **Anonymous web-search / retrieval routing** | ✅ | Stops a broker linking "who researches $FOO" to you; protects the *research signal*. | S–M |
| **Anonymous RPC / on-chain lookups** | ✅ | An RPC provider can see which wallets/contracts you probe → infer positions. Route via rotating/pooled RPC. | M |
| **IP protection** | ✅ | Ties queries to a physical identity/office. Egress via the enclave/proxy. | S |
| **Wallet-address unlinkability** | ✅ | Don't let one query reveal "these 5 wallets are the same fund." Batch/decouple lookups. | M |
| **Query + session unlinkability** | ✅ | No stable identifier across a research session that a middlebox can correlate. | M |

**Would a fund care?** Yes — more than about the model. A market maker researching a token they're
about to take a position in cannot have that research pattern observable by the very infra they
query. This is the sharpest, *most defensible* part of the privacy pitch and it's **cheaper than
TEE** — it's a proxy/routing layer in the provider seam, not a GPU fleet. **Ship anon-retrieval
first; it's the highest privacy-value-per-dollar.**

---

## 7. Memory — privacy-preserving, tiered

Reconcile with the flywheel (our #4 moat) via the split established in the architecture roadmap:
**learn from public on-chain *outcomes* (always) vs log the *user* (privacy-gated).**

| Memory | Default | Confidential/fund tier | Rationale |
|---|---|---|---|
| **Entity memory** (wallets/tokens/KOLs, outcomes) | Server, shared | Same (it's public-derived) | The moat — never gated; not user-identifying. |
| **User memory** (watchlists, journals, prefs) | Server-encrypted | **Client-encrypted OR zero-retention** | The private surface; funds hold the key. |
| **Session/episodic** (chat) | Server | **Zero-retention** (nothing persisted) | Fund mode leaves no log to subpoena/leak. |

Best design: **server-side encryption by default; per-workspace/per-fund encryption keys +
zero-retention mode for the enterprise tier; client-side encryption optional for the paranoid.**
**Not local-first** — memory stays server/cloud (per your first principles); privacy comes from
*encryption + attestation + retention policy*, not from moving data to a laptop. Workspace-scoped
and fund-scoped keys give the isolation institutions need without a desktop app.

---

## 8. API — one flag, nothing else changes

```jsonc
POST /v1/token/analyze
{ "query": "...", "mode": "confidential" }   // or "secure": true
```
Every existing endpoint gains an optional `mode: "fast" | "confidential"` (default `fast`). Same
request shape, same response shape — the router does the rest. Response carries an `attestation`
object in confidential mode (quote ref + verified:true) so consumers can prove it downstream.

SDK: `new Sibyl({ mode })` sets the default; per-call override; `verifySession()` auto-runs before
the first confidential call. **A customer flips one field; no integration rewrite.** This is exactly
the "layered, optional" property you asked for — the API contract is forward-compatible from day one
if we reserve the `mode` field now (a v1 no-op that only accepts `fast`).

---

## 9. Enterprise tier — what confidential compute *unlocks*

The premium SKU exists **because** of verifiable privacy. Target: hedge funds, family offices,
trading firms, market makers, protocols, VCs. Features that only become sellable with TEE +
attestation + zero-retention + confidential workspaces:

- **Internal research & token due-diligence** on material they can't put into ChatGPT (unreleased
  token docs, data-room materials, cap tables).
- **Portfolio & wallet analysis** on *their own* wallets without revealing the wallet set to us or
  any infra provider.
- **Internal strategy / thesis** drafting with a cryptographic guarantee it isn't retained or
  trainable.
- **M&A / legal review** of token deals, SAFTs, protocol acquisitions.
- **Shared confidential workspaces** with per-seat RBAC + audit log (compliance requirement).
- **Attested API** they can point their own auditors at.

Willingness-to-pay here is high and volume-per-customer is low — which, as §11 shows, is exactly the
shape where the dedicated-GPU economics work.

---

## 10. Threat model — who we actually protect against (our real market)

Not "generic AI privacy." Specifically:

| Adversary | What they'd learn without us | Why a fund cares |
|---|---|---|
| **Competitors / rival funds** | Your research targets, thesis, timing | Direct alpha loss |
| **MEV searchers** | Which tokens/wallets you're about to touch | Front-running |
| **Data brokers** | Your search/query history → sold ad/behavior profile | Strategy leakage |
| **Cloud / infra operators** | Prompt + retrieval contents in plaintext | The reason for TEE at all |
| **Subpoenas / legal discovery** | Any retained log of research | Zero-retention removes the target |
| **Internal employees (ours)** | If we could read logs | Attestation proves we *can't* |
| **Wallet deanonymization** | Linking your wallets via query patterns | Identity/position exposure |
| **Research / alpha leakage** (the umbrella) | The pattern of *what you look at* | This *is* the product |

The through-line: **we protect the user's *attention and strategy*, not their cat photos.** That's
a market that pays.

---

## 11. Cost analysis (2026) — the real story is *hosting model*, not TEE overhead

The naive framing ("TEE is ~10% more") is wrong and would mislead the decision. The real cost cliff
is **per-token API → dedicated confidential GPU**:

- **Normal mode:** per-token via OpenRouter. **~$0 fixed**, pay-per-use. Idle = free.
- **Confidential mode:** you rent a **dedicated H100 TEE** (~**$3–6/hr** in 2026; the CC premium
  over a normal H100 is only ~10–30%) and self-host an open model. That GPU costs the same **idle or
  busy**. One H100 ≈ **$2,200–4,400/month** whether it serves 10 queries or 100k.

So per-query cost is dominated by **utilization**, not TEE overhead:

| Scale | Normal (per-token) | Confidential (dedicated TEE) | Per-query delta |
|---|---|---|---|
| Prototype / 10 users | ~$tens/mo | **1 GPU ≈ $3–4k/mo** (mostly idle) | Enormous per query — fine, it's a demo |
| 100 users | ~$hundreds | 1–2 GPUs ≈ $4–8k/mo | Still large; **retail can't be here** |
| 1,000 users | low $thousands | 3–6 GPUs ≈ $12–25k/mo | Break-even only if usage is dense |
| 10,000 users | mid $thousands+ | fleet + autoscale | Amortizes toward parity at high, steady load |
| 100,000 users | scales w/ tokens | large reserved fleet + burst | Competitive per-token at high utilization |
| **Enterprise deploy (1 fund)** | — | **1–2 reserved GPUs, priced as premium SKU** | **Economics WORK** — high WTP, low volume, they fund the GPU |

**Conclusions that drive the roadmap:**
1. **Confidential mode is an enterprise/fund economic model, not a retail one.** You cannot put free
   users on dedicated TEE GPUs — the idle cost is ruinous. Retail stays on normal per-token mode.
2. **Anonymous retrieval (§6) and zero-retention (§7) are nearly free** (proxy/routing + a flag) and
   deliver most of the *perceived* privacy — ship those to everyone; reserve dedicated-GPU TEE for
   paying enterprise.
3. Don't stand up a GPU fleet before a fund is paying. Prototype on **Phala pay-as-you-go** (hourly,
   no reserved fleet) so the prototype costs **dollars, not a monthly GPU bill.**

---

## 12. Is this really one week? — brutally honest task breakdown

**No — a *prototype* is ~a week; a *product* is months.** Tasks:

| Task | Difficulty | Hours | Dependencies | Unknowns / blocking risk |
|---|---|---|---|---|
| Generalize `modelRouter` to backend-select (`normal`/`confidential`) | Low | 8–16 | none (it's our seam) | Low |
| Reserve `mode` field in API + SDK (v1 no-op) | Low | 4–8 | none | Low |
| Stand up 1 open model on **Phala** confidential endpoint | Low-Med | 8–16 | Phala acct, model choice | Capacity/quota; model VRAM fit |
| Fetch + verify attestation (manual, one provider) | Med | 16–24 | provider attestation docs | **Attestation formats differ per provider** |
| Wire confidential backend into router + fallback logic | Med | 16–24 | above | Fail-closed vs fall-open policy |
| **→ PROTOTYPE (attested confidential answer, 1 model)** | — | **~3–5 days** | — | genuinely a week for 1 eng |
| Zero-retention plumbing (no logs on the confidential path) | Med | 24–40 | flywheel split | Must audit *every* log site |
| Anonymous retrieval routing (search + RPC) | Med-High | 40–80 | proxy infra | RPC pooling correctness; latency |
| SDK verify methods (`verifySession/getAttestation/verifyModelHash`) | Med | 24–40 | attestation lib | Cross-lang parity (JS/py) |
| Crypto fine-tune of the confidential open model + eval gate | High | 80–160 | flywheel data, eval harness | **Must not regress CryptoBench** |
| Billing/metering for the mode | Med | 24–40 | usage system (exists) | Reserved-GPU cost attribution |
| **→ INTERNAL / BETA (mode flag e2e, 1 strong model, real attestation)** | — | **~2–4 weeks** | — | attestation + retention are the long poles |
| Multi-model, autoscale, monitoring, key mgmt | High | — | — | ops maturity |
| **→ PRODUCTION** | — | **~1.5–3 months** | — | |
| Confidential workspaces (RBAC, audit, per-fund keys) | High | — | Pillar 3 workspace | scope |
| **SOC 2 Type II** + procurement + SLAs | High | — | **auditor, calendar time** | **months of calendar regardless of eng** |
| **→ ENTERPRISE-READY** | — | **~4–8 months** (SOC2 dominates) | — | |

Anyone quoting "one week" for the *product* is selling. One week is honest **only** for a
routed-to-an-attested-endpoint prototype.

---

## 13. Recommendation — build it, phased; seam now, tier later

**Build it — as an optional mode, sequenced so it can never delay Pillar 1.**

- **Now (v1, ~1 week, no roadmap risk):** build the **inference-router seam** + reserve the API
  `mode` field + a **throwaway Phala prototype** (hourly, ~dollars). This *de-risks* the whole
  direction and guarantees "no rewrite later" — it's the single highest-leverage cheap move. It does
  **not** touch the intelligence layer.
- **v2 (after benchmarks + retrieval are strong, PMF-ish):** ship **anonymous retrieval +
  zero-retention** to all tiers (cheap, high perceived value), and a real **confidential *mode*** on
  a domain-fine-tuned open model, gated by CryptoBench (never regress).
- **v3 (post-PMF, when a fund is paying):** the **enterprise/fund tier** — reserved TEE (Azure),
  confidential workspaces, SOC2, attested API. Stand up the GPU fleet **only** against signed demand.

**Why this timing:** the *seam* is days and future-proofs everything, so do it now. The *dedicated
GPU cost + SOC2* only make sense with paying enterprise demand, so defer those. This is exactly your
stated heuristic — cheap+reversible now, expensive+demand-gated later — and it means confidential
inference **never becomes the focus at the expense of intelligence.**

**Answer to "v1/v2/v3":** **seam = v1, mode = v2, enterprise tier = v3.**

---

## 14. The one rule — how the design honors it

> Never compromise Sibyl's core advantage: best crypto reasoning, retrieval, benchmarks, intelligence.

This design honors it structurally, not just in spirit:
1. **Privacy sits *behind* the router** — the intelligence pipeline (agents, judge, retrieval,
   flywheel) is byte-for-byte identical in both modes. Improving intelligence improves *both* modes
   for free.
2. **The one shared investment is the crypto fine-tune**, which is already Pillar 1 work — privacy
   reuses it instead of forking effort.
3. **CryptoBench is the gate:** the confidential model ships only if it *matches* the normal tier on
   crypto benchmarks. Privacy that costs intelligence doesn't ship.
4. **The expensive parts are demand-gated**, so engineering focus and dollars stay on intelligence
   until funds are paying for privacy.

Privacy is the multiplier. Intelligence is the product. This architecture keeps it that way.
