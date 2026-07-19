-- Phase 2: Politicians table
-- Run this whole file in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run

create extension if not exists pgcrypto;

create type party as enum ('DEMOCRAT', 'REPUBLICAN', 'INDEPENDENT');
create type chamber as enum ('SENATE', 'HOUSE');

create table politicians (
  id text primary key default gen_random_uuid()::text,
  first_name text not null,
  last_name text not null,
  full_name text not null,
  party party not null,
  state text not null,
  chamber chamber not null,
  photo_url text,
  bio text,
  net_worth_usd bigint,
  committees text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_politicians_state on politicians(state);
create index idx_politicians_party on politicians(party);
create index idx_politicians_chamber on politicians(chamber);

-- Sample rows so we can prove the app -> database pipeline works end to end
insert into politicians (first_name, last_name, full_name, party, state, chamber, committees, net_worth_usd, bio)
values
  ('Nancy', 'Pelosi', 'Nancy Pelosi', 'DEMOCRAT', 'CA', 'HOUSE',
   array['House Permanent Select Committee on Intelligence'], 120000000,
   'U.S. Representative for California''s 11th congressional district; former Speaker of the House.'),
  ('Tommy', 'Tuberville', 'Tommy Tuberville', 'REPUBLICAN', 'AL', 'SENATE',
   array['Senate Armed Services Committee'], 15000000,
   'U.S. Senator for Alabama.'),
  ('Ro', 'Khanna', 'Ro Khanna', 'DEMOCRAT', 'CA', 'HOUSE',
   array['House Committee on Oversight and Accountability'], 20000000,
   'U.S. Representative for California''s 17th congressional district.');

-- Row Level Security: enabled with a public read-only policy.
-- The anon key (used in the browser/app) can SELECT but cannot INSERT/UPDATE/DELETE.
-- We'll use a service-role key for admin writes in a later phase.
alter table politicians enable row level security;

create policy "Public read access"
  on politicians for select
  using (true);
