-- Lightweight market-news headlines, scoped to tickers Congress members
-- have actually traded, so the news feed stays relevant instead of being
-- generic financial noise. Deduped on url since that's the one thing a
-- headline source guarantees is unique.
create table market_news (
  id uuid primary key default gen_random_uuid(),
  ticker text not null references stocks (ticker),
  headline text not null,
  url text not null unique,
  source text not null,
  published_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index market_news_ticker_idx on market_news (ticker);
create index market_news_published_at_idx on market_news (published_at desc);

alter table market_news enable row level security;

create policy "Public read access" on market_news
  for select using (true);
