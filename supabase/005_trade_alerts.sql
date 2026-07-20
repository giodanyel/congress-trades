-- Phase 6: tracks which trades have already triggered an email alert, so
-- the daily digest cron only reports genuinely new trades instead of
-- re-sending the same ones every run.

create table trade_alerts_sent (
  trade_id text primary key references trades(id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table trade_alerts_sent enable row level security;

-- No public policies on purpose: only the service-role cron job reads/writes
-- this table. Nothing here needs to be publicly readable.
