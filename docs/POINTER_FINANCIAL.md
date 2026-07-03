# Pointer Financial — Product Architecture

_Internal. Head of Product. v1 — 2026-07-03._

> **The one sentence:** Every dollar inside Pointer is always in one of four states —
> **Trading · Earning · Spendable · Reserved** — and never idle, never forgotten.
> Pointer Financial is the system that makes that true.

Pointer Financial is **not** a neobank, a crypto card, or a fintech. It is the
**capital layer of a trading OS.** Trading is still the core product. Financial
exists so that the capital a trader already keeps at Pointer becomes maximally
useful *without ever pulling them out of Pointer.* It is a continuation of the
Pointer journey (discover → learn → trade → AI → portfolio), not a second app
bolted on.

---

## 0. Why we win where neobanks lose

The market is full of "wrap 4 provider APIs in a nice UI and go ham on distribution"
neobanks. They are interchangeable because they have **no context.** A neobank sees
a balance. **Pointer sees the whole trader**: positions, cost basis, realized/
unrealized P&L, risk, tax lots, behavior, KOLs they follow.

That context is the moat. It lets Financial do things a neobank structurally cannot:

- **Auto-reserve taxes** from realized gains (we know your FIFO cost basis).
- **Sweep idle USDC to yield between trades** and unwind it the instant you trade —
  because we *are* the trade engine.
- **Spend your trading balance directly** — the same dollars that trade also earn
  and also swipe. No "move money to your card."
- **Sponsor gas invisibly.** Users never pay gas, never see it. (This is table
  stakes and a respect signal — per the exact critique traders make of neobanks.)

Neobanks bolt finance onto nothing. Pointer bolts finance onto a **live view of the
user's money at work.** Same providers, categorically different product.

---

## 1. What Pointer Financial IS (positioning)

**What users think it is:** "The place my crypto money *lives* — it trades, it earns,
I can spend it, and my taxes are handled — all without leaving Pointer."

**How it feels:** Inevitable. Not "Pointer launched a bank." Instead: *"Of course
Pointer lets me do this."* It should feel like the trading app grew a wallet that
finally treats idle capital as a bug to be fixed.

**How they describe it to a friend:** "My USDC earns yield while it sits, I swipe my
Pointer card straight from my trading balance, and it auto-sets-aside my taxes. I
don't move money around — Pointer just keeps every dollar working."

**What we are replacing:** not Chase, not RBC. We replace **the need to leave
Pointer.** The off-ramp to a bank, the manual move to a yield app, the shoebox of
tax receipts, the separate debit card — all collapse into one surface.

---

## 2. The core model — The Four States of Capital

This is the spine of the entire product. Every dollar is, at every moment, in
exactly one of four states. The UI's job is to always answer two questions:
**"where is every dollar right now?"** and **"what's the best next move?"**

| State | What it is | Provider (invisible) |
|---|---|---|
| **Trading** | Deployed in token/perp positions | Jupiter / Pointer backend |
| **Earning** | Idle USDC auto-earning liquid yield | Blend (Smart Yield) |
| **Spendable** | Instantly available to swipe / send | Same USDC balance + Rain card |
| **Reserved** | Set aside for taxes (and user goals) | Segregated Reserve |

**The crucial insight: Earning and Spendable are the SAME dollars.** Your idle USDC
earns yield *and* is instantly swipeable *and* is instantly tradeable. The user
never chooses a bucket. Smart Yield runs in the background and unwinds
just-in-time the microsecond you trade or swipe. "Idle" is the only forbidden state,
and Financial's whole purpose is to eliminate it.

Everything downstream — the dashboard, the card, yield, taxes, AI — is a lens on
these four states.

---

## 3. The Home — the Capital Dashboard

The nav-island gains a **card icon** → **Financial**. The page is a **Capital
Dashboard**, not a banking app. It does not look like Mercury/Revolut/Cash App —
no account tiles, no "checking/savings." It answers "where is my money working."

**Anatomy (top → bottom):**

1. **Total Capital** — one large number: everything you hold, valued in USD.
   The hero. Tap to toggle USD ⇄ portfolio %.
2. **The Four-State Bar** — a single segmented bar under the number, split into
   Trading / Earning / Spendable / Reserved, each a color, each tappable to drill
   in. This *is* the product in one glance. A live sentence beneath it:
   *"$24,000 earning · $8,400 trading · $3,100 spendable · $900 reserved for taxes."*
3. **Pointer Card** — a real card visual (virtual by default), current spendable,
   "Add to Apple Pay," last few swipes.
