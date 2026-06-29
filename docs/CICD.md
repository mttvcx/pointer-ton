# CI/CD (Phase 1 · Mission 4)

> **Activation note:** the workflow YAMLs are committed under
> [`ci/workflows/`](../ci/workflows/) instead of `.github/workflows/` because the
> authoring git token lacked the GitHub `workflow` OAuth scope. Move them into
> `.github/workflows/` (one `git mv` + a push with `workflow` scope) to activate —
> see [`ci/workflows/README.md`](../ci/workflows/README.md).

## What ships

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `ci.yml` → `.github/workflows/` | PR + push to `main` | Quality gate — blocks broken code from reaching `main` |
| `deploy-health.yml` → `.github/workflows/` | push to `main`, every 15m, manual | Post-deploy + ongoing production health probe |

## The quality gate (`ci.yml`)

Runs on `ubuntu-latest`, Node 20 (matches `engines: >=20`), one `verify` job:

1. **Install** — `npm install --legacy-peer-deps --include=dev` (mirrors Vercel).
2. **Env contract** — `npm run validate:env:schema` (validates the env contract
   shape; no secrets needed in CI).
3. **Migrations** — `npm run check:migrations` (empty files / conflict markers /
   unterminated DDL in `scripts/*.sql`).
4. **Typecheck** — `tsc --noEmit` (strict). `pointer-remotion/**` is excluded in
   `tsconfig.json`.
5. **Lint** — `eslint`.
6. **Test** — `npm test` (the full `node --test` suite).
7. **Build** — `next build` with **placeholder env** (see below).

`concurrency` cancels superseded runs per ref. **Enable branch protection** on
`main` requiring the `verify` job so a red run blocks merge — that is the "don't
let broken builds reach production" guarantee.

### Build env

The build step sets placeholder env values (not secrets) so `next build` can
resolve build-time env reads. Real values live in Vercel for runtime and in the
deploy preflight. If the build ever needs a value the placeholders don't cover,
add it to the `Build` step `env:` (placeholder) or as a GitHub Actions secret.

## Environment validation

The contract is a single pure, unit-tested source of truth:
`lib/env/required.ts` (`ENV_GROUPS` — required vs recommended, with `anyOf`
alternates for renamed keys).

- `npm run validate:env` — **deploy preflight**: exits non-zero if any REQUIRED
  group is missing; warns on recommended. Run this against the real environment
  before/at deploy.
- `npm run validate:env:schema` — **CI**: validates the contract shape only.

Keep `ENV_GROUPS` in sync with what the app reads.

## Deploy model & rollback

Deploys are performed by **Vercel's git integration** (`vercel.json`
`git.deploymentEnabled: true`), not by GitHub Actions — so CI gates *code* and
the health workflow verifies the *running* app.

- **Preview deployments**: Vercel builds every PR/branch automatically.
- **Production**: promoted on merge to `main` by Vercel.
- **Post-deploy health**: `deploy-health.yml` probes `/api/health` (liveness) and
  `/api/emergency/status` (maintenance/read-only) ~90s after a push and every
  15m. Set the repo variable `POINTER_PRODUCTION_URL` to enable it; unset = no-op.
- **Rollback**: Vercel dashboard → Deployments → promote the previous green
  deployment to production (instant; no rebuild). Because emergency controls live
  in Redis (Phase 0.1), an incident can also be mitigated *without* a redeploy by
  toggling maintenance / kill switches.
- **Deployment failure alerts**: a red `ci.yml` blocks merge; a red
  `deploy-health.yml` surfaces a production regression. Wire either to
  Slack/Discord via the repo's notification settings or the Mission 5 alerting
  layer.

## Health probe

`scripts/health-check.ts` — `POINTER_HEALTH_URL=… node --import tsx
scripts/health-check.ts`. Exits non-zero if liveness is down or the app reports
maintenance. Used by `deploy-health.yml`; runnable locally against any
environment.

## Tests

`lib/env/required.test.ts` — required/recommended resolution, `anyOf` alternates,
empty-value handling, contract well-formedness.

## Notes / tradeoffs

- **Node 20** in CI matches the declared `engines` floor and is conservative;
  Vercel's runtime default is newer (24 LTS). Bump `node-version` to match prod
  once verified, to catch version-specific issues earlier.
- GitHub Actions can't gate Vercel's git-triggered deploy directly; the gate is
  branch protection on `main` + the post-deploy probe. For hard pre-promotion
  gating, switch to CLI deploys (`vercel deploy --prebuilt`) driven by a workflow.
