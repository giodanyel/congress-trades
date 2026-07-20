-- Adds an S&P 500 (SPY) benchmark alongside each trade's estimated return,
-- so "beating the market" has an actual baseline to be measured against.
alter table trade_returns add column spy_return_pct numeric;
alter table trade_returns add column alpha_pct numeric;

-- Register SPY as a tracked ticker so sync-prices picks up its history too.
insert into stocks (ticker, company_name)
values ('SPY', 'SPDR S&P 500 ETF Trust')
on conflict (ticker) do nothing;
