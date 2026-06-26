I have everything I need. The web brand facts are confirmed in the FOUNDATIONS payload (`--radius:6px`, `--accent-primary:#0077b6`), and the scaffold slop is confirmed live in the files I just read. Synthesizing now.

# Pointer Mobile — Build-Ready Design System & Screen Spec

> Single source of truth for the Pointer Mobile redesign. Resolves the DESIGN-STUDY, the anti-slop critique, the Expo-Go feasibility audit, and the wedge audit into one document. Every value is copy-pasteable. Every screen has Simple/Advanced specs, API bindings, and wedge placement. Build order keeps the demo runnable in plain Expo Go at every step until the final EAS upgrade pass.
>
> **The three things that, unfixed, guarantee "looks AI-generated" — all resolved here:** (1) radius 16-everywhere → tight 6–12 scale from the web brand; (2) ambient gradient + corner-glow on every screen → flat near-black; (3) glass-as-default-wrapper + six accent glows → one floating glass material + one earned glow per screen.

---

## 1. Design principles — the anti-slop rules

These are hard rules, not guidance. Every one resolves a specific slop tell.

1. **Radius is tight and architectural (Linear-grade), never soft.** The web brand ships `--radius: 6px`. Cards/sheets max out at 10–12px, inputs/chips at 8px, CTAs/numpad keys at 10px. `pill: 999` is reserved strictly for true pills (verdict chip, filter chips, glass nav). Pick radius *per element* from the scale — never `radius.lg` on everything. **16px-everywhere is the #1 slop signature.**

2. **The accent is Pointer Ocean, never Discord blurple.** `#0077B6` (fills) + `#00A3E0` (glow/small accent). The `#5865F2` / `rgba(88,101,242,…)` family is deleted from `theme.ts`, `Screen.tsx`, and `Glass.tsx`. Until this is gone, the app *is* the FOMO clone.

3. **Backgrounds are flat near-black. No ambient gradients, no corner glows.** Depth comes from exactly one elevation step (`bg → surface`) plus a 1px hairline. Kill the per-screen 3-stop gradient and the 260px top-glow. Apple/Linear/Phantom earn depth from one step and one hairline, never from wallpaper.

4. **Glass is a material reserved for floating-over-scroll surfaces ONLY** — the bottom nav and the sticky trade/CTA bar. Everything in the scroll flow (hero, brief, tiles, rows) is a flat `surface` rect with a hairline. Glass-as-default-wrapper is a gimmick; one floating glass is a material.

5. **Budget the glow: ONE earned glow per screen, max.** Home → the AI Daily Brief left-edge. Token → the live-price dot. Everything else (cashback strip, selected cards, verdict chip) gets a flat accent-soft *fill* or a 1px accent border — not a glow. Six glows is not restraint.

6. **Semantic color is for price and verdict only — never chrome.** Green/red are reserved for price movement and the P&L number. They are *never* button fills. Buy = accent fill; Sell = quiet outline. Two saturated semantic blocks side-by-side is casino-grade slop.

7. **Every numeral renders in Geist Mono.** RN has no `font-feature-settings`; Geist Mono's figures are tabular+lining+fixed-advance by default. This is the *only* way to get tabular figures and the only way count-up animations don't jitter. Belt-and-suspenders: also set `fontVariant:['tabular-nums']` + an explicit `fontWeight` (Android needs the weight). Non-numeric text uses proportional Geist.

8. **No emoji anywhere money or trust is discussed.** Emoji are not in the icon set. `💸`, `🎁`, "sprout/sparkle" → small Ocean accent dot or a 16px stroked vector icon. Emoji are OS-inconsistent, mis-baseline, and tonally wrong for non-custodial fintech.

9. **Icons are real vectors, never typed glyphs.** No `＋` (U+FF0B), no `‹` chevrons in `<Text>`. Use lucide-react-native (Expo-Go-safe, SVG-based) at a consistent stroke weight, optically centered.

10. **Motion is physics with a cause, never decoration.** Every spring has named params. Count-up fires ONLY on first mount and user-initiated refresh — never on a 20s background poll (background changes cross-fade the delta digit only). One celebratory moment allowed (the wallet check-ring); everywhere else motion is functional (page push, sheet drag) only.

11. **Spacing has tension, not an even grid.** Tight clusters (4–8px) for related items, big jumps (32–48px) between sections. Label-to-value = 4; within-card = 12; section-to-section = 32. The hero-to-brief gap must NOT equal the brief-to-cashback gap. Asymmetry creates hierarchy.

12. **The base is calm so the wedge can be loud.** "Restrained" applies to chrome and accent color — NOT to the differentiators. Against near-black with white text, the green cashback counter and the verdict pips are the *only* color on screen. Use that. The wedge pops; the base whispers.

