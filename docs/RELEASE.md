# Release Infrastructure (§4 Canary · §11 Release)

How Pointer ships safely. Builds on the CI/CD gates (Mission 4 — `docs/CICD.md`),
emergency controls (Phase 0.1), and the deploy-health probe.

## Versioning

- `NEXT_PUBLIC_POINTER_VERSION` (semver) is the human version; the deploy identity
  (commit, branch, env) is surfaced at **`GET /api/version`** for post-deploy
  verification and rollback correlation.
- Bump the version on each production release; tag the commit.

## Release flow (the achievable pre-extension bar)

```
push → CI gate (typecheck/lint/test/build/env/migrations)   ← blocks merge on red
     → Vercel preview deploy (every PR/branch)
     → merge to main → Vercel production deploy
     → deploy-health probe (+90s and every 15m): /api/health + /api/emergency/status
     → smoke test (npm run smoke <url>): version + liveness + status
     → red probe/smoke → ALERT + roll back
```

## Canary / progressive rollout — status

Target: staging → smoke → 5% → 15% → 30% → 100% with auto-rollback on
error/latency/RPC/money-path spikes.

**True %-traffic splitting requires Vercel Rolling Releases (Pro/Enterprise).**
Per `DEFERRALS.md` (D3), if that tier is enabled, turn it on and gate promotion on
the deploy-health signal — no code change. If not, the **documented production
equivalent** is the flow above: staging + smoke + health-gated promote + 1-click
rollback. Either way, an incident can be mitigated **without a redeploy** by
toggling the Redis-backed emergency kill switches / maintenance (Phase 0.1).

## Rollback

- **Instant:** Vercel dashboard → Deployments → promote the previous green
  deployment (no rebuild). Correlate with `/api/version`.
- **Redeploy-free mitigation:** `/admin/emergency` — pause trading/AI/packs,
  per-chain, maintenance, or read-only. Live in ~5s.
- **Self-heal:** `/admin/selfheal` — safe auto-repair (observe-only by default).

## Migration safety

- Migrations are forward-only, reviewed SQL in `scripts/*.sql`, applied via the
  Supabase SQL editor (or the MCP) — never auto-applied by a deploy.
- `npm run check:migrations` (in CI) guards empty files / conflict markers /
  unterminated DDL.
- Money-table migrations preview duplicates before any DELETE and are idempotent
  (`IF NOT EXISTS`); see `scripts/money-idempotency-indexes.sql`.

## Feature flags & kill switches

- Emergency kill switches + maintenance + read-only: Phase 0.1 (`/admin/emergency`).
- AI access enforcement: `AI_ACCESS_ENFORCED` (`docs/AI_ACCESS.md`).
- Self-heal execution: `SELFHEAL_ENABLED` (observe-only default).
- Provider cutoffs: `/admin/providers`.

## Health verification

- `GET /api/health` (liveness), `GET /api/emergency/status` (maintenance/read-only),
  `GET /api/version` (deploy identity), `GET /api/admin/ops/health` (full snapshot,
  admin) and the Pointer Doctor (`/admin/ops`).
- `npm run smoke <url>` runs the post-deploy smoke test (version + liveness +
  status); wired into the deploy-health workflow.

## Remaining

- Enable Vercel Rolling Releases for the %-split (D3) when the plan allows.
- Auto-promote/auto-rollback driven by the health signal (currently health is a
  red/green probe; promotion is manual).
