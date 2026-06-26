# FOMO design-system study → Pointer Mobile

Extracting FOMO's *grammar* (not copying screens) to rebuild Pointer's mobile design system.
FOMO's whole app = Pointer's **Simple** mode; Advanced is progressive disclosure on the same screens.

Locked direction: React Native · near-mono black/grey + ONE restrained accent · subtle physics-based motion · white theme toggle.

---

## Batch 1 — HOME tab (5 shots: Graduated / Crypto / Perps / Trending / Most held)

### Color
- **Background:** true near-black `#06080B`-ish, not pure #000. Flat, no gradient on home.
- **Surface (cards):** one step up `#0C0F14`, hairline border `~#15191F` (barely there).
- **Accent (FOMO's single one):** periwinkle/indigo blue `~#5B6EF5` — Deposit button, "New" badge, leverage `40x` badges, verified ✓, "Lowest fees" tag. Used SPARINGLY. (We pick our own restrained accent — this confirms the one-accent discipline works.)
- **Gains:** bright green `~#1FD760` with ▲. **Losses:** orange-red `~#FF4D3D` with ▼.
- **Text:** white `#FFFFFF` primary, grey `~#8A9099` secondary (MC, Vol, "24h", "-- ").

### Premium details worth stealing
- **Dimmed cents:** balance renders `$0` bright white + `.00` in grey — dollars pop, cents recede. Steal this.
- **Off-edge peek:** "Weekly Top Trades" cards bleed past the right edge → tells you to scroll, no scrollbar needed.
- **Floating glass nav** (see below) with a colored light-bleed under the active tab — "glass reacting to light" = exactly our motion brief.

### Layout rhythm
- Logo top-left (white double-loop mark). Generous top padding.
- **Balance hero:** huge (~56px) `$0.00`, `-- 24h` tiny grey below. **Deposit** CTA top-right (accent fill, ~16px radius, bold white) — prominent because balance is $0 (onboarding nudge).
- **Weekly Top Trades:** horizontal-scroll cards (~16px radius, elevated surface). Avatar + handle top, P&L green + token icon below. Social-proof seed.
- **Filter chips:** horizontal-scroll pills. Active = **white fill / black text** (max contrast). Inactive = transparent / grey text / hairline border. Star (favorites) pinned left. "New" badge inline.
- **Contextual banner:** per-filter rounded card — icon left (⚠️ yellow caution / 🏷️ blue tag / chart for perps), bold white title, grey body, `(i)` affordance. Smart: teaches context without clutter.
- **Token rows (~72px):** circular logo + tiny status badge (pump.fun pill = graduated, blue ✓ = verified) · ticker bold(700) white + micro meta (🌱 age, `40x` lev) · MC/Vol grey beneath · right-aligned price bold white + %Δ colored w/ triangle. Tabular numbers, tight tracking.

### Bottom nav — the signature element
- **Floating glass pill**, NOT an edge-to-edge bar. Sits above content with blur.
- 5 slots: Home (filled house) · Search · **center brand mark** · People (social) · profile avatar (user's orange circle).
- Active tab = illuminated pill highlight with a soft **colored glow bleed** (reddish under Home). This is the single most "expensive/native" touch — reproduce with Skia/blur + Reanimated.

### Maps to Pointer (utility deltas)
- FOMO Home = pure discovery list. Pointer has a separate **Pulse** tab for discovery → our Home can lean more into **holdings + AI daily brief** when funded (their $0 state is an onboarding shell).
- Their tabs (Crypto/Perps/Trending/Most held/Graduated/Gainers) = horizontal filter model. We reuse the chip pattern; our content differs (Solana-first, AI risk).
- "Weekly Top Trades" = leaderboard/social seed → ties to our KOL/social layer.
- No chart on home rows (just price+%). Our wedge (chart + AI verdict) lives on the **token screen**, not here — keep Home this calm.
- Perps = out of scope for us v1 (note: FOMO leads with it as "New").

### Open questions to resolve once more screens arrive
- Their exact type family (looks like a clean grotesk / SF — confirm).
- Nav center action behavior (does the brand mark open trade/search?).

---

## Batch 2 — TOKEN screen, trader sheet, search, social, profile, settings

### Token screen (BOTCOIN) — OUR money shot, study hardest
- **Header:** back ‹ · circular logo + verified ✓ · ticker + chain glyph · sub-row `BOTCOIN ⧉` (copy CA). On scroll the header **condenses** — price/%Δ migrate up to the right of the header (two states of the same header).
- **Top-right actions:** history (clock), star (watchlist), share (upload).
- **Price block:** big `$0.0000150`, %Δ colored below, right-aligned `⇄ $1.4M Market cap`.
- **Chart:** large line, **colored by trend** (orange/red downtrend, green up), soft **radial glow at the live-price dot**, dotted-grid bg. Timeframes `1H 4H 1D 7D 1M ALL` + candlestick toggle (red/green bars icon).
- **Tab bar:** `Holders (1,364) · Feed · About`, blue underline indicator.
  - **Holders:** "Friends only" toggle. Row = avatar · name · `5d 10h avg. hold` (clock) · right: $ held + %Δ. Some rows thread an attached tweet/note (connector line) + ♡ count.
  - **Feed:** "Thesis only" toggle. Row = avatar · name · **Buy/Sell badge** (green/red) · time · `$1.7K at $1.4M MC`. Hairline separators.
  - **About:** Description + "Search on Twitter" (accent). Website / Twitter pill buttons. **Transactions** (5M/1H/1D): buys-vs-sells with **green/red proportion bars** ($vol, buyers/sellers). **Holders:** count + top-10 holding %. **Stats:** dotted-leader rows — Market cap, 24h vol, Liquidity, Supply, Created, Launchpad, Blockchain, Contract address ⧉.
- **Sticky CTA:** full-width accent `Deposit to buy` (becomes Buy/Sell when funded).
- Floating circular **scroll-to-top** ↑ button bottom-right when scrolled.
- ⭐ **THE WEDGE:** About's Stats already show top-10 % / liquidity / created — but raw, uninterpreted. Pointer's **AI verdict chip + risk panel slots directly here/above the chart**: we *translate* ("Top 10 hold 30% — Caution") where FOMO only lists. Plus our Skia chart + verdict ABOVE the buy button.

### Trader bottom-sheet (tap a top trader)
- Drag handle · avatar + name › · Share + **Follow** (accent).
- Position card: token + `Closed` badge + price + P&L%. **Chart with entry/exit markers** — green `＋` circles (buys) and red `－` circles (sells) plotted on the line. Gorgeous annotated trade history. 1M/ALL + candle toggle.
- P&L summary card: big green `+$77,860.93`, `+3,328.67%`, Avg entry / Avg exit.
- **Thesis note** (`s4if · Thesis · 5d`: "…") + ♡ + "6 older".
- "25 transactions ⌄" expandable + "$2,339.10 invested". Sticky `Deposit to buy`.
- ⭐ Maps to our **KOL/copytrade** detail. Steal the **annotated entry/exit markers** for our token chart AND PnL cards.

### Search
- Empty: "Recents" + Clear all (accent); recent token row w/ ✕ remove.
- **Search bar anchored at BOTTOM** (thumb-reach) w/ inline **Paste** button — the clipboard-CA paste the founder wanted on web, native here.
- Results grouped **Tokens** (row + chain badge) and **Users** (avatar · name · @handle · **Send** money button). Live as-you-type, keyboard autocomplete.

### Social — Feed / Leaderboard / Friends
- **Feed:** title + "Friends only" toggle. **Pinned official post** = "Recap: June 23rd 2026" news card (bullets + Read more + ♡) — *their daily market brief* → our **AI daily brief**. Activity rows: avatar · name · Buy/Sell badge · time · token line `Clude $3K at $3.2M MC`.
- **Leaderboard:** "Your rank #- $0" card; Top traders with **medal ranks** (gold/silver/bronze 1-3, then numbers) · avatar · name · @handle · green P&L · stacked held-token avatars (+N overflow); 24h/7d/30d/All.
- **Friends:** "You" card; My friends list w/ P&L (green/red) + held-token avatars; 24h/7d/30d.

### Profile (own — 5th nav tab = avatar)
- Avatar (editable ✎) · username · @handle · "+ Add a bio" (accent) · "15 Following 0 Followers" · meta (hold time / trades / joined) icons. Top-right: gift, history, settings ⚙.
- **P&L hero:** `$0.00` + 24h/7d/30d/All; empty state = subtle **sine-wave** + "No positions yet" (nice).
- **"Get your first token with  Pay"** promo card — "$0 fee on your first purchase", Buy now →, cluster of token avatars. (Apple-Pay onboarding hook.)
- Sticky accent `Deposit`.

### Settings (list)
Account · Appearance · Notifications · Security · Deposit & Withdraw · Legal & Privacy · Taxes · Help & Support · Perps FAQ · Discord. Big rows, chevrons, hairline separators, generous breathing room.

---

## Batch 3 — FUNDING / withdraw / settings detail (the "easy Apple Pay" core)

### Deposit entry (bottom-sheet "Deposit with")
Three big cards: **Crypto** (Receive USDC from a crypto wallet, QR icon) · **Apple Pay** `New` (Buy PENGU, WIF, GIGA, +20 tokens,  Pay) · **Debit** (debit card).

### ⭐ Apple Pay buy flow (the "so easy just like FOMO" target)
1. **Token picker:** "Buy with  Pay · $0 fee on first buy", search field, token list (same row pattern).
2. **Amount entry:** token header · **GIANT centered `$50`** · preset chips `$50 / $100 / $500 / $1,500` · **custom numeric keypad** (1-9, ., 0, ⌫ — NOT the iOS keyboard, big tactile digits) ·  Pay sticky button + "$0 fee ⌄" · footer "By continuing you accept **Crossmint's** Terms". → **FOMO's Apple-Pay rail = Crossmint** ("Pay Crossmint via fomo").
3. **Native Apple Pay sheet:** iOS system overlay (card, US$50.00, Confirm with Side Button) — we get this free.
- ⭐ THIS is the exact template for our founder's "load balance / buy coins easy as FOMO". Custom numpad + presets + one-tap  Pay. Note: their rail is **Crossmint**; ours is `/api/onramper/signature` — Crossmint is the proven direct-to-token Apple-Pay UX to evaluate/match.

### Deposit & Withdraw (bottom-sheet)
"Total cash $0" · Tokens cash / Perps cash split · Transfer cash · **Deposit** card (Crypto, Apple Pay, Debit, bank, ⊕) · **Withdraw** card (Bank or crypto wallet, ↑) · View transfer history (accent).

### Deposit crypto (multi-network)
Network picker rows: Solana / Base / BNB Chain / Monad / Hyperliquid / Ethereum (chain icons). → QR card + truncated address + **Copy wallet address**; "Copied address" **green toast** top. (We're **Solana-first** → collapse to Solana, maybe Base.)

### Withdraw
"Choose withdraw method": **Bank account (US only, ACH)** · **Crypto wallet** (USDC to Solana/Base/BNB/Monad) · **Finance apps** (PayPal, Venmo, Robinhood, Wealthsimple).

### Settings sub-screens
- **Account:** "Connect your X account" (accent-bordered card) · avatar ✎ · @username · Display name · description (0/160) · Save changes (disabled-grey until dirty) · Account login (Google) · **multi-chain addresses** (Solana/Base/Eth/BNB/Monad, truncated + copy) · **Export** button in **ORANGE/RED** (sensitive action gets its own danger color — FOMO is NOT strictly one-accent: blue primary + green/red P&L + orange danger + brand-orange avatar).
- **Appearance:** Text size (Default/System segmented) + Small trades (Show/Hide). **NO light/dark toggle — FOMO is dark-only.** → Pointer **adds the white-theme toggle here** (founder requirement = a differentiator).
- **Security:** master "Enable Face ID" + sub-toggles "Require Face ID for: Withdrawing funds / Exporting key / Opening app" (greyed until master on). → our **confirm/lock-before-execute** + non-custodial story.
- **Notifications:** master toggle + Price alerts (On ›), Friends' activity (On ›), Trending activity, Top traders' activity, Announcements, New followers (mix of drill-in › and inline toggles).
- **Taxes:** email capture, "Powered by **Awaken**" (3rd-party). 

### Toggle / control styling
Toggles: accent-blue track when ON, dark when OFF, white knob. Segmented: active = accent fill / white text, inactive = dark surface. Big tap targets throughout.

---

## Batch 4 — History + Referrals (final batch)

### History
Title "History" + filter chips `All / Transfers / Trades / Cash` (active = dark-fill/white text). Empty = centered dim "No history". → Pointer: unified activity log; reachable from Profile history icon. Map to portfolio/activity API.

### Referrals
- "$0.00 Total earned rewards" (**dimmed cents**). Accent banner "🎁 Earn 25% of your friends' fees". Stat split: `$0 Earned last 7d | 0 Friends referred`. Share-link card `fomo.family/r/testerfrank` + share icon (accent). Big faded logo watermark + empty-state copy.
- ⭐ **Pointer out-generouses:** **30% referral + 50% cashback** (vs FOMO's flat 25%). Our share card is **proof-carrying** (embeds referral code + AI narrative). This is a headline, not a footnote — surface on Profile + post-trade.

---

## SYNTHESIS — Pointer design system + divergences (build from this)

### Palette (mono + restrained accent, per founder lock)
- `bg` near-black `#06080B`; `surface` `#0C0F14`; `surface-2` `#12161D`; hairline `#191E26`.
- `text` `#FFFFFF` / `text-dim` `#8A9099` / `text-faint` `#565C66`.
- **Accent (ONE, ours — NOT FOMO blue):** pick grounded in Pointer web brand (PENDING: pull web tokens). Used for primary CTA, active states, links.
- **Semantic (not "accents"):** gain `#1FD760`, loss `#FF4D3D`, **danger/export amber-red**, **AI-risk scale** (healthy green / caution amber / high-risk red) — our verdict colors.
- **White theme:** full token-swap (founder wants it) — invert bg/surface/text, keep semantics. Appearance toggle.

### Type
Single grotesk, tabular-lining numbers, tight tracking. Scale: hero `$` ~56 / title ~28 / ticker ~17 bold(700) / body ~15 / meta ~13 dim. **Dimmed-cents** treatment on all big $ figures.

### Motion (subtle physics — founder lock)
Spring nav transitions · glass nav active-pill **light-bleed** (Skia+blur) · count-up numbers · haptics on confirm/Buy · chart live-dot glow · sheet drag handles. Nothing moves without reason.

### Components to build (design system, BEFORE screens)
Glass bottom-nav (floating pill + light-bleed) · token row · filter chips · contextual banner · stat dotted-leader row · proportion bar (buy/sell) · toggle + segmented · sticky CTA · bottom-sheet · amount-entry numpad · **AI verdict chip (3-state)** · **risk panel** · annotated chart markers (Skia).

### Where Pointer WINS / diverges from FOMO
1. **AI verdict + risk panel** on the token screen — translate FOMO's raw stats into a verdict (the wedge).
2. **Simple/Advanced toggle** — FOMO's whole app = our Simple; Advanced expands risk panel + KOL + indicators + limit orders on the SAME screens (header pill + Settings).
3. **Solana-first** — collapse FOMO's 6-network deposit to Solana (+Base later); drop Perps.
4. **50% cashback + 30% referral** headline (vs their "$0 first-buy") — surfaced on Profile + post-trade.
5. **White theme** (FOMO is dark-only).
6. **Proof-carrying PnL cards** w/ AI narrative + referral code.
7. **Daily AI brief** (richer than their static recap).
8. **Packs** — NOT in the iOS app (dApp Store/web only).

### Infra notes captured
- Apple-Pay rail: FOMO = **Crossmint** direct-to-token. Ours = Onramper widget (`/api/onramper/signature`). Evaluate Crossmint for the same $0-fee-first-buy direct UX.
- Taxes = Awaken; Withdraw to PayPal/Venmo/Robinhood via off-ramp.
- FaceID gates withdraw/export/open (biometric = `expo-local-authentication`).