13. **No build-status confessions on screen.** No "discovery throttled while testing," no "Phase 2," no literal "Chart" text. Real brand-voiced empty states with one CTA; real skeleton shimmers. Kill the lone italic.

14. **One system for insets and fallbacks.** `useSafeAreaInsets()` everywhere (no hardcoded `paddingTop:64`). Font fallback ladder (Geist → Inter → system) and optional-native shims must never white-screen.

---

## 2. Token system — copy-pasteable

### 2.1 `src/theme.ts` (full rewrite — replaces the `#5865F2` file)

```ts
// src/theme.ts — Pointer Ocean. Dark + light token-for-token mirror.
// Deletes the Discord-blurple accent. Radius scale rebuilt to web-brand 6px family.

export const dark = {
  // base
  bg:            '#070A0F', // flat app base (OLED, one notch blacker than web). NO gradient.
  bgSunken:      '#04060A', // recessed wells: inputs, numpad tray, sheet scrim, chart gutter
  surface:       '#0E141C', // cards, rows, tiles, sheets (one step up from bg)
  surface2:      '#141A24', // active chip, pressed row, numpad keys, segmented track, inner panels
  hairline:      '#1B2230', // default 1px borders, row dividers
  hairlineStrong:'#2A3242', // stronger dividers, focused input, segmented outline, scroll-thumb
  // text
  text:          '#FFFFFF', // balances, tickers, prices, headers
  textDim:       '#9AA3B2', // MC/Vol labels, 24h, meta, inactive chip text, dimmed cents (7.8:1)
  textFaint:     '#5A6473', // placeholders, disabled, dotted-leaders, timestamps (large/decorative)
  // accent — POINTER OCEAN
  accent:        '#0077B6', // CTA fills, primary action
  accentGlow:    '#00A3E0', // small accent text, links, active indicators, live dot (6.9:1 AA)
  onAccent:      '#FFFFFF', // label on #0077B6 fill (4.87:1 AA-large)
  onAccentGlow:  '#06080B', // ink on the brighter #00A3E0 fill (6.98:1)
  accentSoft:    'rgba(0,163,224,0.14)', // active-tab pill, selected chip, focus ring base
  // semantic — price + verdict ONLY, never chrome
  gain:          '#2BD98A', // up moves, +%, gain P&L, ▲ (10.8:1)
  gainSoft:      'rgba(43,217,138,0.12)',
  loss:          '#FF5E6C', // down moves, -%, loss P&L, ▼ (6.7:1)
  lossSoft:      'rgba(255,94,108,0.12)',
  danger:        '#FF7A3D', // DESTRUCTIVE ACTIONS ONLY (export key, withdraw). NOT price-down.
  // verdict (the wedge)
  verdictHealthy:  '#2BD98A', verdictHealthySoft: 'rgba(43,217,138,0.12)',
  verdictCaution:  '#FFB23E', verdictCautionSoft: 'rgba(255,178,62,0.12)',
  verdictHighRisk: '#FF5060', verdictHighRiskSoft:'rgba(255,80,96,0.12)',
  info:          '#5EBBFF', // neutral (i) affordances — kept distinct from the brand accent
} as const;

export const light = {
  bg:            '#FFFFFF',
  bgSunken:      '#EEF1F5',
  surface:       '#F6F7F9', // light themes invert elevation: surface steps DOWN from white
  surface2:      '#ECEFF3',
  hairline:      '#E2E6EC',
  hairlineStrong:'#CDD4DD',
  text:          '#0A1017', // near-black w/ brand blue cast (17.8:1)
  textDim:       '#5A6675', // 5.85:1 AA
  textFaint:     '#8A94A3',
  accent:        '#0369A1', // deepened one notch so both directions clear 5.93:1 AA
  accentGlow:    '#0369A1',
  onAccent:      '#FFFFFF',
  onAccentGlow:  '#FFFFFF',
  accentSoft:    'rgba(3,105,161,0.10)',
  gain:          '#07864F', gainSoft: 'rgba(7,134,79,0.10)',
  loss:          '#D32F3D', lossSoft: 'rgba(211,47,61,0.10)',
  danger:        '#C2521A',
  verdictHealthy:  '#07864F', verdictHealthySoft: 'rgba(7,134,79,0.10)',
  verdictCaution:  '#B06A00', verdictCautionSoft: 'rgba(176,106,0,0.10)',
  verdictHighRisk: '#C9263A', verdictHighRiskSoft:'rgba(201,38,58,0.10)',
  info:          '#0E72B8',
} as const;

export type Theme = typeof dark;

// RADIUS — rebuilt to the web brand's 6px family. Pick per element. Never lg-everywhere.
export const radius = {
  xs: 6,   // tightest cards / inner panels (the web --radius)
  sm: 8,   // inputs, chips
  md: 10,  // CTAs, numpad keys
  lg: 12,  // cards, sheets (MAX for any rect — was 16)
  pill: 999, // TRUE pills only: verdict chip, filter chips, glass nav
} as const;

// SPACING — intentional jumps, assigned by relationship not by default.
export const space = {
  xs: 4,   // label → value
  sm: 8,   // tight cluster
  md: 12,  // within-card
  lg: 20,  // comfortable block
  xl: 32,  // section → section
  xxl: 48, // hero air
} as const;
```

