-- Run in Supabase SQL editor after `points_leaderboard` materialized view exists.
-- Non-CONCURRENT refresh keeps the function simple for use inside plpgsql.

create or replace function public.refresh_points_leaderboard()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.points_leaderboard;
end;
$$;

-- Allow PostgREST to invoke via service role (RPC).
grant execute on function public.refresh_points_leaderboard() to service_role;