4. **Smart Yield** — today's earnings ticking up, blended APY, "You earned $18.21
   while you slept," a sparkline of yield history.
5. **Tax Reserve** — quiet strip: "Reserved $912 · You're covered for estimated
   taxes." Never a nav item.
6. **PTR Points** — points earned from Financial this week, streak, next reward.
7. **Activity** — unified feed: swipes, deposits, yield accruals, reserves,
   transfers, trades that moved capital between states.
8. **AI Insights** — 1–3 proactive cards (see §9). Always at least one.

Design law: **the dashboard should make idle capital feel visibly wrong.** If a
user has $5k spendable and nothing earning, the page should gently light up an AI
nudge to fix it. The default emotional read is "my money is busy."

---

## 4. Smart Yield

Users hold mostly USDC and trade constantly. The enemy is idle balance. Smart
Yield turns idle USDC into a background yield engine that is **invisible to
trading** — funds are *always* instantly available.

**Principles:**
- **Default-on (opt-out), clearly disclosed.** New capital that sits idle >a short
  threshold auto-enrolls into liquid yield. One-tap disable, always.
- **Liquid-first.** Default is fully liquid yield (Blend). A trade or swipe triggers
  a just-in-time unwind; the user never waits, never sees a "withdraw" step.
- **Locked yield (optional, higher APY).** For capital a user explicitly parks
  ("I won't touch this for 30 days"), offer a locked tier with a clearly
  communicated APY premium and unlock date. Never the default; always a deliberate
  choice with AI framing the tradeoff.
- **Risk communication, honestly.** Plain-English: what earns the yield, that it's
  not FDIC-insured, the liquidity terms. No fake "risk-free." A single risk sheet,
  linked, not buried.
- **AI recommendations.** "You have $12k spendable doing nothing → enabling Smart
  Yield earns ~$X/mo." "You're about to trade $8k — I'll keep it liquid, no lock."
- **Projected earnings + history.** A forward projection ("~$41/mo at today's APY")
  and a yield-history sparkline/ledger. Every accrual is a line in Activity.

**The signature moment:** the morning card — *"You earned $18.21 while you slept."*
That single sentence is the product's heartbeat.

---

## 5. Pointer Card

A stablecoin Visa (Rain/Bridge, invisible). The user only ever sees "Pointer Card."

**Discovery.** The card is *earned into view*, not shoved up front. A new user
trades, funds, watches their portfolio grow — and once they have meaningful
spendable balance, Financial surfaces: *"Your capital is ready to spend anywhere.
Get your Pointer Card."* Discovery is a reward for having capital, which makes it
feel like leveling up, not a bank upsell.

**KYC timing — progressive, just-in-time.** KYC never front-loads onboarding.
- Trading, Apple Pay buys, and on-chain Smart Yield need **no/minimal** KYC.
- KYC appears **only at the exact moment a capability legally requires it** — the
  first card issuance, fiat off-ramp, or bank rails. The prompt is contextual:
  *"One quick verification to activate your card"* — with a clear payoff attached.
  Never a wall between the user and their first win.

**Activation.** Virtual card **first**, instantly, the moment KYC clears — usable in
seconds. **Add to Apple Pay / Google Pay** in one tap from the card screen.
Physical card is an **optional later** step ("order a metal card") for users who
want it — not required, not gating.

**Spending.** The card spends from **Spendable** (your USDC balance), auto-converting
stablecoin → fiat at the point of sale. Because Earning == Spendable, yield-earning
USDC is swipeable with a just-in-time unwind. **Gas is sponsored/abstracted** — the
user never sees or pays it.

**Transaction history.** Rich, trader-native: merchant, amount, category, and the
Pointer twist — **what that dollar could have been.** Each swipe optionally shows a
subtle "opportunity" read from AI (see §9) without being preachy. Real-time push
on every swipe (ties to the mobile push work).

**AI on purchases.** AI is the layer over spending: weekly spend summaries,
category insight, "you spent $1,200 this week," "this $300 = ~X% of your realized
gains," subscription detection, and — critically — **capital-aware nudges**:
*"You paid from spendable; you still have $24k earning untouched. Nice."*

---

## 6. Bank Rails

Progressive unlock (Dakota/Airwallex, invisible): **ACH · Wire · Virtual Accounts ·
Transfers · Receiving money.** This must feel like *another capability of the same
surface*, not a new app.

- **Receive money** into a Pointer virtual account (ACH/wire details that are
  "yours") — a paycheck, a client payment, a friend's transfer lands as spendable
  USD that immediately obeys the four-state model (auto-earns if idle).
