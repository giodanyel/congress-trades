-- Phase 4: precomputed estimated returns per trade.
-- Computed by /api/admin/compute-roi so the leaderboard page stays fast
-- (a handful of simple reads instead of hundreds of price lookups per view).

create type return_confidence as enum ('HIGH', 'MEDIUM', 'LOW', 'UNAVAILABLE');

create table trade_returns (
  trade_id text primary key references trades(id) on delete cascade,
  price_at_trade numeric,
  price_at_trade_date date,
  price_latest numeric,
  price_latest_date date,
  return_pct numeric,
  confidence return_confidence not null default 'UNAVAILABLE',
  computed_at timestamptz not null default now()
);

alter table trade_returns enable row level security;

create policy "Public read access"
  on trade_returns for select
  using (true);

-- No public write policy: only the service-role compute-roi job writes here.
