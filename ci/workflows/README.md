# CI workflows (staged)

These GitHub Actions workflows live here **only because the commit was authored
with a git token lacking the GitHub `workflow` OAuth scope** — GitHub refuses to
push files under `.github/workflows/` without it. They are otherwise final.

## Activate them (one step)

Move both files into `.github/workflows/` and push with a token that has the
`workflow` scope (or do it from the GitHub web UI):

```bash
mkdir -p .github/workflows
git mv ci/workflows/ci.yml          .github/workflows/ci.yml
git mv ci/workflows/deploy-health.yml .github/workflows/deploy-health.yml
git commit -m "Activate CI workflows"
# refresh scope if needed:  gh auth refresh -s workflow
git push
```

Then enable branch protection on `main` requiring the **verify** job, and set the
repo variable `POINTER_PRODUCTION_URL` to enable the health probe.

See [docs/CICD.md](../../docs/CICD.md) for the full pipeline description.
