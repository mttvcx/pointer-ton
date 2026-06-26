# Design critiques (anti-slop / feasibility / wedge)

## Anti-slop
This is a critical, load-bearing finding. The web brand's `--radius` is **6px** — tight, architectural, Linear-grade. The entire mobile design study and scaffold use 12–16px radii everywhere. That is one of the single biggest "AI-slop" tells and the design study never caught it. I have everything I need.

---

# ANTI-AI-SLOP CRITIQUE — Pointer Mobile

I read the full DESIGN-STUDY.md, the live scaffold (`theme.ts`, `App.tsx`, `Screen.tsx`, `Glass.tsx`, all 5 screens, `AiVerdictChip.tsx`), and the web brand source of truth (`app/globals.css`). The design study's color/type strategy is genuinely strong. But there are concrete, still-present slop tells — several baked into the scaffold, several baked into the *spec itself*. Harsh and specific below.

## TIER 0 — THE BRAND-CONTRADICTING SLOP (fix before anything else)

**1. Radius is wrong by 2–3x. This is the loudest slop tell on the whole app.**
`app/globals.css` line 267: `--radius: 6px`. The web brand is *tight, architectural, Linear-grade* corners — cards at 6px, pills at 9999px, nothing in between. The mobile design study and the scaffold (`theme.ts` `radius = {sm:8, md:12, lg:16, pill:999}`) use **12–16px on everything**: cards, buttons, presets, sheets. 16px-radius-everything is *the* canonical "AI generated a React Native app" signature — it's the Bootstrap-card look. The design study analyzed 22 screens and never pulled the one number (`--radius:6px`) that defines the brand's hardness.
**Fix:** Rebuild the radius scale to `{xs:6, sm:8, md:10, lg:12, pill:999}`. Cards/sheets = 10–12 max, not 16. Inputs/chips = 8. The amount numpad keys and CTA = 10. Reserve `pill:999` strictly for true pills (verdict chip, filter chips, glass nav). Hand-crafted apps pick radius per-element from a tight scale; slop uses `radius.lg` on everything.

**2. Two of three core surfaces still hardcode Discord blurple `#5865F2`.** The design study *names* this as the cardinal sin to delete — yet it's still live in:
- `theme.ts` lines 11–12: `accent:'#5865F2'`, `accentSoft:'rgba(88,101,242,0.16)'`
- `Screen.tsx` lines 16–18: the **app-wide background glow** is `rgba(88,101,242,0.18)` periwinkle. Every single screen is currently bathed in FOMO-blue. This is worse than the token file because it's ambient and on every route.
- `Glass.tsx` is clean of blurple but its hairline/tint are pure-grey `rgba(255,255,255,...)` — no Ocean cast at all.
**Fix:** The whole `#5865F2`/`rgba(88,101,242,...)` family dies in `theme.ts` AND `Screen.tsx`. Until both are swapped to Ocean `#0077B6`/`#00A3E0`, the app *is* the FOMO clone the founder fears.

**3. The "premium depth" gradient background is itself slop, and the study doubles down on it.** `Screen.tsx` stacks a 3-stop vertical gradient (`#0c1422 → bg → #070a10`) PLUS a 260px colored top-glow on *every screen*. The DESIGN-STUDY's own Home spec says **"Flat, no gradient on Home"** (and FOMO's home is flat) — so the scaffold already violates the spec. A faint full-bleed gradient + corner glow behind everything is exactly the "I asked AI to make it look premium" move. Apple/Linear/Phantom use *flat* near-black and earn depth from one elevation step + a single hairline, not ambient gradients.
**Fix:** Kill the per-screen gradient and the global glow. Background = flat `#070A0F`. Depth comes from `surface` being exactly one notch up (`#0E141C`) with a 1px `hairline`. Allow *one* accent glow only where it's earned and local: the AI Daily Brief left-edge and the verdict chip — never as an ambient backdrop.

## TIER 1 — STRUCTURAL SLOP IN THE SCAFFOLD

**4. Everything is wrapped in `<Glass>` — glass has become the default container, which reads as a gimmick, not a material.** HomeScreen wraps the hero, the promo, AND the empty state in Glass. TokenScreen wraps the chart, every one of the 6 signal tiles, the trade bar. When a frosted-blur panel is the wrapper for *every* box, the effect stops meaning "this floats above other content" and becomes wallpaper — the definition of decorative-not-intentional. Phantom uses real blur on exactly one thing: the floating nav.
**Fix:** Glass is reserved for genuinely-floating-over-scroll surfaces ONLY — the bottom nav and the sticky trade/CTA bar. Everything that sits *in* the scroll flow (hero, brief card, signal tiles, token rows) is a flat `surface` rect with a hairline. The hero shouldn't be a card at all (the study agrees: "flat on bg, the expensive move is type not chrome") — but the scaffold makes it a Glass card. Strip it.