### 2.2 Typography — `src/type.ts`

Geist (proportional, all words) + Geist Mono (all numerals). Fallback ladder Geist → Inter → system; render gated on `fontsLoaded`.

```ts
// Load via expo-font useFonts (IS in Expo Go). Bundle Geist + Geist Mono + Inter-Variable fallback.
export const font = {
  sans:    'Geist',       // titles, body, ticker symbols (WIF, BONK), labels
  sansMed: 'Geist-Medium',
  sansBold:'Geist-Bold',
  mono:    'GeistMono',   // EVERY number: balance, price, %Δ, MC, Vol, P&L, ranks, numpad, $earned
} as const;

// The mandatory numeric style. Apply to every numeral Text.
export const numeric = {
  fontFamily: font.mono,
  fontVariant: ['tabular-nums'] as const, // no-op where already tabular; hardens iOS
  fontWeight: '500' as const,             // REQUIRED on Android for fontVariant to apply
};

// Type scale (size / weight / family / tracking)
export const type = {
  hero:      { fontFamily: font.mono, fontSize: 56, letterSpacing: -1.5, fontWeight: '600' }, // balance
  heroCents: { fontFamily: font.mono, fontSize: 32, fontWeight: '600' },                       // dimmed cents
  title:     { fontFamily: font.sansBold, fontSize: 28, fontWeight: '700' }, // screen / pane titles
  wordmark:  { fontFamily: font.sansBold, fontSize: 40, fontWeight: '800' },
  h2:        { fontFamily: font.sansBold, fontSize: 22, fontWeight: '600' },
  cardTitle: { fontFamily: font.sansBold, fontSize: 17, fontWeight: '700' },
  cta:       { fontFamily: font.sansMed,  fontSize: 17, fontWeight: '600' },
  body:      { fontFamily: font.sans,     fontSize: 15, lineHeight: 21 },
  meta:      { fontFamily: font.sans,     fontSize: 13 },
  caption:   { fontFamily: font.sans,     fontSize: 12 },
  footnote:  { fontFamily: font.sans,     fontSize: 11, letterSpacing: 0.4 },
} as const;
```

**Fallback ladder rule:** never let a financial screen fall to a proportional-figure system font mid-session. If `GeistMono` fails to load, fall to `Inter` (which must also be bundled) before system. Gate render on `fontsLoaded`.

### 2.3 Motion — `src/motion.ts` (named springs, one source of truth)

Expo-Go path uses RN core `Animated`; EAS path swaps in Reanimated 3 worklets at the same params.

```ts
// Named springs so two engineers ship the same feel. Reanimated mirrors these exactly.
export const spring = {
  page:    { damping: 22, stiffness: 240, mass: 1 },   // onboarding pager push, route push
  sheet:   { damping: 26, stiffness: 220, mass: 1 },   // bottom-sheet slide-up
  press:   { damping: 18, stiffness: 320, mass: 0.8 }, // button press-in/out scale (0.97)
  celebrate:{ damping: 14, stiffness: 180, mass: 1 },  // wallet check-ring scale-in (the ONE celebratory moment)
} as const;

export const timing = {
  countUp:  650,  // balance/cashback count-up — first mount + user refresh ONLY
  crossfade:220,  // background-poll value change: cross-fade the delta digit, no count-up
  chip:     180,
} as const;
```

**Motion discipline:** count-up = first mount + user-initiated refresh only. The 20s background poll cross-fades the changed digit (`timing.crossfade`), it does NOT re-run count-up. The check-ring scale-in (`spring.celebrate`) is the only celebratory motion in the app.

---

## 3. Component kit

Each component lists its file. Components in the scroll flow are flat `surface` rects; only nav and sticky bars use `Glass`.

