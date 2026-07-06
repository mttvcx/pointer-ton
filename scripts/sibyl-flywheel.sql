-- Sibyl flywheel: persistent memory + prediction→outcome dataset.
-- The compounding moat: every scan is captured forever, entities accumulate, and
-- predictions get graded against what actually happened. Service-role only (RLS
-- enabled, no policies → deny by default; the admin client bypasses). No coupling
-- to trading paths — read/write is isolated to the sibyl_* tables.

-- 1) Every scan, captured. Query in, full answer out.
create table if not exists public.sibyl_scans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  query text not null,
  subject_kind text,
  subject_ref text,
  chain text,
  mode text,
  verdict text,
  confidence int,
  action text,
  why jsonb not null default '[]'::jsonb,
  agents_run jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  caveats jsonb not null default '[]'::jsonb,
  entities jsonb not null default '[]'::jsonb,
  cards jsonb not null default '[]'::jsonb,
  model text,
  latency_ms int,
  user_id text
);
create index if not exists sibyl_scans_subject_idx on public.sibyl_scans (subject_ref);
create index if not exists sibyl_scans_kind_idx on public.sibyl_scans (subject_kind);
create index if not exists sibyl_scans_created_idx on public.sibyl_scans (created_at desc);
alter table public.sibyl_scans enable row level security;

-- 2) The memory graph. Wallets / KOLs / tokens / narratives accumulate + cross-link.
create table if not exists public.sibyl_entities (
  id text primary key,                          -- e.g. 'wallet:<addr>', 'token:<mint>', 'person:<handle>'
  kind text not null,
  name text not null,
  aliases jsonb not null default '[]'::jsonb,
  linked_wallets jsonb not null default '[]'::jsonb,
  linked_socials jsonb not null default '[]'::jsonb,
  description text not null default '',
  confidence real not null default 0.5,
  source text not null default 'sibyl',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  related_entities jsonb not null default '[]'::jsonb,
  seen_count int not null default 1,            -- how many scans have touched it (compounding signal)
  data jsonb not null default '{}'::jsonb        -- latest snapshot / flexible extras
);
create index if not exists sibyl_entities_kind_idx on public.sibyl_entities (kind);
create index if not exists sibyl_entities_last_seen_idx on public.sibyl_entities (last_seen desc);
alter table public.sibyl_entities enable row level security;

-- 3) Prediction → outcome. The dataset frontier models can't have: what Sibyl said,
--    and what actually happened.
create table if not exists public.sibyl_outcomes (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid references public.sibyl_scans(id) on delete set null,
  subject_kind text,
  subject_ref text not null,
  chain text,
  predicted_at timestamptz not null default now(),
  prediction jsonb not null default '{}'::jsonb,   -- {verdict, confidence, riskScore, mcUsd, priceUsd, liquidityUsd}
  status text not null default 'pending',           -- pending | resolved | expired
  resolved_at timestamptz,
  outcome jsonb                                     -- {mcUsd, priceUsd, multiple, maxMultiple, rugged, horizonH}
);
create index if not exists sibyl_outcomes_status_idx on public.sibyl_outcomes (status);
create index if not exists sibyl_outcomes_subject_idx on public.sibyl_outcomes (subject_ref);
create index if not exists sibyl_outcomes_predicted_idx on public.sibyl_outcomes (predicted_at desc);
alter table public.sibyl_outcomes enable row level security;

-- Atomic entity upsert with array-merge + seen_count increment (one call per scan).
create or replace function public.sibyl_record_entities(_entities jsonb, _now timestamptz)
returns void language plpgsql as $$
declare e jsonb;
begin
  for e in select value from jsonb_array_elements(coalesce(_entities, '[]'::jsonb)) loop
    if coalesce(e->>'id','') = '' then continue; end if;
    insert into public.sibyl_entities as t
      (id, kind, name, aliases, linked_wallets, linked_socials, description, confidence, source, first_seen, last_seen, related_entities, seen_count)
    values (
      e->>'id',
      coalesce(e->>'kind','token'),
      coalesce(e->>'name',''),
      coalesce(e->'aliases','[]'::jsonb),
      coalesce(e->'linkedWallets','[]'::jsonb),
      coalesce(e->'linkedSocials','[]'::jsonb),
      coalesce(e->>'description',''),
      coalesce((e->>'confidence')::real, 0.5),
      coalesce(e->>'source','sibyl'),
      _now, _now,
      coalesce(e->'relatedEntities','[]'::jsonb),
      1
    )
    on conflict (id) do update set
      name = case when coalesce(excluded.name,'') <> '' then excluded.name else t.name end,
      description = case when coalesce(excluded.description,'') <> '' then excluded.description else t.description end,
      confidence = greatest(t.confidence, excluded.confidence),
      last_seen = _now,
      seen_count = t.seen_count + 1,
      aliases = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(t.aliases || excluded.aliases) x),
      linked_wallets = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(t.linked_wallets || excluded.linked_wallets) x),
      linked_socials = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(t.linked_socials || excluded.linked_socials) x),
      related_entities = (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(t.related_entities || excluded.related_entities) x);
  end loop;
end $$;