**5. The balance hero's cents-dim is half-built and the alignment is off.** `HomeScreen` renders `$` at 28px `marginTop:8`, whole at 56px, cents at 32px `marginTop:14` — three different magic `marginTop` nudges to fake baseline alignment. That's the eyeballed-in-a-hurry look; on a different device the `$` and `.50` will drift off the baseline. And the digits are `fontWeight:'800'` system font — NOT the Geist Mono tabular figures the study mandates, so a count-up animation will *jitter horizontally* on every frame (proportional `1` vs `8`).
**Fix:** Render the whole hero in one `Text` with nested `<Text>` spans so the baseline is typographically correct, not margin-hacked. Force Geist Mono. The cents-dim should be a color change only (`text-dim`), same size step the study specifies (32 vs 56) — but anchored by real baseline alignment, not `marginTop`.

**6. The 6 signal tiles are a uniform 2-col grid of identical chrome — the "AI made a dashboard" tell.** TokenScreen's `signals` are six `width:'48%'` Glass boxes, all the same size, same weight, same treatment. Liquidity, Holders, Volume, Age, LP, Mint-authority all rendered with equal visual weight. That's a spreadsheet, not a hierarchy. The wedge is supposed to *interpret*, but a flat even grid says "here are 6 equal facts," which is precisely FOMO's raw-stats failure the study claims to beat.
**Fix:** Break the grid. The two *risk-bearing* signals (LP locked/unlocked, Mint authority active/revoked) are categorical safety states — promote them to a single full-width row with a colored status dot, directly under the verdict chip, since they *are* the verdict's evidence. The four numeric stats (Liq/Holders/Vol/Age) go in a dotted-leader list (the study's own "stat dotted-leader row" component, stolen from FOMO's About) — not tiles. Uneven by design = hierarchy = hand-crafted.

**7. Trade-button colors are the single worst hierarchy choice in the app.** TokenScreen paints Buy = full green fill, Sell = full red fill, side by side, equal weight. Two saturated semantic-color blocks competing is loud, casino-grade, and *exactly* what a generated trading UI does. Green/red are reserved for *price movement* per the study's own semantic discipline — using them as button fills collides the meaning. Also `tradeText` color is hardcoded `#04110b` (a near-black green-ink) on BOTH buttons, so the Sell label sits dark-on-red at poor contrast.
**Fix:** Default state = ONE primary action. "Buy" is the accent `#0077B6` fill (it's the verb the app wants). "Sell" is a quiet `surface-2` outline button, or hidden until the user holds the token. Never two full-saturation fills side by side. Reserve gain/loss color for the P&L number, not chrome.

**8. The nav `＋` and back chevrons are typed glyphs, not icons — instant amateur tell.** `App.tsx` center add is a literal `＋` (fullwidth plus U+FF0B) in a `<Text>`; back buttons across screens are `‹` characters. Typed unicode glyphs render at the OS font's whim, won't align optically, and scream "placeholder." Phantom/Linear never ship a text `+`.
**Fix:** Real vector icons (lucide-react-native / SF Symbols via expo-symbols) at consistent stroke weight, optically centered. The nav center action also needs defining — the study notes FOMO's center is the brand mark; a raw `＋` that opens Fund is an arbitrary placeholder.

## TIER 2 — SPEC-LEVEL SLOP (in the design study, before code)

**9. Emoji as UI furniture. The study litters them and they must die.** The cashback strip is spec'd as `"💸 50% fee cashback..."`; experience cards reference "sprout/sparkle" and "chart/lightning" glyphs; the referral banner is `"🎁 Earn..."`. Emoji in a fintech surface is the fastest way to look like a generated MVP — they're OS-inconsistent, mis-baseline against text, and tonally wrong for "premium/non-custodial/your-keys." FOMO uses them and it's the cheapest thing about FOMO.
**Fix:** Zero emoji anywhere money or trust is discussed. The cashback strip uses a small Ocean accent dot or a 16px stroked icon, never 💸. The 🎁 referral becomes a typographic treatment. This is a hard rule to write into the design system: *emoji are not in the icon set.*

**10. The 4-dot progress indicator + "auto-advance after ~250ms" + spring-page-transition onboarding is the template pattern.** A horizontal pager with pinned dot indicators is the single most generated onboarding shell in existence. It's not wrong, but as-spec'd it has no signature. "Selecting a card auto-advances after 250ms" is also a UX trap — it removes the user's ability to reconsider and feels twitchy.
**Fix:** Drop auto-advance; selection is deliberate, Continue confirms (the study even contradicts itself offering both). For the indicator, replace dots with a thin top progress *bar* that fills (Linear-style) or, better, no indicator and let the content density imply progress. If dots stay, they should be a connected segmented line, not 4 free-floating circles.

**11. Motion is described as decoration, not physics, in several places.** "soft accent-soft left-edge glow," "subtle scale-in spring" check-ring, "count-up animation" — these are listed as *adjectives* with no spring params, no trigger discipline. "Count-up on mount AND refresh" means the balance re-animates every 20s poll (the scaffold refetches every 20s) — that's nausea-grade motion-for-no-reason. The founder's brief is "nothing moves without reason"; a balance that counts up every 20 seconds violates it.
**Fix:** Specify motion as physics with cause. Count-up fires ONLY on first mount and on a *user-initiated* refresh — never on a background poll (a background change should cross-fade the delta digit, nothing more). Every spring gets named params (e.g. `damping 18, stiffness 220`) in the design system so two engineers don't ship two different springs. The check-ring scale-in is the one celebratory moment allowed; everywhere else, motion is functional (page push, sheet drag) only.

**12. "soft accent-soft glow" appears on ~6 different cards across the spec — glow is becoming the new gradient.** AI Daily Brief left-edge glow, cashback card top glow, selected-card accent fill, wallet check-ring, verdict chip fill, glass nav light-bleed. When six surfaces all have an accent glow, the accent stops being restrained — it's ambient again, just additive instead of a backdrop.
**Fix:** Budget the glow. ONE glowing element per screen, max. On Home that's the AI Daily Brief (it's the wedge — earn it). On the token screen it's the live-price dot on the chart. The cashback strip and selected cards get a flat accent-soft *fill* or a 1px accent border — not a glow. Restraint is the brand; six glows is not restraint.

