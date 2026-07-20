-- Phase 9: how much the price had already moved by the time a trade was
-- publicly disclosed. STOCK Act filers have up to 45 days to report, so
-- this shows concretely -- not just as a day count -- how stale a "signal"
-- already was the moment it became public.

alter table trade_returns add column price_at_filing numeric;
alter table trade_returns add column price_at_filing_date date;
alter table trade_returns add column pre_disclosure_move_pct numeric;
