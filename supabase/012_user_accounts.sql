-- Multi-user accounts: watchlists and email alerts become private and
-- per-user instead of one shared global list. Uses Supabase's built-in
-- auth.users table (created automatically by Supabase Auth) rather than a
-- custom users table.

-- watchlist_items previously had no owner at all -- every visitor shared
-- one global follow list. There is no way to know which existing rows
-- "belonged" to which future account, so this clears the table; anyone
-- who was already following something will need to sign up and re-follow.
truncate table watchlist_items;

alter table watchlist_items
  add column user_id uuid not null references auth.users (id) on delete cascade;

alter table watchlist_items drop constraint watchlist_items_pkey;
alter table watchlist_items add primary key (user_id, kind, ref_id);

drop policy if exists "Public read access" on watchlist_items;

-- Row-level security now actually does the job it's for: every operation
-- is scoped to auth.uid(), so one user can never see or modify another
-- user's follow list, even via a bug in application code.
create policy "Users can view their own watchlist" on watchlist_items
  for select using (auth.uid() = user_id);

create policy "Users can add to their own watchlist" on watchlist_items
  for insert with check (auth.uid() = user_id);

create policy "Users can remove from their own watchlist" on watchlist_items
  for delete using (auth.uid() = user_id);

-- trade_alerts_sent previously tracked "has this trade been emailed yet"
-- globally -- fine when there was one recipient, but wrong once each user
-- gets their own personalized digest: user B following a politician
-- shouldn't be silently skipped just because user A's digest already
-- covered that trade. Scope it per user instead. Existing rows have no
-- user to attach to, so this clears the dedup history -- the next digest
-- run may re-surface a backlog of already-seen top-performer trades once,
-- which is an acceptable one-time cost for correct behavior going forward.
truncate table trade_alerts_sent;

alter table trade_alerts_sent
  add column user_id uuid not null references auth.users (id) on delete cascade;

alter table trade_alerts_sent drop constraint trade_alerts_sent_pkey;
alter table trade_alerts_sent add primary key (user_id, trade_id);
