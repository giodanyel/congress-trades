-- Personal "following" list -- politicians or tickers the user wants to
-- keep a closer eye on. One generic table covers both kinds since the
-- shape is identical (what you're following, since when).
create table watchlist_items (
  kind text not null check (kind in ('politician', 'stock')),
  ref_id text not null, -- politician id (bioguide) or ticker
  created_at timestamptz not null default now(),
  primary key (kind, ref_id)
);

alter table watchlist_items enable row level security;

-- Public read so pages can render follow state without a service-role
-- call; writes only ever happen through the server (service role), same
-- pattern as every other table in this app.
create policy "Public read access" on watchlist_items
  for select using (true);
