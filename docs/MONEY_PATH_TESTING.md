# Money-Path Integration Testing (§8)

Proves **exactly-once** on the real money modules under `node --test` — not just
pure math, the actual `lib/cashback`, `lib/referrals`, `lib/points` code paths.

## The harness

- **`lib/testing/fakeSupabase.ts`** — in-memory Supabase double. Supports the
  PostgREST subset the money modules use (`select/eq/neq/gte/lte/contains/filter
  (->>)/in/order/limit/maybeSingle/single/insert/upsert/update/delete`,
  head-count) **and simulates UNIQUE constraints** (`addUnique`, partial-index
  aware via a `null` signature). A duplicate insert returns SQLSTATE `23505`,
  `upsert` swallows the conflict — so idempotency is genuinely exercised, not
  assumed. Unsupported operators throw loudly. (8 self-tests.)
- **`lib/testing/stubServerOnly.ts`** — the enabler. Server modules begin with
  `import 'server-only'`, which throws under the test runner. This pre-seeds the
  CJS require cache with an empty stub so those modules import. **Import it FIRST**
  in any test that loads a server module. This unlocks testing *every* server
  module, not just money.
- **Injection seam** — `__setAdminSupabaseForTest(fake)` /
  `__resetAdminSupabaseForTest()` in `lib/supabase/server.ts` override the
  service-role client. (That file's `next/headers` use is now a lazy import so
  the admin client stays importable test-side.)

## Coverage (`tests/moneyPathIdempotency.test.ts`)

- **Cashback** — double-submit for the same trade accrues **exactly once**;
  distinct trades each accrue; zero fee accrues nothing.
- **Referral** — double-submit credits the referrer **exactly once**; no earning
  without a referral relationship.

Each asserts the *row count* in the fake after the operation, so a regression that
re-introduced a double-credit would fail the test.

## Pattern for new flows / failure injection

```ts
import '@/lib/testing/stubServerOnly';            // always first
import { FakeSupabase } from '@/lib/testing/fakeSupabase';
import { __setAdminSupabaseForTest, __resetAdminSupabaseForTest } from '@/lib/supabase/server';

const db = new FakeSupabase().addUnique('table', (r) => /* unique sig | null */);
__setAdminSupabaseForTest(db);
// drive the real module; assert db.rowCount(...) / db.allRows(...)
```

Failure injection (RPC/Redis/provider) and the remaining flows (points, packs
pay→open→fulfill, trade execute dedup) extend this same harness — tracked in the
PHASE1/Final plan as the continuation of §8.