- **Send / transfer** out to a bank when a user genuinely needs to leave — but the
  whole product is designed so they rarely want to.
- **Virtual accounts** unlock as trust/KYC deepens, framed as "your money's front
  door," not "open a checking account."

The framing everywhere: *not "we added banking" — "your Pointer capital can now
arrive and leave through normal rails, and it keeps working the whole time."*

---

## 7. Taxes — quiet, integrated, uniquely ours

Taxes are **not** a nav item. They live quietly inside Financial as the **Reserved**
state, powered by the one thing only Pointer has: **your trade history + cost basis.**

- On realized gains, Pointer can **auto-reserve an estimated tax %** into Reserved
  (user-set rate, sensible default, fully adjustable/optional).
- Financial shows **Tax Reserve** and **Estimated Liability**, always reconciled.
- AI reminders: *"You realized $4,200 in gains — I moved $940 to your tax reserve.
  You're covered."* / *"Estimated Q3 liability: $1,310. Reserve on track."*
- The **detailed reports** live in **Pointer Taxes** (future, Awaken-style but
  AI-first). Financial is the always-on reserve + reminder; Taxes is the report.

This is a retention superweapon: **your tax money lives at Pointer**, and the anxiety
of "am I setting aside enough?" is silently solved. A neobank cannot do this.

---

## 8. PTR Points — one ecosystem

Points already exist (trading, referrals). Financial reinforces the same system;
it must feel like **one currency**, not a second loyalty program.

- **Card spend → points** (every swipe earns; category multipliers possible).
- **Smart Yield → points / boost** (keeping capital earning at Pointer is rewarded).
- **Deposits & received transfers → points** (bringing capital in).
- **Balance kept at Pointer → a passive points drip** (holding, not just doing).
- **Tax reserve enabled, card active, rails used → engagement points.**

The strategic effect: points turn **every state of capital into a reason to keep it
at Pointer**, and make leaving quietly expensive. One ledger, surfaced on both the
Trading and Financial homes — never two point systems.

---

## 9. Pointer AI in Financial — the intelligence layer

AI is everywhere, proactive, and its prime directive is **enforce "never idle" and
surface the best next move.** Representative library (theme → line):

**Yield / idle capital**
- "You earned $18.21 while you slept."
- "You have $24,000 earning right now."
- "$12,400 is sitting spendable doing nothing — enable Smart Yield? (~$41/mo)"
- "You left ~$312 on the table this month by not earning on idle balance."
- "Your blended APY rose to 6.2% today."
- "I kept $8k liquid because you trade it often — no lock."

**Spending / card**
- "You spent $1,200 this week — 18% below your 4-week average."
- "This $300 dinner ≈ 1.4% of your realized gains this month."
- "3 subscriptions ($47/mo) hit your card — want them flagged?"
- "You paid from spendable and never touched your $24k earning. Clean."
- "Big-ticket detected: $2,100 at Apple. Reserve covered, you're fine."

**Taxes / reserve**
- "You realized $4,200 in gains — I reserved $940. You're covered for taxes."
- "Estimated Q3 liability: $1,310. Reserve on track (100%)."
- "You're **under-reserved by $220** after today's sells — top up?"
- "No taxable events this week. Reserve unchanged."

**Capital orchestration**
- "$5,000 just landed from your bank — I moved it to earning."
- "You're 92% deployed in positions; $600 spendable remains."
- "Your capital: 41% earning, 34% trading, 18% spendable, 7% reserved."
- "You haven't touched $3k in 21 days — lock it for +1.4% APY?"

**Milestones / behavior**
- "Every dollar you hold is working. Zero idle. Nice."
- "Your Pointer capital earned more this month than it cost to run your card."
- "You've kept 100% of realized-gain taxes reserved for 3 months straight."

The bar: AI should feel like a **capital co-pilot**, not notifications — every line
is either money found, money protected, or a one-tap better state.

---

## 10. The complete user journey

**Minute 0–5 (new user).** Signs in (Google/Apple, one Privy account = same as web).
Buys their first token with **Apple Pay** (Crossmint, invisible) — no KYC, no
seed phrase, token lands in their wallet. First win in under a minute.

**Day 0–7.** Trades, follows KOLs, watches portfolio. Idle USDC from a sell sits a
moment → AI: *"Enable Smart Yield?"* One tap. Now capital earns in the background.
First *"you earned $X while you slept"* card lands. The four-state bar starts to
feel alive.