## TIER 3 — RHYTHM & DETAIL (the stuff that separates "good" from "Phantom-grade")

**13. Spacing is on a single even 4px grid with no tension.** Scaffold uses `gap:16` between every Home block, `gap:8`/`gap:10`/`gap:12` semi-randomly elsewhere, `padding:20`/`24` inconsistently. Even, undifferentiated vertical rhythm is the calling card of generated layout — everything breathes the *same* amount, so nothing has emphasis. Premium layouts use a *contrasted* scale: tight clusters (4–8px) for related items, then a big jump (32–40px) to separate sections. The hero-to-brief gap should NOT equal the brief-to-cashback gap.
**Fix:** Define a spacing scale with intentional jumps (4, 8, 12, 20, 32, 48) and assign by relationship, not by default. Label-to-value = 4. Within-card = 12. Section-to-section = 32. The balance hero should have *generous* air above and a tight sub-row below — asymmetry creates hierarchy.

**14. `paddingTop:64` / `paddingTop:56` hardcoded instead of safe-area.** HomeScreen `paddingTop:64`, Pulse/Token `paddingTop:56`, Login uses a `flex:1` spacer. These are device-specific magic numbers that will be wrong on a Dynamic Island device vs an SE. Inconsistent top insets across screens is a subtle but real "no system" tell.
**Fix:** `useSafeAreaInsets()` + a single `space(N)` token for the header offset, identical on every screen. One source of truth for top inset.

