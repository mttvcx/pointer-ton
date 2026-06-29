/**
 * In-memory fake Supabase client for deterministic money-path tests (no I/O, no
 * server-only — importable under `node --test`). Supports the PostgREST query
 * subset the money modules use AND simulates UNIQUE constraints, so exactly-once
 * behaviour (double-submit → one row, second insert → 23505) is actually proven,
 * not assumed. Inject it via `__setAdminSupabaseForTest` (lib/supabase/server).
 *
 * It is intentionally minimal: enough to drive cashback/referral/points/trade
 * idempotency, not a full Postgres. Unsupported operators throw loudly so a test
 * can't silently pass on a query the fake didn't actually evaluate.
 */

export type Row = Record<string, unknown>;
/** Returns a row's unique signature for a constraint, or null if the row is
 *  exempt (e.g. partial index predicate not met). */
export type UniqueKeyFn = (row: Row) => string | null;

export type PgResult<T> = { data: T; error: { code: string; message: string } | null; count?: number | null };

function getPath(row: Row, path: string): unknown {
  // Supports "col" and PostgREST json arrow "metadata->>key".
  const arrow = path.split('->>');
  if (arrow.length === 2) {
    const obj = row[arrow[0]!.trim()];
    return obj && typeof obj === 'object' ? (obj as Row)[arrow[1]!.trim()] : undefined;
  }
  return row[path];
}

type Filter = { kind: 'eq' | 'neq' | 'gte' | 'lte'; col: string; val: unknown } | { kind: 'contains'; col: string; val: Row } | { kind: 'in'; col: string; vals: unknown[] };

class FakeTable {
  rows: Row[] = [];
  uniques: UniqueKeyFn[] = [];
  seq = 1;
  violates(row: Row): boolean {
    for (const u of this.uniques) {
      const sig = u(row);
      if (sig == null) continue;
      for (const existing of this.rows) {
        if (u(existing) === sig) return true;
      }
    }
    return false;
  }
}

class FakeQuery implements PromiseLike<PgResult<unknown>> {
  private filters: Filter[] = [];
  private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: Row[] = [];
  private onConflict: string | null = null;
  private headCount = false;
  private wantSingle = false;
  private wantMaybe = false;

  constructor(private table: FakeTable) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op !== 'insert' && this.op !== 'upsert') this.op = 'select';
    if (opts?.head) this.headCount = true;
    return this;
  }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) { this.op = 'upsert'; this.payload = Array.isArray(rows) ? rows : [rows]; this.onConflict = opts?.onConflict ?? null; return this; }
  update(patch: Row) { this.op = 'update'; this.payload = [patch]; return this; }
  delete() { this.op = 'delete'; return this; }

  eq(col: string, val: unknown) { this.filters.push({ kind: 'eq', col, val }); return this; }
  neq(col: string, val: unknown) { this.filters.push({ kind: 'neq', col, val }); return this; }
  gte(col: string, val: unknown) { this.filters.push({ kind: 'gte', col, val }); return this; }
  lte(col: string, val: unknown) { this.filters.push({ kind: 'lte', col, val }); return this; }
  contains(col: string, val: Row) { this.filters.push({ kind: 'contains', col, val }); return this; }
  in(col: string, vals: unknown[]) { this.filters.push({ kind: 'in', col, vals }); return this; }
  filter(col: string, op: string, val: unknown) {
    if (op !== 'eq') throw new Error(`fakeSupabase: filter op '${op}' not supported`);
    this.filters.push({ kind: 'eq', col, val });
    return this;
  }
  order() { return this; }
  limit() { return this; }
  maybeSingle() { this.wantMaybe = true; return this; }
  single() { this.wantSingle = true; return this; }

  private match(row: Row): boolean {
    for (const f of this.filters) {
      if (f.kind === 'eq' && getPath(row, f.col) !== f.val) return false;
      if (f.kind === 'neq' && getPath(row, f.col) === f.val) return false;
      if (f.kind === 'gte' && !((getPath(row, f.col) as number) >= (f.val as number))) return false;
      if (f.kind === 'lte' && !((getPath(row, f.col) as number) <= (f.val as number))) return false;
      if (f.kind === 'in' && !f.vals.includes(getPath(row, f.col))) return false;
      if (f.kind === 'contains') {
        const obj = row[f.col];
        if (!obj || typeof obj !== 'object') return false;
        for (const [k, v] of Object.entries(f.val)) {
          if ((obj as Row)[k] !== v) return false;
        }
      }
    }
    return true;
  }

  private run(): PgResult<unknown> {
    if (this.op === 'insert' || this.op === 'upsert') {
      const inserted: Row[] = [];
      for (const r of this.payload) {
        const row = { id: r.id ?? `row_${this.table.seq++}`, created_at: r.created_at ?? new Date(0).toISOString(), ...r };
        if (this.table.violates(row)) {
          if (this.op === 'upsert') continue; // upsert swallows conflicts (no-op)
          return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        }
        this.table.rows.push(row);
        inserted.push(row);
      }
      const data = this.wantSingle || this.wantMaybe ? (inserted[0] ?? null) : inserted;
      return { data, error: null };
    }
    if (this.op === 'delete') {
      const before = this.table.rows.length;
      this.table.rows = this.table.rows.filter((r) => !this.match(r));
      return { data: null, error: null, count: before - this.table.rows.length };
    }
    const matched = this.table.rows.filter((r) => this.match(r));
    if (this.headCount) return { data: null, error: null, count: matched.length };
    if (this.wantSingle) return { data: matched[0] ?? null, error: matched.length ? null : { code: 'PGRST116', message: 'no rows' } };
    if (this.wantMaybe) return { data: matched[0] ?? null, error: null };
    return { data: matched, error: null, count: matched.length };
  }

  then<R1 = PgResult<unknown>, R2 = never>(
    onF?: ((v: PgResult<unknown>) => R1 | PromiseLike<R1>) | null,
    onR?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onF, onR);
  }
}

export class FakeSupabase {
  private tables = new Map<string, FakeTable>();
  private tbl(name: string): FakeTable {
    let t = this.tables.get(name);
    if (!t) {
      t = new FakeTable();
      this.tables.set(name, t);
    }
    return t;
  }
  /** Register a UNIQUE constraint (partial-index-aware via the null return). */
  addUnique(table: string, fn: UniqueKeyFn): this {
    this.tbl(table).uniques.push(fn);
    return this;
  }
  /** Seed rows directly (bypasses constraint checks). */
  seed(table: string, rows: Row[]): this {
    this.tbl(table).rows.push(...rows);
    return this;
  }
  rowCount(table: string): number {
    return this.tbl(table).rows.length;
  }
  allRows(table: string): Row[] {
    return [...this.tbl(table).rows];
  }
  from(name: string): FakeQuery {
    return new FakeQuery(this.tbl(name));
  }
  rpc(): Promise<PgResult<unknown>> {
    return Promise.resolve({ data: null, error: null });
  }
}