**Week 2–4 (card unlock).** Spendable balance crosses a threshold → Financial
surfaces the **Pointer Card**. User taps "Get your card" → **just-in-time KYC**
(contextual, quick) → **virtual card issued instantly** → **Add to Apple Pay** →
first swipe at a coffee shop, paid straight from trading balance, gas sponsored,
real-time push. AI: *"You spent $6 and never touched your $9k earning."*

**Month 2 (rails + taxes).** User receives an ACH/virtual-account transfer (a
paycheck) → lands as spendable → auto-earns. They realize gains from a good trade →
Pointer auto-reserves the tax estimate → AI: *"You're covered for taxes."* They
notice the Reserved slice of the bar for the first time and relax.

**Month 3+ (compounding loyalty).** Points accrue from spend + yield + holding.
Physical metal card ordered (optional). The user's money now *lives* at Pointer:
it trades, earns, swipes, arrives, and reserves — never idle. Leaving would mean
unwinding an entire financial life, not exporting a wallet.

---

## 11. Progressive disclosure — the unlock ladder

Financial reveals itself in the order that keeps it feeling inevitable, never
"we launched a bank":

1. **Earn** (Smart Yield) — zero friction, no KYC, immediate delight.
2. **Card** — unlocked by having capital; first KYC, contextual.
3. **Reserve/Taxes** — appears the first time you realize gains.
4. **Rails** — unlocked as trust/KYC deepens; receive before send.
5. **Locked yield / physical card / advanced** — deliberate power-user steps.

Each rung is earned and framed as leveling up your capital, not opening an account.

---

## 12. The nav-island page (mobile)

- **Icon:** card glyph on the liquid-glass menu island (keeps the island's design
  language — no exceptions to the island itself).
- **Route:** a top-level tab → the Capital Dashboard (§3).
- **States:** empty (no capital → "fund to begin, here's what your money could do"),
  active (the full dashboard), locked-capability (greyed rungs with a clear "unlock"
  path). Reuses the existing glass system, mono + mint accent, four-state colors.
- **Continuity:** Total Capital here reconciles with the portfolio value on Home;
  PTR Points is the same ledger as Trading. One ecosystem, two lenses.

---

## 13. Provider abstraction (internal only)

Users see **only "Pointer Financial."** The plumbing, never named in-app:

| Capability | Provider (invisible) |
|---|---|
| Buy crypto (fiat → token) | Crossmint (Apple/Google Pay, card) |
| Trading | Privy + Jupiter + Pointer backend |
| Card issuance | Rain / Bridge (stablecoin Visa) |
| Yield | Blend (or equivalent liquid-yield) |
| Bank rails (ACH/wire/VA) | Dakota / Airwallex-style |
| Taxes | Pointer Taxes (future) |
| Gas | Sponsored/abstracted — always invisible |

Swapping any provider must never change the user-facing product. The abstraction
is the product's durability.

---

## 14. Long term — Pointer Financial at 2M users

At scale, Financial converts Pointer from "where crypto-natives trade" into
**"where crypto-natives' money lives."** That shift is the whole thesis.

- **Retention:** money that trades + earns + swipes + reserves + arrives at Pointer
  is money that doesn't leave. The switching cost is an entire financial life.
- **LTV:** interchange (card), yield spread, fiat on/off-ramp, and — biggest —
  **balances that stay**, compounding into more trading, more spend, more points.
- **Acquisition value:** the four-state model + tax-aware reserves + trading-context
  yield + the points flywheel is a **relationship**, not a wallet. Referrals carry
  a full financial home, not just an app.
- **Strategic-buyer view (Coinbase / Robinhood / Kraken / Phantom):** the unique,
  hard-to-copy asset is **the integrated capital OS** — a live, tax-aware,
  yield-aware, spend-aware view of each user's entire money-at-work, welded to a
  trading engine and a points economy. Anyone can wrap 4 provider APIs. **No one
  else has the trading context that makes the capital layer intelligent.** That
  context is the durable, acquirable moat.

---

## 15. Guardrails — what Financial is NOT

- **Not** a bank replacement, not "checking/savings," not Mercury/Revolut/Cash App.
- **Not** a place that ever exposes a provider name.
- **Not** a KYC wall in front of the first win.
- **Not** a product that ever lets a dollar sit idle without at least offering a
  better state.
- **Not** a redesign of Trading, AI, Portfolio, or Mobile — it *integrates into*
  them and inherits their design language.
- **Not** the thing that pulls users away from Pointer — it is the thing that makes
  leaving unnecessary.

> Trading is the heart. Financial is the bloodstream — it keeps every dollar the
> heart pumps alive, moving, and working, and never lets a single one go idle.
