# Sibyl — State of the Project (handoff)
*Snapshot for context-sharing. Written 2026-07-08.*

## What Sibyl is
**Sibyl** is Pointer's crypto-intelligence AI — the product, not a chatbot wrapper. Map to the
Anthropic analogy:

| Anthropic | Pointer |
|---|---|
| Anthropic (company) | **Pointer** |
| Claude (model family) | **Sibyl** |
| Opus / Sonnet (model) | **Oracle** (flagship) · **Veil** (confidential) |
| 4.8 (version) | **7.0** |

So the AI identifies as **"Sibyl Oracle 7.0, by Pointer"** (confidential model = **"Sibyl Veil 7.0"**).
It **never** reveals any underlying/base model, provider, or that it's a general LLM — enforced in
the system prompt (`sibyl/agents/prompts.ts` `SIBYL_STYLE` IDENTITY) + a `scrubModelLeak()` safety
net. Source of truth for names: `lib/sibyl/models.ts`.

## Core architecture (the intelligence moat)
One entry — `askSibyl(query, tier, opts)` (`sibyl/orchestrator.ts`) — used by the dashboard, the
future public API, mobile, and the extension. Pipeline:

```
query → classifyIntent → 7 specialist agents fan out (market, wallet, narrative,
        social, risk, dune, analog) → JUDGE synthesizes → SibylAnswer
        (verdict, confidence, why, interactive cards, sources)
```

- **Multi-agent** (roles) is always on. **Multi-model**: today the router (`sibyl/modelRouter.ts`)
  picks different models by *cost tier* (cheap for agents, premium for judge). **The intended next
  step is model-DIVERSITY** — a *council* where different top models power different agents and the
  judge fuses them, so the ensemble out-reasons any single model (mixture-of-agents). The
  architecture already supports this via the router; per-agent model assignment is the upgrade.
- **Flywheel** (proprietary dataset): every scan writes to `sibyl_scans / sibyl_entities /
  sibyl_outcomes` — outcome-labeled crypto reasoning. This feeds retrieval + a future domain
  fine-tune. **Skipped in private modes** (zero-retention).
- **Streaming**: real per-agent "thinking" trace + typed answer via SSE (`/api/sibyl/chat/stream`).

## Trust & privacy layer (the second moat) — BUILT, inert until configured
Framing: **alpha-privacy, not personal-privacy.** We protect a fund's *attention/strategy* (which
wallets are theirs, what they're researching, positions) — on-chain data is public; the edge is
what you look at. Full designs: `docs/SIBYL_ARCHITECTURE_ROADMAP.md` + `docs/SIBYL_CONFIDENTIAL_COMPUTE.md`.

**Three execution modes** (one flag behind the model router — no rewrite):
- **⚡ Fast** — normal (OpenRouter, per-token). Default. = *Sibyl Oracle*.
- **🛡 Private** — anonymized retrieval + zero-retention, normal model. Near-free privacy.
- **🏛 Sibyl Veil** — confidential: inference inside an attested **TEE** (open model), + everything
  Private does. **Fails closed** (never downgrades a confidential prompt to a non-attested model).

**How it's wired** (`sibyl/inference/`): an AsyncLocalStorage context carries the mode to the single
`callModel` seam, so all agents + judge route to the right backend without threading a param. Zero-
retention = skip `recordScan`. Attestation is verified *before* any prompt is sent. API accepts
`mode`; stream emits `mode` + `attestation` events; `/api/sibyl/attestation` + `lib/sibyl/attestation.ts`
= the `verifySession / getAttestation / verifyModelHash` "verify, don't trust" surface.

**Provider = Phala** (crypto-native, managed confidential inference, OpenAI-compatible at
`inference.phala.com/v1`). Attestation adapter confirms the model is TEE-served via `/v1/models`
`is_tee` (v1); per-response receipt binding is the v2 hardening. Enterprise tier (Azure, SOC2,
confidential workspaces, reserved GPUs) = v3, demand-gated.

## Current status
- **Fast + Private modes work today, $0 setup.**
- **Confidential (Sibyl Veil)** is wired + building; configured on localhost via `.env.local`
  (Phala endpoint + key + model `qwen/qwen3.6-35b-a3b`, `PROVIDER=phala`, `ALLOW_UNVERIFIED=1` for
  the founder smoke test). Not yet on prod (prod redeploy pending).
- **Untested against real TEE end-to-end** — needs one live confidential query to confirm, then
  drop `ALLOW_UNVERIFIED` once the `is_tee` badge shows Verified.

## Roadmap (privacy layered ON TOP, never at the expense of intelligence)
- **Y1 (now):** intelligence — retrieval over the flywheel, eval harness / CryptoBench, reasoning
  depth (model-diverse council), API + agent. Privacy seam already laid (cheap).
- **Y2:** workspace + persistent memory; ship Private mode broadly (zero-retention + anon routing);
  confidential *mode* (Veil) once benchmarks are strong.
- **Y3:** enterprise/fund tier (SOC2, confidential workspaces, reserved GPUs), demand-gated.

**Priority order, unchanged:** best crypto intelligence → best benchmarks → best retrieval/reasoning
→ best proprietary dataset → verifiable privacy. Privacy is a multiplier, never the focus.
