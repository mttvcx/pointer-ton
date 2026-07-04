# Pointer Extension

The official, first-party Pointer browser extension. Crypto intelligence everywhere
you browse — Twitter/X, DexScreener, Solscan, Pump.fun, GMGN, Axiom, Photon, BullX,
GitHub, and any project site.

> Read **[ARCHITECTURE.md](./ARCHITECTURE.md)** first — it's the foundation: the
> decisions, structure, security model, auth handshake, and the phased plan.

## Status

**Phase 0 — foundation (scaffolded).** Build framework (WXT + React + Tailwind),
the adapter pattern, deterministic entity detection, the design-token bridge, the
Pointer API client + scoped-token auth design, the background broker, and a Twitter
proving slice. The rich cards + the `/api/ext/*` facade in pointer-ton are Phase 1+.

This folder is isolated from the Next app: its own `package.json` + `tsconfig`, and
it's excluded from the root pointer-ton build.

## Develop

```bash
cd pointer-extension
cp .env.example .env          # set VITE_POINTER_API_BASE
npm install                   # wxt prepare runs on postinstall
npm run dev                   # loads an unpacked dev build (Chrome)
npm run build                 # production build → .output/
npm run compile               # typecheck
```

Load `.output/chrome-mv3` as an unpacked extension at `chrome://extensions`.

## Layout

- `src/entrypoints/` — background service worker + per-site content scripts.
- `src/adapters/` — one file per supported site (the extensibility seam).
- `src/pointer/` — the ONLY bridge to Pointer (`client` → background broker →
  `/api/ext/*`), plus scoped-token `auth`.
- `src/lib/detect.ts` — deterministic CA / wallet / handle detection (hot path).
- `src/ui/` — Pointer design tokens + shadow-DOM cards.

## Security

No remote code, no `eval`, strict CSP, closed Shadow DOM, host HTML never trusted,
read-only by default, scoped + revocable auth token. See ARCHITECTURE.md §6–7.
