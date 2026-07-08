# Sibyl App — Build Spec (giveaway doc)
### Standalone native iOS app (Swift/SwiftUI), Android to follow. Client to the existing Sibyl API.

> **Status: LIVING DOC — building from reference screenshots in batches.** Batch 1/? logged below.
> The backend is done: this app is a thin, beautiful client to `/api/sibyl/*`. Design reference =
> **Venice AI** (clean, dark, privacy-first). We are NOT copying Venice — we map its good patterns
> onto Sibyl (Oracle 7.0 / Veil 6.5, the Council, our flywheel, Pointer auth).

---

## Design system (observed from Venice, adapt to Sibyl)
- **Theme:** near-black background (~`#080A0F`), dark blue-gray cards (~`#141A22`), large corner
  radius (~16–20pt). White primary text, gray-muted secondary.
- **Accent:** Venice uses blue (~`#2563EB`) for toggles/buttons/links. **Sibyl → use the Sibyl
  accent** (teal/violet per the web `--s-accent`), not Venice blue.
- **Privacy tags (the key pattern):** small pills on model rows — **"Anon" = teal**, **"Private" =
  purple**. → **Sibyl:** Oracle = teal/none, **Veil = purple "Private" + 🔒**. This is our Oracle/Veil
  selector, already backed by real attestation.
