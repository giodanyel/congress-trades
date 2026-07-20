-- Phase 4: historical stock prices, used to estimate ROI

create table stock_prices (
  ticker text not null references stocks(ticker) on delete cascade,
  price_date date not null,
  close_price numeric not null,
  created_at timestamptz not null default now(),
  primary key (ticker, price_date)
);

create index idx_stock_prices_ticker on stock_prices(ticker);

alter table stock_prices enable row level security;

create policy "Public read access"
  on stock_prices for select
  using (true);

-- No public insert/update/delete policy: writes only happen server-side
-- using the service-role key from the price sync job, which bypasses RLS.