**15. The empty-state and "Phase 2" placeholder copy is shipping-as-slop.** "No tokens yet — discovery is throttled while testing," "Smart-money & KOL signal lands in the Tracker (Phase 2)," "Chart" as literal centered text in the chart box. Placeholder honesty in dev is fine, but these read like TODO comments rendered to screen. The italic "Phase 2" hint (`fontStyle:'italic'`) is the only italic in the app — a lone italic is a slop tell.
**Fix:** Empty states get real, brand-voiced copy with a single CTA, never a status-of-the-build confession. The chart placeholder gets a real skeleton shimmer (or a faint sine-wave like FOMO's profile empty), not the word "Chart." Kill the lone italic.

**16. Glass hairline is pure white at 10–14% — no brand cast, reads cold/generic.** `Glass.tsx` borders and top-highlight are `rgba(255,255,255,0.10–0.14)`. Every generated glass component uses white-at-low-alpha. A hand-tuned glass picks up the environment's color.
**Fix:** Tint the glass hairline and inner glow with a trace of Ocean (`rgba(0,163,224,0.12)` top-highlight) so the nav subtly belongs to *this* brand. This is the "glass reacting to light" the study itself called the most expensive touch — currently it's reacting to no light at all.

---

## THE THREE THINGS THAT, IF UNFIXED, GUARANTEE "LOOKS AI-GENERATED"
1. **Radius 16-everywhere** (should be 6–12 from the web brand). Biggest single tell, and the study missed it. → finding #1.
2. **The ambient gradient + corner-glow background on every screen** (should be flat). → finding #3.
3. **Glass-as-default-wrapper + six accent glows** (should be one floating glass + one glow per screen). → findings #4, #12.

Fix those three and the app stops reading as a template before a single new screen is built. Everything else is the polish that gets it to Phantom-grade.

**Files where the slop is live right now:** `apps/mobile/src/theme.ts` (#1, #2), `apps/mobile/components/Screen.tsx` (#2, #3), `apps/mobile/components/Glass.tsx` (#4, #16), `apps/mobile/screens/HomeScreen.tsx` (#4, #5, #9), `apps/mobile/screens/TokenScreen.tsx` (#6, #7, #15), `apps/mobile/App.tsx` (#8). Web source of truth confirming the radius/accent: `app/globals.css` (`--radius:6px` line 267; `--accent-primary:#0077b6` line 192).

## Expo-Go feasibility
Confirmed: `react-native-reanimated`, `react-native-gesture-handler`, `@shopify/react-native-skia`, `expo-haptics` are NOT in the lockfile at all — they are entirely absent from the project. Only `expo-font` and `react-native-svg` appear (transitively, as peer-dep declarations). There's both an SVG and PNG version of the logo-bird, which matters for the SVG-vs-Image decision.

I now have everything I need. Let me write the feasibility critique.

---

# EXPO-GO SDK54 FEASIBILITY CRITIQUE — Pointer Mobile redesign

**Verdict: the redesign is demo-able in plain Expo Go, but the spec as written reaches for at least 5 things that are NOT in Expo Go and 1 thing RN literally cannot do. None of them are blockers if you accept the fallbacks below. Two are already half-solved in the scaffold (Privy stub, Glass fallback). The single most dangerous assumption is that you can just `npm install react-native-reanimated`/`skia`/`gesture-handler` and keep running in Expo Go — you cannot; the moment those land you need an EAS dev build.**

Grounding facts I verified in the tree (not assumptions):
- `apps/mobile/package.json` deps: NO reanimated, NO skia, NO gesture-handler, NO expo-haptics, NO expo-font, NO react-native-svg as direct deps. Confirmed absent from `package-lock.json` too (only `expo-font`/`react-native-svg` appear as transitive peer declarations).
- `expo` is `^54.0.0`, RN `0.81.5` → **SDK 54** (the app.config.ts comment saying "SDK-56" is stale/wrong; trust package.json).
- The Privy-in-Expo-Go problem is **already solved**: `metro.config.js` aliases `@privy-io/expo` → `src/auth/privyStub.js` when `EXPO_PUBLIC_DEMO=1`, and `src/auth/index.tsx` lazy-requires the real Privy provider only in REAL mode. Demo mode runs zero Privy native code. Keep this exactly.
- `components/Glass.tsx` is **already** Expo-Go-safe: it `try/catch` requires `expo-glass-effect` (not in Expo Go) and falls back to `expo-blur` (IS in Expo Go). Good pattern — replicate it for every other risky dep.
- Logo exists as BOTH `public/branding/logo-bird.svg` AND `public/branding/pointer-bird-transparent.png` — this matters (see SVG below).

---

## What is NOT in Expo Go SDK54 (and the safe fallback for each)

Expo Go ships a **fixed** native binary. You only get the native modules Expo compiled into it. Anything with its own native code that isn't in that list = silent crash or red-screen in Expo Go, and forces an EAS dev build.

| Spec feature | Native module needed | In Expo Go SDK54? | Expo-Go-safe fallback for the demo NOW | Upgrades to (EAS dev build) |
|---|---|---|---|---|
| **Spring page transitions, count-up balance, check-ring scale-in, sheet drag** | `react-native-reanimated` | **NO** (not in deps, not auto-bundled; needs a Babel plugin + native) | RN core **`Animated`** API (JS-driven, `useNativeDriver: true` for opacity/transform). Springs via `Animated.spring`. Count-up via `Animated.timing` + listener. Good enough to demo the *feel*. | Reanimated 3 worklets — buttery 120fps springs, gesture-linked sheet, the "Linear/Phantom-grade" motion the lock demands |
| **Skia line chart, trend-colored stroke, radial glow at live-price dot, annotated entry/exit markers, Profile sine-wave** | `@shopify/react-native-skia` | **NO** | **`react-native-svg`** `<Path>` for the chart line + `<RadialGradient>`/`<Circle>` for the dot glow. SVG **IS** loadable in Expo Go (it's in the transitive tree). Slightly less GPU-fancy but visually 90% there. For the glow, a blurred `<Circle>` or layered translucent circles. | Skia — true radial blur glow, gradient-along-path trend coloring, dotted-grid shader, 60fps pan/zoom |
| **Floating glass nav light-bleed, cashback-card glow, iOS-26 Liquid Glass** | `expo-glass-effect` | **NO** | Already handled in `Glass.tsx` → `expo-blur` (`BlurView` IS in Expo Go) + a tinted overlay + hairline. The "colored light-bleed" = an absolutely-positioned `expo-linear-gradient` (IS in Expo Go) tinted with `accentSoft` under the active tab. | `expo-glass-effect` GlassView on iOS 26 for real Liquid Glass |
| **Haptics on advance / Buy / confirm** | `expo-haptics` | **NO in SDK54 Expo Go** (was removed from the Go bundle; not in deps) | **No-op shim**: `try { Haptics = require('expo-haptics') } catch {}` then guard every call. Demo loses the buzz, loses nothing visual. Do NOT let a bare `Haptics.impactAsync` throw. | `expo-haptics` in the dev build — every advance/Buy/confirm gets the tactile thunk |
| **Geist + Geist Mono variable fonts (the whole tabular-numerals thesis)** | `expo-font` (`useFonts`) | **YES** — `expo-font` IS in Expo Go | **Works in Expo Go.** Bundle the .ttf/.otf in `assets/fonts`, load with `useFonts`, gate render on `fontsLoaded`. **Fallback ladder must be coded** (Geist → Inter → system) so a failed load never white-screens. | Same; no change |
| **White origami pointer mark** | `react-native-svg` (if SVG) | SVG: **YES** in Expo Go | Two safe options: (a) `react-native-svg` `<Svg>` from `logo-bird.svg` (transform the file into an RN-SVG component), or (b) simplest — just `<Image>` the existing **`pointer-bird-transparent.png`**. For the demo, the PNG is zero-risk and instant. | Keep SVG for crisp scaling / the\-able fill |
| **Privy email-OTP / Google / X OAuth** | `@privy-io/expo` (+ apple-auth, passkeys, viem) | **NO** | **Already stubbed.** Demo OTP/social buttons animate and no-op-resolve (per your demoBehavior). | Real Privy in the dev build |
| **expo-secure-store (mode flag)** | `expo-secure-store` | **YES** in Expo Go | Works now. `pointer.mode` persistence is fully demo-able. | Same |
| **FaceID gate (later screens)** | `expo-local-authentication` | **NO in Expo Go** | Out of scope for the demo; stub/skip. | Dev build |

### The one thing RN simply CANNOT do (not an Expo-Go issue — a React Native issue)
The type spec's core thesis — "render every number in Geist Mono because RN has no `font-feature-settings`" — is **correct and load-bearing**. `<Text>` has no `fontFeatureSettings` prop on any RN version, Expo Go or dev build. The only lever is `fontVariant:['tabular-nums']` (reliable iOS, needs explicit `fontWeight` on Android, and only works if the font ships a tnum table). **So the "numbers in Geist Mono" rule isn't a stylistic choice you can defer — it's the only way to get tabular figures, and it's identical in Expo Go and the dev build.** Implement it from day one. This is the highest-leverage, zero-cost correctness item in the whole design.

---

## Things in the spec that are FINE in Expo Go (don't over-engineer these)
- Custom Apple-Pay numpad (1-9, ., 0, ⌫): pure `Pressable` + `Text` + `Animated`. No native anything.
- All cards/rows/chips/segmented/toggles/dotted-leaders/proportion bars: plain RN `View`/`Text`/`Pressable` + `LinearGradient`. 100% Expo Go.
- `AiVerdictChip.tsx` 3-state teaser: already pure RN, already demo-guarded with `DEMO_VERDICT` and `enabled: !DEMO`. The onboarding "3-pip legend" is trivial.
- Off-edge peek horizontal scroll, filter chips: `ScrollView horizontal`. Fine.
- Dimmed-cents balance: pure `Text` composition. Fine.
- Bottom-sheets: **caveat** — without gesture-handler you can't drag-to-dismiss with a finger-tracked spring. For the demo use a `Modal` + `Animated` slide-up + a tap-scrim-to-close + a visual drag-handle that isn't actually draggable. Upgrade to `@gorhom/bottom-sheet` (needs reanimated + gesture-handler) in the dev build.

---

## CRITICAL: the trap that breaks the demo
**Do NOT add `react-native-reanimated`, `@shopify/react-native-skia`, or `react-native-gesture-handler` to `package.json` while you still want the Expo Go demo.** The instant any of those is imported, Expo Go red-screens ("native module not found" / missing Babel worklets plugin) — even in DEMO mode, because Metro bundles the import regardless of runtime flags. The Privy stub works because `metro.config.js` *aliases the module away*; you'd have to do the same trick for every native lib, which gets fragile fast.

The clean rule: **the Expo Go demo uses only Expo-Go-bundled modules** (Animated, expo-blur, expo-linear-gradient, react-native-svg, expo-font, expo-secure-store, expo-web-browser). Skia/Reanimated/gesture-handler/haptics/glass-effect/local-auth/Privy are **dev-build-only** and must each be behind a `try/catch require` + capability flag (the `Glass.tsx` pattern), so a single shared codebase runs in both. Write a tiny `src/native/optional.ts` that exports `{ Reanimated?, Skia?, Haptics?, hasReanimated, hasSkia }` so components branch once, centrally.

---

## Build order that keeps the demo runnable at EVERY step
Each step ends with "Expo Go still launches and shows the redesign." Nothing below requires leaving Expo Go until Step 8.

1. **Theme + fonts first (Expo Go).** Rewrite `src/theme.ts`: delete `accent:#5865F2`/`accentSoft rgba(88,101,242…)`, install Pointer Ocean (`accent #0077B6`, `accentGlow #00A3E0`, dark tokens, semantic/verdict colors, light-theme mirror). Add `expo-font` + bundle Geist/Geist Mono + the Inter→system fallback ladder. Wire the Geist-Mono-for-all-numbers + `fontVariant:['tabular-nums']` rule. **Demo runs.** (This single step kills the most-cited bug in the design study — the Discord-blurple accent.)
2. **Logo + primitives (Expo Go).** Swap to `<Image>` `pointer-bird-transparent.png` (or rn-svg). Build `StickyCTA`, `ProgressDots`, `Screen`, chips, segmented, toggle, dotted-leader row, proportion bar — all plain RN. **Demo runs.**
3. **Optional-native shim (Expo Go).** Add `src/native/optional.ts` (try/catch requires for haptics/reanimated/skia/glass) returning capability flags + no-op shims. Retheme `Glass.tsx` light-bleed to `#00A3E0`. **Demo runs** (all flags false in Go, fallbacks active).
4. **Motion via core Animated (Expo Go).** Onboarding pager spring, count-up balance, check-ring scale-in, sheet slide-up — all with RN `Animated`. Haptics calls go through the shim (no-op in Go). **Demo runs, motion visible.**
5. **Chart via react-native-svg (Expo Go).** Token-screen line chart, trend color, dot-glow (layered translucent `<Circle>`/`<RadialGradient>`), Profile sine-wave, entry/exit markers. **Demo runs — the money-shot screen is demo-able without Skia.**
6. **Screens assembled (Expo Go).** Onboarding 4-pane, Home funded/empty, Pulse, Token, Fund numpad, Profile, Settings, Referrals — using only the above. Privy/API guarded behind `if (!auth.demo)`; mode flag to secure-store. **Full redesign demo-able in plain Expo Go. SHIP THIS to the founder to SEE.**
7. **(Still Expo Go) polish + white-theme toggle.** Appearance toggle flips the token set live. Verify the fallback ladders (font fail, missing-native) never white-screen. **Demo runs.**
8. **EAS dev build — upgrade pass (leaves Expo Go).** NOW add reanimated + gesture-handler + skia + expo-haptics + expo-glass-effect + the real `@privy-io/expo` + expo-local-authentication. Each capability flag flips true and the component swaps its fallback for the premium path automatically (because of Step 3's shim). Same screens, now with worklet springs, Skia glow, Liquid Glass, real haptics, real auth/money. Run `npx expo install --fix` (the package.json `*` versions and the .npmrc `legacy-peer-deps=true` are set up for exactly this).

The seam between Step 7 and Step 8 is the whole point: **the founder sees the complete visual redesign in Expo Go at Step 6/7 with zero dev-build friction, and the dev build is a pure capability-upgrade, not a rewrite.**

---

## Top risks to flag to the founder, ranked
1. **Reanimated/Skia/gesture-handler are NOT in Expo Go and NOT in the project.** Adding any one ends the Expo Go demo. Keep them dev-build-only behind capability flags (Step 3). This is the #1 thing that will accidentally break the demo if a dev "just installs the animation lib."
2. **expo-haptics is gone from Expo Go SDK54.** Every `Haptics.*` call must be shimmed or it throws. Cheap to get right, easy to forget.
3. **The "tabular numbers" requirement is real and RN-permanent** — there is no `font-feature-settings` in RN. Geist Mono for all numerals isn't optional polish; it's the only mechanism. Code it from Step 1.
4. **Don't trust the `app.config.ts` "SDK-56" comment** — the project is SDK 54 (package.json). Use SDK 54's Expo Go module list as the source of truth for what's bundled.
5. **Bottom-sheet drag is the one interaction that genuinely degrades in Expo Go** (no gesture-handler) — tap-to-dismiss + non-draggable handle is an acceptable demo stand-in; the real finger-tracked sheet waits for the dev build.

**Relevant files:** `C:/Users/moust/Downloads/pointer-ton/apps/mobile/package.json` (deps to keep clean), `C:/Users/moust/Downloads/pointer-ton/apps/mobile/metro.config.js` + `C:/Users/moust/Downloads/pointer-ton/apps/mobile/src/auth/index.tsx` + `src/auth/privyStub.js` (the working stub pattern to replicate), `C:/Users/moust/Downloads/pointer-ton/apps/mobile/components/Glass.tsx` (the canonical try/catch-fallback pattern), `C:/Users/moust/Downloads/pointer-ton/apps/mobile/src/theme.ts` (the `#5865F2` accent to delete in Step 1), `C:/Users/moust/Downloads/pointer-ton/public/branding/pointer-bird-transparent.png` + `logo-bird.svg` (logo for Expo Go).

## Wedge prominence
I now have the full picture: the spec, the existing scaffold (HomeScreen, AiVerdictChip, theme), and the FOMO study. I can deliver the WEDGE critique grounded in what's actually built vs. specced.

---

# WEDGE CRITIC — Is Pointer's advantage the hero, or a footnote?

**Verdict: the wedge is well-conceived in the spec but mostly bolted-on in the scaffold, and even the spec buries the two wedges that matter most. A FOMO refugee opening this build today would feel a slightly nicer FOMO — not "this shows me what FOMO hides."** Below: where each of the four wedge pillars actually lands, and concrete placement/hierarchy fixes.

## The core problem: the wedge is described in copy, not demonstrated in pixels

The single most damning thing I found is in the **actual built Home** (`apps/mobile/screens/HomeScreen.tsx`):

- The AI Daily Brief — which the spec calls "the wedge, top-of-fold" and "what FOMO's static Recap can't match" — **does not exist in the built screen.** There is no AiVerdictChip, no brief card, no risk anything. The component is built (`AiVerdictChip.tsx`) but **never imported into Home.**
- The cashback wedge is rendered as a **flat grey text paragraph** (`s.promo` → `Glass` with a green title and dim body, lines 60-65). The headline economic differentiator ("50% / 30%") is set in `colors.bull` green at 16px and **the numerals are baked into prose**, not the Geist-Mono hero treatment the spec demands. It reads like a marketing footer, not a hero.
- The accent is still `#5865F2` Discord blurple (`src/theme.ts` line 11), the exact AI-slop the brand study flags for deletion. So the one chromatic signal that should make Pointer feel like *Pointer* and not FOMO is literally FOMO-adjacent periwinkle right now.

So before any hierarchy debate: **the wedge isn't buried in the build, it's absent.** A FOMO user would see a balance hero, two buttons, and a grey "fees back" blurb. That is a footnote.

## Pillar-by-pillar: prominent, or bolted-on?

**1. AI verdict + risk translation — STRONG concept, WEAK reach. This is the wedge and it's confined to one screen.**

The translation idea is genuinely the thing FOMO can't do — `AiVerdictChip.tsx` correctly turns raw `riskFlags`/`confidence` into a 3-state "Looks healthy / Caution / High rug risk" chip. That is the "this shows me what FOMO hides" moment. The problem is **it only lives on the token screen, above the Buy button** (per spec Batch 2), where a user only arrives *after* they've already decided to look at a coin. FOMO's whole funnel — Home, Pulse discovery list, search results — is where buying decisions actually form, and the verdict is invisible there.

> Fix — make the verdict a **pervasive per-token signal, not a token-detail feature.** Render a minimal 1-pip version of AiVerdictChip (`expandable={false}`, just the colored dot + nothing else, 8px) on **every token row** in Pulse, search results, and Home holdings. A FOMO user scrolling a trending list and seeing a column of green/amber/red safety pips down the right gutter — next to the same MC/Vol/%Δ FOMO shows raw — *instantly* registers "this app pre-judged every coin for me." That single repeated pip is the wedge made ambient. Right now the verdict is a destination; it should be a layer.

**2. 50% cashback + 30% referral — currently a FOOTNOTE in both spec and build.**

This is the most under-leveraged advantage. The economics out-generous FOMO by 2x (50 vs their 25, plus 30 referral) and yet:
- In the build it's a grey paragraph (above).
- In the spec, on Home it's "CASHBACK STRIP — one line, restrained." Restraint is wrong here. FOMO's equivalent ("Earn 25% of your friends' fees") is their *own* loud accent banner per the study (Batch 4). Pointer is being quieter about a number that is twice as good.

> Fix — promote cashback to a **live, accruing number**, not a promise. The hero is "your money + what the AI thinks." Add a second hero stat directly under the balance: a Geist-Mono `+$3.42 cashback today` line in gain-green, count-up animated, that ticks after every trade. Numbers that *grow on their own* are the most native flex a trading app has. "50% / 30%" as static marketing copy is forgettable; "$3.42 appeared in my balance because I traded" is retention. Frame it as **realized**, not advertised — that's the inversion FOMO can't match because they give half as much.

**3. Simple/Advanced — invisible at the moment it should sell itself.**

This is a real structural advantage (FOMO's entire app = your Simple mode) but as designed it's a silent per-user flag set once in onboarding Pane 3 and toggled in a header pill/Settings. A FOMO user never *feels* the disclosure — they just get one mode. The wedge of "same screen, two depths" only lands if the user sees the depth they're *not* using.

> Fix — on the token screen, when in Simple, show a single collapsed **"Show the full risk breakdown ›"** affordance directly under the verdict chip (accent-glow text). Tapping it previews Advanced (top-10 holders, liquidity, KOL flow) inline. This does two things: it makes Simple feel like a *choice* rather than a limitation, and it turns the verdict from a black-box label into "tap to see the receipts FOMO buries in About." The progressive-disclosure *is* the trust mechanism — expose its edge, don't hide it behind a Settings flag.

**4. Solana-first — fine, but it's a subtraction, not a felt advantage.**

Collapsing FOMO's 6-network deposit to Solana is correct and reduces friction, but the user never perceives "Solana-first" as a benefit — they just see fewer networks. This pillar is the weakest *as a wedge* (it's an operational choice, not a user-facing win) and I'd stop selling it as one. The deposit-flow simplification is good UX; it is not the thing that makes someone switch from FOMO.

## The three highest-leverage placement fixes

1. **Put the AI Daily Brief on Home, top-of-fold, with a real flagged verdict chip — and actually build it.** Right now Home jumps from balance hero straight to the grey cashback blurb. The brief card (spec item 2) is the single screen element that says "the AI watched your bags overnight." It must render *above* cashback and *above* holdings, with at least one inline tappable AiVerdictChip when a holding is flagged. This is the screen a FOMO user opens every morning instead of FOMO's static "Recap: June 23rd" news card. Built, it wins the daily-open habit; absent, Home is just a wallet.

2. **Make the verdict pip ambient across all discovery surfaces** (Pulse rows, search, holdings) — covered above. One repeated colored dot does more wedge-work than the entire token-detail risk panel, because it's seen 50x more often.

3. **Convert cashback from promise-copy to a living gain-green counter** in the balance hero — covered above.

## One hierarchy trap to avoid

The spec keeps using the word "restrained" for the wedge surfaces (cashback strip "one line, restrained"; verdict "the single calm chip"). Restraint is right for *chrome and accent color* — it is wrong for *the differentiators*. Mono + one-accent discipline should make the wedge **pop harder**, not whisper: against a near-black field with white text, the green cashback counter and the verdict pips are the *only* color on screen, so they carry maximum signal for free. Use that. The mistake would be treating the wedge with the same calm as the base UI — then it disappears into the premium minimalism. The base should be calm so the wedge can be loud.

---

**Relevant files:**
- `C:/Users/moust/Downloads/pointer-ton/apps/mobile/screens/HomeScreen.tsx` — wedge is absent here (no brief, no verdict chip, cashback is grey prose); highest-priority fix.
- `C:/Users/moust/Downloads/pointer-ton/apps/mobile/components/AiVerdictChip.tsx` — the wedge component; solid, but needs a non-expandable pip variant for ambient use across rows, and `colors.warn/bull/bear` here drive the verdict states.
- `C:/Users/moust/Downloads/pointer-ton/apps/mobile/src/theme.ts` — accent is still `#5865F2` Discord blurple (lines 11-12); must become Pointer Ocean `#0077B6`/`#00A3E0` or the whole app reads as FOMO-periwinkle, neutralizing the brand half of the wedge.

**Bottom line:** the wedge concept is right and the token-screen verdict is genuinely un-FOMO-able — but in the current build it's missing from Home, muted as marketing copy for cashback, locked to a single screen for the verdict, and undercut by a wrong accent. Make the verdict ambient (a pip on every row), make cashback a living number, build the daily brief, and let mono-restraint amplify the wedge rather than mute it. Do those four and a FOMO user feels the difference in the first five seconds, not on the token detail screen they may never reach.