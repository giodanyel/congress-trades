-- Phase 7: lets the daily sync tell "already imported" trades apart from
-- genuinely new ones without wiping the table. Existing rows (from the
-- bundled seed) are left with a null external_id -- that's fine, they just
-- won't be touched by future syncs.

alter table trades add column external_id text;
create unique index idx_trades_external_id on trades(external_id) where external_id is not null;