| Component | File | Spec |
|---|---|---|
| **theme tokens** | `src/theme.ts` | Section 2.1 (REWRITTEN — deletes `#5865F2`). |
| **type tokens** | `src/type.ts` | Section 2.2 (NEW). Geist + Geist Mono, `numeric` style. |
| **motion tokens** | `src/motion.ts` | Section 2.3 (NEW). Named springs. |
| **optional-native shim** | `src/native/optional.ts` | NEW. `try/catch require` for haptics/reanimated/skia/glass → exports `{ Haptics, Reanimated, Skia, hasReanimated, hasSkia, hapticTap() }` with no-op fallbacks. Components branch once, centrally. **This is what keeps the Expo Go demo alive.** |
| **Screen** | `components/Screen.tsx` | RETHEMED: delete the 3-stop gradient + 260px glow. Flat `bg #070A0F`. `useSafeAreaInsets()` for top inset (no `paddingTop:64`). |
| **Glass** | `components/Glass.tsx` | RETHEMED + RESTRICTED: hairline/top-highlight tinted Ocean `rgba(0,163,224,0.12)` (not pure-white). Used ONLY by nav + sticky bars. Keeps its `try/catch expo-glass-effect → expo-blur` fallback. Radius → `radius.lg` (12) max. |
| **AiVerdictChip** | `components/AiVerdictChip.tsx` | KEEP logic. Retheme to verdict tokens (`verdictHealthy/Caution/HighRisk` + their soft fills; map `high_risk`). **ADD a `pip` variant** (`expandable={false}`, 8px colored dot, no label) for ambient use on every token row. Soft *fill* + 1px border, NOT a glow. |
| **Icon** | `components/Icon.tsx` | NEW. Wraps lucide-react-native (SVG, Expo-Go-safe) at consistent stroke. Replaces all typed `＋`/`‹` glyphs. |
| **Logo** | `components/Logo.tsx` | NEW. `<Image>` of `pointer-bird-transparent.png` (zero-risk in Expo Go) OR rn-svg from `logo-bird.svg`. Pure-white origami mark. |
| **StickyCTA** | `components/StickyCTA.tsx` | NEW. Full-width accent `#0077B6` fill, `onAccent` label, `radius.md` (10), `type.cta`. Press-scale 0.97 via `spring.press`; `hapticTap()` through the shim. |
| **MoneyText** | `components/MoneyText.tsx` | NEW. The balance/cashback renderer. ONE `<Text>` with nested spans for baseline-correct dimmed cents (color change only — NO `marginTop` hacks). Geist Mono + `numeric`. Count-up via `Animated` per motion rules. |
| **DottedLeaderRow** | `components/DottedLeaderRow.tsx` | NEW. Label … value row (FOMO's About pattern). Value in Geist Mono. For the four numeric token stats — replaces the even tile grid. |
| **StatusRow** | `components/StatusRow.tsx` | NEW. Full-width categorical safety row: colored status dot + label + state (e.g. "LP · Locked", "Mint authority · Revoked"). For the two *risk-bearing* signals, sits directly under the verdict chip as its evidence. |
| **SegmentedControl** | `components/SegmentedControl.tsx` | NEW. `surface2` track, `radius.sm`, active = `accentSoft` fill + white label. Buy/Sell, timeframes. |
| **FilterChip** | `components/FilterChip.tsx` | NEW. `radius.pill`, `surface` idle / `accentSoft` + `accentGlow` border active. |
| **ProgressBar** | `components/ProgressBar.tsx` | NEW. Thin top fill bar (Linear-style) — replaces the 4 free-floating onboarding dots. |
| **Sheet** | `components/Sheet.tsx` | NEW. Expo Go: `Modal` + `Animated` slide-up (`spring.sheet`) + tap-scrim-dismiss + a visual (non-draggable) drag handle. EAS: swaps to `@gorhom/bottom-sheet` finger-tracked. |
| **ExperienceCard** | `components/ExperienceCard.tsx` | NEW. Large single-select mode card. Selected = `accentSoft` fill + 1.5px `accentGlow` border + check. NO auto-advance. |
| **Disclosure** | `components/Disclosure.tsx` | NEW. Collapsed expander row (chevron Icon + `textFaint` label) for all progressive-disclosure ("Advanced sign-in", "What's the difference?", "Wallet details", "Show full risk breakdown"). |
| **Numpad** | `components/Numpad.tsx` | NEW. Custom 1-9/./0/⌫ keys, `surface2` fill, `radius.md`. Digits Geist Mono. Pure `Pressable`. |
| **endpoints** | `src/api/endpoints.ts` | ADD `authSync()`, `syncWallets()`, `completeOnboarding()`, `applyReferral(code)`, `getReferralCode()`. All guarded `if (!auth.demo)`. |
| **auth** | `src/auth/index.tsx` | EXTEND `AuthState` with `loginWithOAuth('google'\|'twitter')`. Demo stubs it. Privy stub pattern (metro alias) preserved exactly. |

---

## 4. Screens — Simple / Advanced, API, wedge

Shared rules: `useSafeAreaInsets()` top inset; 20px horizontal padding; content scrolls under the floating glass nav with ~120px bottom padding; one accent (`#0077B6` fills / `#00A3E0` small accent + links); all numerals Geist Mono; flat `bg`; one earned glow per screen; no emoji.

### 4.1 Onboarding + Privy Login — `screens/OnboardingScreen.tsx` (replaces `LoginScreen.tsx`)

4 progressive panes on one route, gated before the tab navigator. Horizontal pager, `spring.page` push. **Indicator = thin top ProgressBar that fills (not 4 floating dots).** `hapticTap()` on each advance.

**Pane 1 — Brand/Value (Simple):** white `Logo` (~64px) centered, flat `bg` (no gradient). Wordmark "pointer." `type.wordmark`. Tagline `type.h2` white 2 lines: "See what you're buying." / "Half your fees back." Sub `type.body textDim`: "Trade Solana tokens with an AI safety check on every coin. Non-custodial — your keys, your wallet." **Wedge teaser:** a static 3-pip `AiVerdictChip` legend (healthy/caution/high-risk dots) paired with "an AI safety check on every coin" — no API call (no mint). Sticky `StickyCTA` "Get started"; faint "Already have an account? Sign in" → Pane 2.

**Pane 2 — Privy Login (Simple):** back-chevron Icon. `type.title` "Create your account", sub "30 seconds. No seed phrase to write down." Email field (`surface2` fill, `hairlineStrong` border, `radius.sm`) + `StickyCTA` "Continue with email" → `auth.sendCode`; on success the field morphs in place to 6-digit Geist Mono code entry (auto-advance) → `auth.verifyCode`. Errors in `loss` 13px. Divider `hairline` + "or". Two `SocialButton`s (`surface` fill, `hairline`, 52px, Icon-left): "Continue with Google" / "Continue with X" → `auth.loginWithOAuth`. Footer `type.footnote textFaint` with Terms/Privacy as `accentGlow` links. On success: inline "Setting up your wallet…" shimmer while sync chain runs → springs to Pane 3.
**Advanced (Pane 2):** collapsed `Disclosure` "Advanced sign-in" → "Connect an existing wallet" (Phantom/external Solana, external-before-embedded ordering) + "I have a referral code" field → `POST /api/referrals/apply`.

**Pane 3 — Experience question (Simple — the load-bearing pane, the wedge's UX entry point):** `type.title` "How do you trade?", sub "We'll tune the app to you. Change it anytime in Settings." Two stacked `ExperienceCard`s (~96px, `radius.lg`): Card A → SIMPLE ("I'm new to crypto" / "Clean and guided. We show you an AI safety check before every buy."); Card B → ADVANCED ("I'm experienced" / "Degen mode. Full risk panels, holder breakdowns, KOL flow, slippage and limit orders."). Selected = `accentSoft` fill + 1.5px `accentGlow` border + check. **Single-select, deliberate — NO auto-advance; `StickyCTA` "Continue" confirms.** Writes `pointer.mode` to `expo-secure-store`. This selection IS the wedge's disclosure-level decision (Simple = verdict stays one calm chip; Advanced = risk panel disclosed by default later).
**Advanced (Pane 3):** `Disclosure` "What's the difference?" → 2-col Simple-vs-Advanced micro table (risk panel always-open, top-10 holders, KOL/copy-trade, candlesticks, slippage/priority presets, limit orders) — teaches the progressive-disclosure model. Choosing Card B surfaces a "Default trade settings" mini-row (slippage 1%/3%/5%, MEV on/off) → pre-seeds `POST /api/presets {slot:1}`.

**Pane 4 — Wallet/Cashback confirm (Simple — the wedge made concrete):** `accentGlow` check-ring scale-in (`spring.celebrate` — the one celebratory moment). `type.title` "You're in.", sub "Your Solana wallet is ready. It's non-custodial — only you control it." One calm stat: "Wallet" `textDim` + truncated address (Geist Mono, `So1a…D4f2`) + copy Icon. **Cashback wedge card** (`surface`, `radius.lg`, 1px `accentGlow` border — the screen's one earned accent surface): title "Half your fees, back to you", body "50% cashback on every trade. Plus 30% of your friends' fees when they join." — **the `50%`/`30%` numerals render in Geist Mono** (`numeric`). If `GET /api/referrals/code` resolved, show the user's own code + copy/share. If a referral was applied, a `gain`-green "Referral applied ✓" line. `StickyCTA` "Start trading" → `POST /api/me/onboarding` → routes into Home.
**Advanced (Pane 4):** `Disclosure` "Wallet details" → full Solana address, EVM address, network = Solana mainnet, "Export key later in Settings" note in `danger` orange.

**API sequence:** boot reads `GET /api/me` → if `onboardingCompletedAt == null` show this screen. After Privy auth: `POST /api/auth/sync` (Bearer Privy JWT, idempotent on privy_id) → `POST /api/wallets/sync-privy` (provisions Solana primary) → optional `POST /api/referrals/apply` / `GET /api/referrals/code` / `POST /api/presets` → Pane 4 CTA `POST /api/me/onboarding`. **`me/onboarding` 403s `user_not_synced` if `auth/sync` hasn't run — sequence is strict.**
**Demo:** Privy fully stubbed (`metro.config.js` alias). Email/OTP/social animate but no-op-resolve → canned "Setting up your wallet…" shimmer → advance. All API guarded `if (!auth.demo)`. Pane 3 works fully real (pure client state → secure-store). Pane 4 shows the canned `Demo111…` address + static `50%`/`30%` + demo referral code. AiVerdictChip teaser uses its 3 hardcoded states.

### 4.2 Home — `screens/HomeScreen.tsx` (FUNDED / EMPTY)

> **The wedge is currently absent here — this is the #1 build priority.** The AI Daily Brief, the ambient verdict pips, and a *living* cashback counter must be built, not bolted-on prose.

**Header row:** left = white `Logo` origami mark (~26px, the only brand chroma besides the accent). Right = Deposit `StickyCTA` pill — loud accent in EMPTY; de-emphasized (`hairline` border, white label) in FUNDED.

**FUNDED (Simple), top-to-bottom with *contrasted* spacing:**
1. **Balance hero** — flat on `bg`, NOT a card (the expensive move is type, not chrome — strip the scaffold's Glass wrapper). Label "Balance" `textDim` 13px. **`MoneyText`**: hero `$1,240` in `type.hero` white + `.50` in `type.heroCents` `textDim` — baseline-correct nested spans, **no `marginTop` hacks**, Geist Mono so count-up doesn't jitter. Count-up on mount/user-refresh only. Sub-row: 24h delta Geist Mono `gain`/`loss` with ▲/▼. **Generous air above (`space.xxl`), tight sub-row below (`space.xs`)** — asymmetry = hierarchy.
2. **Cashback living counter** (wedge — promoted from footnote): directly under the balance, a Geist Mono `gain`-green line `+$3.42 cashback today`, count-up animated, ticks after trades. *Realized, not advertised.* This is the 2x-FOMO flex made native.
3. **Action row:** "Add funds" (accent `#0077B6` fill → Apple-Pay sheet) + "Trade" (`surface2` fill, `hairline` → Pulse tab). `radius.md`.
4. **AI Daily Brief card** (THE wedge, top-of-fold — must be built): `surface`, `radius.lg`, `hairline`, **the screen's one earned glow = a soft `accentSoft` left-edge**. Header: `accentGlow` dot + "Pointer AI · Today" white + `textFaint` timestamp. 1–2 sentence plain-English brief synthesizing holdings + market ("SOL leads majors +4% while your BONK cooled. One holding flagged Caution — tap to review."). Inline tappable `AiVerdictChip` mini-badges for flagged holdings → token screen; if none flagged, one "All holdings look healthy" healthy chip. *This is the daily-open habit FOMO's static Recap can't win.*
5. **Holdings list:** token rows, each with an **ambient verdict pip** (`AiVerdictChip` `pip` variant, 8px dot in the right gutter) next to raw MC/Vol/%Δ. The repeated pip = the wedge made ambient (seen 50x more than the detail panel).
6. **Cashback strip** — restrained ONLY as chrome: a thin `surface` banner, small Ocean accent dot (no emoji), "50% fee cashback + 30% referral." Accrued $ in `gain` Geist Mono if any.

**EMPTY (Simple):** brand-voiced shell (NOT a build confession) — short headline + one loud Deposit `StickyCTA`. Real copy, single CTA.

**Advanced (Home):** holdings rows expand to show per-token allocation %, cost basis, realized/unrealized P&L (Geist Mono, `gain`/`loss` on the *number* only). AI brief gains a "View full market read" `Disclosure`.

**API:** `GET /api/me` (balance/holdings), AI brief from the holdings-synthesis endpoint, `GET /api/referrals/code` for the cashback figure. **Demo:** real public data + canned holdings; cashback counter shows a static demo value; AI brief uses canned copy.

### 4.3 Token — `screens/TokenScreen.tsx`

**Order (Simple), top-down:**
1. **Header:** back Icon, ticker (proportional Geist) + price (Geist Mono).
2. **Chart** — `react-native-svg` `<Path>` line, trend-colored stroke (`gain`/`loss`), **the screen's one earned glow = a layered translucent `<Circle>`/`<RadialGradient>` at the live-price dot** in `accentGlow`. Real skeleton shimmer while loading — never the literal word "Chart". `SegmentedControl` timeframes.
3. **Verdict chip** — `AiVerdictChip` (full, expandable) directly above the trade action. The un-FOMO-able moment.
4. **StatusRow ×1–2** — the two *risk-bearing* categorical signals (LP Locked/Unlocked, Mint authority Active/Revoked) as a full-width row with colored status dot, directly under the verdict — they *are* the verdict's evidence. **Break the even 6-tile grid.**
5. **DottedLeaderRow ×4** — the four numeric stats (Liquidity, Holders, Volume, Age) as a dotted-leader list, values in Geist Mono. Not tiles.
6. **Trade action** — **ONE primary: "Buy" = accent `#0077B6` fill.** "Sell" = quiet `surface2` outline, or hidden until the user holds the token. **Never two saturated green/red fills.** Reserve `gain`/`loss` for the P&L number only. The trade bar is sticky → uses `Glass`.

**Simple→Advanced bridge (wedge):** under the verdict chip, a single collapsed `Disclosure` "Show the full risk breakdown ›" (`accentGlow` text). Tapping previews Advanced inline (top-10 holders, liquidity depth, KOL flow) — makes Simple feel like a *choice* and exposes "the receipts FOMO buries in About."

**Advanced (Token):** risk panel always-open; top-10 holder breakdown + concentration bar; KOL/copy-trade feed; candlesticks + indicators; slippage/priority-fee presets; limit orders.

**API:** `explainToken(mint,'fast')` (cached server-side; `AiVerdictChip` already wired), token stats/holders/chart endpoints. **Demo:** `AiVerdictChip` uses `DEMO_VERDICT`; chart/stats from canned public data.

### 4.4 Apple Pay / Fund — `screens/FundScreen.tsx`

Custom `Numpad` (1-9/./0/⌫, Geist Mono digits, `surface2` keys `radius.md`). Amount display Geist Mono hero (reuses `MoneyText`). Solana-first: no 6-network selector (the friction win, not sold as a "feature"). Sticky pay bar uses `Glass` + accent CTA. Quick-amount `FilterChip`s ($25/$50/$100). All pure RN + `Animated` — 100% Expo Go. **Demo:** no real money path; preserved exactly per the lock.

### 4.5 Pulse / Profile / Settings / Referrals (binding rules)

- **Pulse (discovery):** token rows each carry the ambient verdict **pip** + raw MC/Vol/%Δ — a column of green/amber/red safety pips down the gutter is the wedge made ambient. `ScrollView horizontal` filter chips. No "discovery throttled" confession — real empty state.
- **Profile:** referral share (`GET /api/referrals/code`, `feeShareBps`). Empty chart → faint sine-wave skeleton (rn-svg), not text.
- **Settings:** the Simple/Advanced toggle (reads/writes the same `pointer.mode` secure-store key as the header pill); white-theme toggle (flips `dark`↔`light` token set live); "Export private key" in `danger` orange.
- **Referrals:** the 30% framed as a living earned number in `gain` Geist Mono, not static "🎁 Earn" copy — typographic treatment, no emoji.
- **Nav (`App.tsx`):** floating `Glass` 5-tab bar (the one true glass material). Replace the typed `＋`/`‹` glyphs with vector `Icon`s. Center action defined (brand mark or Trade), not an arbitrary `＋`.

**Schema gap to flag to backend:** `users` table has no mode column. For v1, `pointer.mode` is client-local (secure-store) + opportunistic mirror via the profile upsert. If server-authoritative mode is wanted, add `users.experience_mode ('simple'|'advanced')`.

---

## 5. Build order — design-system first, hero screens next, Expo Go runnable at every step

> Each step ends with: **"Expo Go still launches and shows the redesign."** Nothing requires leaving Expo Go until Step 8. Hero screens (Home, Token, Apple Pay) come right after the foundation.

1. **Theme + type + motion tokens (Expo Go).** Rewrite `src/theme.ts` (delete `#5865F2`/`rgba(88,101,242,…)`, install Pointer Ocean + the 6–12 radius scale + tension spacing). Add `src/type.ts` (Geist + Geist Mono via `expo-font`, the `numeric` style, Inter→system fallback ladder) and `src/motion.ts` (named springs). Wire the Geist-Mono-for-all-numbers rule. **Demo runs.** *Kills the most-cited slop: the blurple accent + the radius tell.*
2. **Logo + primitives (Expo Go).** `components/Logo.tsx` (`<Image>` `pointer-bird-transparent.png`), `components/Icon.tsx` (lucide). Build `StickyCTA`, `MoneyText`, `ProgressBar`, `SegmentedControl`, `FilterChip`, `DottedLeaderRow`, `StatusRow`, `Disclosure`, `Numpad` — all plain RN. **Demo runs.**
3. **De-slop the shared chrome + shim (Expo Go).** Retheme `Screen.tsx` (delete gradient + glow → flat `#070A0F`, `useSafeAreaInsets()`). Restrict + retheme `Glass.tsx` (Ocean hairline, nav/sticky-bars only, `radius.lg` max). Add `src/native/optional.ts` (try/catch requires → capability flags + no-op `hapticTap`). **Demo runs** (all native flags false, fallbacks active).
4. **Motion via core `Animated` (Expo Go).** Onboarding pager (`spring.page`), `MoneyText` count-up (mount/refresh only), check-ring scale-in (`spring.celebrate`), `Sheet` slide-up. Haptics through the shim (no-op in Go). **Demo runs, motion visible.**
5. **Hero screen 1 — Home, with the wedge built (Expo Go).** Strip the Glass hero wrapper; build the flat balance hero (`MoneyText`), the **living cashback counter**, the **AI Daily Brief card** (one earned left-edge glow + inline verdict chips), holdings rows with **ambient verdict pips**. Add the `pip` variant to `AiVerdictChip`. **Demo runs — the daily-open screen wins.**
6. **Hero screen 2 + 3 — Token + Apple Pay (Expo Go).** Token: `react-native-svg` chart + live-dot glow (no Skia), verdict chip, `StatusRow` evidence, `DottedLeaderRow` stats, single accent Buy + quiet Sell, "Show full risk breakdown" disclosure. Fund: custom `Numpad`, Solana-first, sticky Glass pay bar. **Demo runs — the money-shot screens, no Skia needed.**
7. **Remaining screens + white theme + verification (Expo Go).** Onboarding 4-pane, Pulse (ambient pips), Profile/Settings/Referrals. White-theme toggle flips the token set live. Verify fallback ladders (font fail, missing-native) never white-screen; kill every emoji/italic/build-confession. **Full redesign demo-able in plain Expo Go — SHIP THIS to the founder to SEE.**
8. **EAS dev-build upgrade pass (leaves Expo Go).** See Section 6.

---

## 6. What needs an EAS dev build later (capability upgrade, not a rewrite)

The seam between Step 7 and Step 8 is the whole point: the founder sees the complete visual redesign in Expo Go, and the dev build flips capability flags — same screens, premium path swapped in automatically via the Step-3 shim.

| Feature | Native module | Not in Expo Go SDK54 → upgrade unlocks |
|---|---|---|
| Worklet 120fps springs, gesture-linked sheet | `react-native-reanimated` + `react-native-gesture-handler` | Replaces core `Animated`; finger-tracked `@gorhom/bottom-sheet` replaces the tap-dismiss `Sheet` |
| Skia chart glow, gradient-along-path trend stroke, dotted-grid shader | `@shopify/react-native-skia` | Replaces the rn-svg chart with true radial-blur glow + 60fps pan/zoom |
| iOS 26 Liquid Glass nav | `expo-glass-effect` | `Glass.tsx` already falls back to `expo-blur`; flag flips to real GlassView |
| Real haptics on advance/Buy/confirm | `expo-haptics` | **Gone from Expo Go SDK54** — every call already shimmed; flag flips to real thunk |
| Real Privy email-OTP / Google / X / external wallet | `@privy-io/expo` | Already stubbed via `metro.config.js` alias; real auth + money paths |
| FaceID gate | `expo-local-authentication` | Out of demo scope; dev-build only |

**The trap to never trigger:** do NOT add reanimated / skia / gesture-handler / haptics to `package.json` while the Expo Go demo is wanted — Metro bundles the import regardless of runtime flags and Expo Go red-screens instantly. The Expo Go demo uses ONLY Expo-Go-bundled modules (`Animated`, `expo-blur`, `expo-linear-gradient`, `react-native-svg`, `expo-font`, `expo-secure-store`, `expo-web-browser`). Every dev-build-only lib stays behind a `try/catch require` + capability flag in `src/native/optional.ts`. At Step 8: `npx expo install --fix` (the `*` versions + `.npmrc legacy-peer-deps=true` are set up for exactly this).

**The RN-permanent constraint (not an Expo Go issue):** there is no `font-feature-settings` in React Native on any build. Geist Mono for all numerals + `fontVariant:['tabular-nums']` is the *only* mechanism for tabular figures — identical in Expo Go and the dev build. Code it from Step 1.

**Locked decisions preserved:** demo mode + economics untouched; Privy stub/metro-alias pattern kept exactly; Packs absent from iOS; Solana-first; 50% cashback / 30% referral; per-user Simple/Advanced flag in `expo-secure-store` (`pointer.mode`).