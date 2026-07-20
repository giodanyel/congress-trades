-- Phase 8: captures how many days after the actual trade it was publicly
-- disclosed. STOCK Act filers have up to 45 days to report -- showing this
-- lag in the alert email matters, since a "buy signal" that's already 30+
-- days stale is very different from one disclosed within a few days.

alter table trades add column filing_date date;
