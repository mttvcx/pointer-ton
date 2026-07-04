import 'server-only';

import { Redis } from '@upstash/redis';

/**
 * Single shared Upstash Redis client.
 *
 * - In production we require `UPSTASH_REDIS_REST_URL` and
 *   `UPSTASH_REDIS_REST_TOKEN`. Throwing here keeps the failure mode obvious
 *   (callers see "redis_unavailable" instead of a confusing 500 deeper in).
 * - In dev we fall back to an in-memory shim so quotas / caches still work
 *   without an Upstash account, but ttl + lifecycle is best-effort.
 */
let _client: RedisLike | null = null;

export interface RedisLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set(
    key: string,
    value: string,
    opts?: { ex?: number; nx?: boolean },
  ): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  zadd(
    key: string,
    ...members: Array<{ score: number; member: string }>
  ): Promise<number | null>;
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>;
  zcard(key: string): Promise<number>;
  zincrby(key: string, increment: number, member: string): Promise<number>;
  zrange(
    key: string,
    start: number,
    stop: number,
    opts?: { rev?: boolean; withScores?: boolean },
  ): Promise<string[]>;
  zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]>;
  zrem(key: string, ...members: string[]): Promise<number>;
  incrbyfloat(key: string, value: number): Promise<number>;
  // List ops (durable webhook queue + dead-letter queue).
  lpush(key: string, ...values: string[]): Promise<number>;
  rpop(key: string): Promise<string | null>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  llen(key: string): Promise<number>;
}

class InMemoryRedis implements RedisLike {
  private kv = new Map<string, { value: string; expiresAt: number | null }>();
  private zs = new Map<string, Array<{ score: number; member: string }>>();
  private floats = new Map<string, number>();
  private lists = new Map<string, string[]>();

  private alive(key: string): boolean {
    const row = this.kv.get(key);
    if (!row) return false;
    if (row.expiresAt != null && row.expiresAt < Date.now()) {
      this.kv.delete(key);
      return false;
    }
    return true;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.alive(key)) return null;
    const raw = this.kv.get(key)!.value;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set(
    key: string,
    value: string,
    opts?: { ex?: number; nx?: boolean },
  ): Promise<unknown> {
    if (opts?.nx && this.alive(key)) return null;
    const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : null;
    this.kv.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) {
      if (this.kv.delete(k)) n++;
      this.zs.delete(k);
      this.floats.delete(k);
    }
    return n;
  }

  async incr(key: string): Promise<number> {
    const row = this.kv.get(key);
    const cur = row && this.alive(key) ? Number(row.value) || 0 : 0;
    const next = cur + 1;
    this.kv.set(key, { value: String(next), expiresAt: row?.expiresAt ?? null });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const row = this.kv.get(key);
    if (!row) return 0;
    row.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async zadd(
    key: string,
    ...members: Array<{ score: number; member: string }>
  ): Promise<number> {
    const list = this.zs.get(key) ?? [];
    let added = 0;
    for (const m of members) {
      const idx = list.findIndex((x) => x.member === m.member);
      if (idx >= 0) {
        list[idx]!.score = m.score;
      } else {
        list.push({ score: m.score, member: m.member });
        added++;
      }
    }
    list.sort((a, b) => a.score - b.score);
    this.zs.set(key, list);
    return added;
  }

  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    const list = this.zs.get(key);
    if (!list) return 0;
    const minN = typeof min === 'number' ? min : Number(min);
    const maxN = typeof max === 'number' ? max : Number(max);
    const before = list.length;
    const filtered = list.filter((x) => !(x.score >= minN && x.score <= maxN));
    this.zs.set(key, filtered);
    return before - filtered.length;
  }

  async zcard(key: string): Promise<number> {
    return this.zs.get(key)?.length ?? 0;
  }

  async zincrby(key: string, increment: number, member: string): Promise<number> {
    const list = this.zs.get(key) ?? [];
    const existing = list.find((x) => x.member === member);
    if (existing) {
      existing.score += increment;
      this.zs.set(key, list);
      return existing.score;
    }
    list.push({ score: increment, member });
    this.zs.set(key, list);
    return increment;
  }

  async zrange(
    key: string,
    start: number,
    stop: number,
    opts?: { rev?: boolean; withScores?: boolean },
  ): Promise<string[]> {
    let list = [...(this.zs.get(key) ?? [])].sort((a, b) => a.score - b.score);
    if (opts?.rev) list = list.reverse();
    const n = list.length;
    const s = start < 0 ? Math.max(0, n + start) : start;
    const e = stop < 0 ? n + stop : stop;
    const slice = list.slice(s, e + 1);
    if (opts?.withScores) return slice.flatMap((x) => [x.member, String(x.score)]);
    return slice.map((x) => x.member);
  }

  async incrbyfloat(key: string, value: number): Promise<number> {
    const cur = this.floats.get(key) ?? 0;
    const next = cur + value;
    this.floats.set(key, next);
    this.kv.set(key, { value: String(next), expiresAt: this.kv.get(key)?.expiresAt ?? null });
    return next;
  }

  async zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]> {
    const list = [...(this.zs.get(key) ?? [])].sort((a, b) => a.score - b.score);
    const minN = min === '-inf' ? -Infinity : Number(min);
    const maxN = max === '+inf' ? Infinity : Number(max);
    return list.filter((x) => x.score >= minN && x.score <= maxN).map((x) => x.member);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    const list = this.zs.get(key);
    if (!list) return 0;
    const before = list.length;
    const filtered = list.filter((x) => !members.includes(x.member));
    this.zs.set(key, filtered);
    return before - filtered.length;
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    const list = this.lists.get(key) ?? [];
    // Redis LPUSH prepends each value in turn (last arg ends up at head).
    for (const v of values) list.unshift(v);
    this.lists.set(key, list);
    return list.length;
  }

  async rpop(key: string): Promise<string | null> {
    const list = this.lists.get(key);
    if (!list || list.length === 0) return null;
    const v = list.pop()!;
    this.lists.set(key, list);
    return v;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) ?? [];
    const n = list.length;
    const s = start < 0 ? Math.max(0, n + start) : start;
    const e = stop < 0 ? n + stop : stop;
    return list.slice(s, e + 1);
  }

  async llen(key: string): Promise<number> {
    return this.lists.get(key)?.length ?? 0;
  }
}

export function getRedis(): RedisLike {
  if (_client) return _client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    _client = new Redis({ url, token }) as unknown as RedisLike;
    return _client;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing in production');
  }

  console.warn('[redis] Upstash creds missing - using in-memory shim (dev only)');
  _client = new InMemoryRedis();
  return _client;
}
