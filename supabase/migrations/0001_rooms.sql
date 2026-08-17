-- grill-with-me: rooms
--
-- One table. Packs are rendered from `room` (jsonb) at download time, so
-- there is no role_packs table to keep in sync. All access goes through the
-- server with the service key; RLS is enabled with no policies so the anon
-- key can do nothing at all.

create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  host_token  text not null,
  version     int  not null default 1,
  room        jsonb not null,
  claims      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists rooms_expires_at_idx on rooms (expires_at);

alter table rooms enable row level security;
-- No policies on purpose: only the service key (which bypasses RLS) may
-- touch this table. The anon key is never used server- or client-side.

comment on table rooms is
  'grill-with-me rooms. room is the validated grill-room.json; claims maps role_slug -> display name. Rows past expires_at are dead — a scheduled job may purge them.';