- **Pills:** "New" = purple. "PRO" = blue, gates locked features.
- **Modals:** slide-up sheets, header = `‹ back` · centered title · `✕` (circular) close.
- **Nav:** left **drawer** with an edge-tab handle (`›`). iOS-style toggles (accent when on).
- **Info affordance:** `ⓘ` circles next to most settings/limits (tap → explanation).
- **Credits:** green stacked-coin icon (Venice's credit economy — Sibyl uses scans/tier instead).

## Screens — Batch 1 (Venice reference → Sibyl mapping)

### 1. Left drawer / nav (logo top-left, hamburger top-right)
- Venice script logo top-left; search bar; nav items **Chat** (selected), **Agentic Chat** (`New`).
- Account card: avatar + name + "0 Venice Credits".
- List: Settings · Help & Feedback · Feature Requests · ⸻ · Import Memories (`New`) · Purchase
  Credits · ⸻ · Sign In/Sign Up · ⸻ · Home Page (+ Discord/X icons) · Version x.x.x.
- Bottom: persistent account pill + `+` (new chat). Left edge-tab `›` toggles the drawer.
- **Sibyl mapping:** Sibyl mark (the eye) top-left. Items → **Chat** (Oracle/Veil), **Agent**
  (the Council monitoring — `New`), Search history. Account card → Pointer/Privy user + tier +
  scans-left (not credits). List → Settings · Help · Feature requests · **Import Memories**
  (flywheel recall) · Upgrade tier · Sign in (Privy) · pointer.trade + X/Discord · version.

### 2. Model picker (shown as "Text to Video" — same component for text models)
- Sheet: `‹` · title · `✕`. "Current" + selected model dropdown (`Seedance 2.0 ⌃`).
- **Rows:** brand icon · name · `ⓘ` · right: **tag pill** (`Anon` teal / `Private` purple) · coin icon.
- **Sibyl mapping — THIS IS OUR MODEL SELECTOR:**
  - **Oracle 7.0** — "Flagship — the full Council" · tag: *(none / teal)*
  - **Veil 6.5** — "Confidential — attested enclave" · tag: **purple 🔒 Private**
  - Oracle Pro / Deep Research / Flash — locked (🔒 lock, "Pro" gate) like Venice's PRO rows.
  - Right side: instead of credits, show scans-cost or nothing. `ⓘ` → model blurb.

### 3. Storage & Limits (privacy proof screen)
- **Limits** card: Chat / Image / Web scrape / Voice — each "N until <time> UTC" + `ⓘ`.
- **Chat Data** card: "Local storage: 96% used of 119GB" + progress bar; **Recover Data** (Scan
  button); **Delete Chat History** — *"Venice doesn't store (and can't access) your chat history.
  Instead it's stored locally on your device and you can delete it here."* + red **Delete**.
- **Sibyl mapping — huge for us:** this is the **zero-retention proof surface**. Show: scans-left
  vs daily cap (from `/api/sibyl/usage`); a "Nothing stored in Veil sessions" statement; local
  chat history (device-stored, deletable) — matches our zero-retention design exactly. Add an
  **attestation** line here ("🔒 Verified enclave — view proof") tapping into `/api/sibyl/attestation`.

### 4. Text settings (model + privacy config)
- "Current" + `Models ⌄`. Toggles: **Background Streaming** (on), **Prefer Encryption** (off),
  **Web Enabled** (on). **Search Provider** radio: *Google (best results & anonymous)* / *Brave
  (fully private)*. **URL Scraping** (`PRO`, off). **Venice Voice** (collapsible). **System Prompts**
  (`＋ Add` — "Control the AI's reality…"). **Advanced Settings** (collapsible).
- **Sibyl mapping:** model default (Oracle/Veil); **Web Enabled** + **Search Provider** →
  *anonymized retrieval* toggle (our `retrievalFetch` seam — Google vs Brave = anon routing);
  **Prefer Encryption** → our confidential/Veil preference; System Prompts → power-user persona
  (gated). Keep the privacy-forward framing.

### 5. Profile (signed-out)
- Sheet: `‹` · "Profile" · `✕`. "Venice Account" card: "Enjoy higher message limits, earn credits,
  access advanced features." + blue **Sign Up**; "Already have an account? **Sign In**". Empty below.
- **Sibyl mapping:** "Sibyl Account" → **Privy sign-in** (Google/Apple/wallet, matches web). Copy:
  higher scan limits, saved research, Veil/confidential access. Signed-in state shows tier + usage.

## API wiring (all endpoints already live)
- **Chat (streaming):** `POST /api/sibyl/chat/stream` — SSE events `mode` · `stage` (live Council
  trace) · `attestation` · `answer`. Body `{ query, mode }` where `mode` = `fast` (Oracle) |
  `confidential` (Veil). *Native note: iOS `URLSession` streams SSE fine; parse `event:`/`data:` lines.*
- **Chat (non-stream):** `POST /api/sibyl/chat` — returns `{ answer, mode, attestation, usage }`.
- **Usage/limits:** `GET /api/sibyl/usage` → scans used/cap/reset (feeds the Limits screen).
- **Attestation:** `GET /api/sibyl/attestation` → verify Veil enclave (the "view proof" surface).
- **Auth:** Privy (same app id as web/mobile) — bearer token on requests.
- **Answer rendering:** `SibylAnswer` = { verdict, confidence, why[], cards[], sources[] } — the app
  renders verdict + confidence bar + why bullets + interactive cards + clickable sources.

## Screens — Batch 2 (Venice reference → Sibyl mapping)

### 6. Image settings (not a Sibyl feature — but reusable SETTINGS PATTERNS)
- Collapsible **Basic / Advanced Settings** sections; toggles (Auto Enhance, Background Streaming);
  **dropdowns** (Models, Aspect Ratio); **slider** with end-labels (*Adherence: Creative ↔ Strict*,
  value "Medium"); **stepper** (Variants − 1 +); **PRO-gated** rows (Variants, Hide Watermark).
- **Sibyl mapping:** reuse these controls for **scan settings** — e.g. reasoning-depth slider
  (Fast ↔ Deep), Council agent toggles, PRO/tier-gated rows. Same collapsible + slider + stepper kit.

### 7. Left drawer — signed-out, with content sections
- Adds a 3rd nav item **Token Dashboard** (⊗). **Folders** header + `＋` (create). **Chats** header
  + `···`, empty state *"Start your first conversation."* Bottom: **"🎁 Invite & Earn $10"** banner
  (dismissible `✕`) above the account pill.
- **Sibyl mapping:** **Folders → Spaces/Workspace** (Pillar 3 — research folders/watchlists). Chats
  list = saved scans w/ empty state. Invite&Earn = our referral (already have `/api/referrals/code`).
  Token Dashboard → drop (Venice's token) or link to Pointer.

### 8. General settings — **Privacy section is the map to our moat**
- **Chat Behavior:** Show Message Date · Enter Submits Chat · Disable Video Background · Show History
  · Language (🇺🇸). **Privacy:** **Keyboard Incognito Mode** · **Disable Telemetry** (both `ⓘ`).
  **Theme:** Color Scheme (Dark). Version row at top.
- **Sibyl mapping — direct:** **Disable Telemetry = the flywheel opt-out** (our outcomes-vs-user
  split — user turns off behavioral capture). **Keyboard Incognito** = no-store input. These ARE our
  zero-retention/consent controls. Keep Theme (we have 3 web themes) + Language + chat-behavior.

### 9. Per-model settings sheet (Text to Video)
- `Current` + model dropdown; per-model options (Duration, Variants stepper); **"Reset to Defaults."**
- **Sibyl mapping:** per-model (Oracle/Veil) options sheet + Reset. Minor.

### 10. Main chat / home — **THE hero screen**
- Top bar: `☰` (menu) · **"✦ Upgrade to Pro"** (center) · new-chat icon `⌄` (right).
- Center: huge **Venice** script logo (empty state).
- Composer (bottom, rounded card): placeholder **"Ask anything privately…"** + **mic** (right);
  toolbar row: `＋` (attach) · **sliders** (tune) · **model selector `⚔ Auto ⌄`** · blue **`↑` send**.
- Left edge-tab `›`.
- **Sibyl mapping — the primary screen:**
  - Empty state: big **Sibyl eye mark** + tagline.
  - Composer placeholder: **"Analyze a token, wallet, KOL, or narrative — privately…"** (privacy in
    the prompt, like Venice).
  - Toolbar: `＋` attach · tune (scan settings) · **model selector = Oracle 7.0 / Veil 6.5** (replaces
    "Auto"; purple 🔒 when Veil) · mic (voice) · `↑` send.
  - Top: `☰` menu · Upgrade (→ our tier) · new-scan.
  - On submit → SSE stream: show the **live Council trace** (per-agent), then the **answer** (verdict
    + confidence bar + why + cards + sources), matching our web `SibylAnswerView`.

## Updated design notes (from batch 2)
- **Composer** is the signature element: rounded card, placeholder, left toolbar (attach/tune/model),
  right mic + circular accent send. Model selector lives *in* the composer.
- **Settings kit:** grouped cards by section header; toggles / dropdowns / sliders (with end labels) /
  steppers / PRO-gated rows; every row can have an `ⓘ`. Modals = slide-up `‹ · title · ✕`.
- **Privacy is a first-class settings section**, not buried — matches Sibyl's positioning.

## Screens — Batch 3 (Venice reference → Sibyl mapping)

### 11. Upgrade Your Plan (paywall)
- Header: `←` · "Upgrade Your Plan". Scrollable **tier cards**, each: name · big price `$259 /month` ·
  primary CTA button (blue **Get Max**) · one-liner · green **✓ feature list** · green **"$X value"**
  pills · perks ("credit banking"). Footer: **Restore Purchases** (underlined), **Privacy Policy** ·
  **Terms of Service**.
- **Sibyl mapping:** our tier upgrade — **Free → Pro → Professional → Institution** (rename per the
  roadmap). Feature lists in Sibyl terms: scans/day, saved research/Spaces, **Veil (confidential)
  access**, API, priority. Use scans/tier, not "credits." Keep **Restore Purchases** (iOS IAP) +
  legal links. CTA per card. (Our web already has `SibylUpgradeModal` to port the copy from.)

### 12. Text model picker (GLM list) — confirms the TEXT selector component
- Same picker as batch 1 but for **text models**: rows = brand icon · name · `ⓘ` · tag
  (**Private** purple / **Anon** teal) · optional coin. E.g. GLM 4.6 (Private), GLM 5 Turbo (Anon),
  GLM 4.7 Reasoning (Private). Below: Venice Voice · System Prompts (`＋ Add`) · Advanced Settings.
- **Sibyl mapping — this is our text model list:** **Oracle 7.0** (teal/none) · **Veil 6.5**
  (**purple 🔒 Private**) · Oracle Pro / Deep Research / Flash (locked). `ⓘ` → the model blurb from
  `lib/sibyl/models.ts`. Voice + System Prompts + Advanced below (gated).

### 14. Chat THREAD — active scan / streaming (the key interaction)
- Top bar: `☰` · "✦ Upgrade to Pro" · new-chat `⌄`. Below: conversation title chip (**"Test"**) +
  **copy** icon (`⧉`, copy conversation). Assistant message = **avatar** (the mode icon, gold) +
  **`● ● ●` animated typing dots** while generating. Composer: "Ask anything privately…" · attach
  `📎` · **mode selector `🤖 Agent ⌄`** · **white circular STOP `■`** (send → stop while streaming).
- **Sibyl mapping — the money screen:**
  - Assistant avatar = **Sibyl mark**. **While streaming, show the LIVE COUNCIL TRACE** (our real
    per-agent `stage` SSE events: "Reading market structure ✓ / Tracing wallets…") — NOT fake dots.
    This is our edge: real thinking, not a loading animation.
  - Then render the **answer**: verdict → confidence bar → why bullets → interactive cards →
    clickable sources (mirror web `SibylAnswerView`). In Veil mode, header shows **🔒 Verified enclave**.
  - **Send ↔ Stop (`■`) toggle** during the stream (abort the fetch/SSE).
  - Conversation title + **copy** action; new-chat in the top bar.
  - Composer mode/model selector (Oracle/Veil) persists here.

## Updated design notes (from batch 3)
- **Paywall pattern:** stacked tier cards, price + CTA + green ✓ list + "$value" pills; Restore +
  legal footer. Port copy from web `SibylUpgradeModal`; swap credits → scans/tier.
- **Streaming UX:** avatar + progress; **send button becomes a stop button** mid-generation.
  Conversation has a title + copy affordance.
- Tag pills (**Private** purple / **Anon** teal) confirmed across text + video pickers — our
  Oracle(teal)/Veil(purple 🔒) mapping is consistent and correct.

## Screens — Batch 4 (Venice reference → Sibyl mapping)

### 16. Agent / home empty state — "Let's build something"
- **Full-screen ambient VIDEO background** (dark water + gold light; controlled by the "Disable Video
  Background" setting). Center: agent mark + greeting **"Let's build something."** Above composer:
  **starter chips** — `🖼 Generate image` · `🎬 Create movie` · `</> Write code`. Composer as before
  (attach · `🤖 Agent ⌄` · mic).
- **Sibyl mapping:** we already ship `public/sibyl/background.mp4` — use it as the ambient home bg
  (toggle-able). Greeting: **"What are we hunting?"** or similar. Starter chips = crypto quick-actions:
  **"Analyze a token" · "Check a wallet" · "Scan a KOL" · "What's the meta?"** (prefill the composer).

### 17. Upgrade Your Plan — full tier list + billing toggle
- **Monthly / Yearly (`Save 10%`)** segmented toggle. Tier cards top→bottom: **Pro $24** · **Pro+ $88**
  · **Max $259** (from batch 3). Each: price · CTA · one-liner · green ✓ list · **"View more ⌄"**
  expander.
- **Sibyl mapping:** Monthly/Yearly toggle; tiers **Free · Pro · Professional · Institution** with
  Sibyl features (scans/day, Spaces, **Veil access**, API, priority) + "View more". Port copy from web
  `SibylUpgradeModal`; scans not credits.

### 18. Drawer — chat context menu (long-press) + signed-in
- Long-press a chat → popover: **"Move to folder"** (`📁+`) · **"Select to delete"** (`🗑`). Signed-in
  account footer shows the real name (**"Moustapha Thioune"**). A thread greeting ("Hello! How can I
  help…") peeks behind.
- **Sibyl mapping:** long-press a saved scan → **Move to Space** / **Delete**. Signed-in footer = Privy
  display name + tier. Assistant greeting on a fresh thread.

### 19. Referral modal — "Give $10, Get $10"
- Gift icon · headline (gold accent on the "Get" half) · description · **"Share Your Link"** field
  (`venice.ai/chat?ref=CODE`) with **copy** + **share** icons · **Credits Breakdown** (You've earned /
  Friends Received) · closing blurb · `✕`.
- **Sibyl mapping:** our referral (`/api/referrals/code` exists). Headline in Sibyl terms (bonus
  scans / credit), share `pointer.trade/sibyl?ref=CODE`, earned/received breakdown. Reuse the
  "Invite & Earn" drawer banner (batch 2) to open this.

## Updated design notes (from batch 4)
- **Ambient video bg** on the home/empty state (toggle in General settings). We have the asset.
- **Starter chips** above the composer for zero-state guidance → crypto quick-actions for us.
- **Long-press context menus** on list rows (Move to folder / Delete). Signed-in vs guest account
  footer state.
- **Billing toggle** (Monthly/Yearly + Save %) on the paywall; expandable "View more" per tier.

## Open questions / to confirm across batches (10 pics left)
- Still hoping for: a COMPLETED answer render (how markdown/cards look in-thread), sign-in / OAuth
  flow, voice mode UI, and any Sibyl-specific surfaces if you have mockups. Otherwise I have enough
  to spec the core app from Venice + our existing web `SibylAnswerView`/`SibylUpgradeModal`.
