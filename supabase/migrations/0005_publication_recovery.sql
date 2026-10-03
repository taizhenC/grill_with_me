begin;
-- No room body, token or raw capability is copied to this short-lived ledger.
-- A removed room leaves a null reference, never a new creation opportunity.
create table if not exists public.publication_requests (
  capability_hash text primary key check (capability_hash ~ '^[a-f0-9]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  origin text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  room_id uuid references public.rooms(id) on delete set null,
  check (expires_at = issued_at + interval '24 hours')
);
create index if not exists publication_requests_expiry_idx on public.publication_requests(expires_at, capability_hash);
create index if not exists publication_requests_room_idx on public.publication_requests(room_id);
alter table public.publication_requests enable row level security;
revoke all on public.publication_requests from public, anon, authenticated;
grant select, insert, update, delete on public.publication_requests to service_role;

create or replace function public.create_room_recoverable(
  p_capability_hash text, p_payload_hash text, p_origin text, p_issued_at timestamptz,
  p_key text, p_host_token text, p_room jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  publication public.publication_requests%rowtype;
  stored public.rooms%rowtype;
  inserted integer;
  checked_at timestamptz;
begin
  if p_capability_hash is null or p_capability_hash !~ '^[a-f0-9]{64}$' or
     p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$' or
     p_origin is null or length(p_origin) < 1 or length(p_origin) > 400 or
     p_issued_at is null or not isfinite(p_issued_at) then
    raise sqlstate 'PT400' using message = 'invalid publication request';
  end if;
  checked_at := clock_timestamp();
  if p_issued_at > checked_at + interval '5 minutes' then
    raise sqlstate 'PT400' using message = 'publication clock is ahead of the service';
  end if;
  if p_issued_at + interval '24 hours' <= checked_at then
    raise sqlstate 'PT410' using message = 'publication recovery window has expired';
  end if;
  insert into public.publication_requests(capability_hash,payload_hash,origin,issued_at,expires_at)
    values(p_capability_hash,p_payload_hash,p_origin,p_issued_at,p_issued_at + interval '24 hours')
    on conflict (capability_hash) do nothing;
  get diagnostics inserted = row_count;
  select * into publication from public.publication_requests where capability_hash = p_capability_hash for update;
  -- INSERT may have waited for another worker. Check wall time after that wait.
  checked_at := clock_timestamp();
  if not found or publication.expires_at <= checked_at then
    raise sqlstate 'PT410' using message = 'publication recovery window has expired';
  end if;
  if publication.issued_at > checked_at + interval '5 minutes' then
    raise sqlstate 'PT400' using message = 'publication clock is ahead of the service';
  end if;
  if publication.origin <> p_origin or publication.payload_hash <> p_payload_hash or publication.issued_at <> p_issued_at then
    raise sqlstate 'PT409' using message = 'publication recovery belongs to another origin or payload';
  end if;
  if inserted = 1 then
    -- A rooms_key_key collision rolls back the entire call. The service retries
    -- a different random room key while keeping the same publication identity.
    insert into public.rooms(key,host_token,room,expires_at)
      values(p_key,p_host_token,p_room,checked_at + interval '30 days') returning * into stored;
    update public.publication_requests set room_id = stored.id where capability_hash = p_capability_hash;
  else
    -- Intentionally no room lock: deletion owns room then FK ledger locks.
    -- A concurrent replay may linearize before that deletion, never recreate it.
    select * into stored from public.rooms where id = publication.room_id;
    if not found or stored.expires_at <= clock_timestamp() then
      raise sqlstate 'PT410' using message = 'publication room was removed or expired';
    end if;
  end if;
  return jsonb_build_object('key',stored.key,'hostToken',stored.host_token,
    'recovery',jsonb_build_object('expiresAt',publication.expires_at,'replayed',inserted = 0));
end;
$$;
revoke all on function public.create_room_recoverable(text,text,text,timestamptz,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_room_recoverable(text,text,text,timestamptz,text,text,jsonb) to service_role;

-- Preserve the two-argument maintenance interface and add one bounded batch.
create or replace function public.purge_expired_data(p_room_limit integer, p_quota_limit integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare checked_at timestamptz := clock_timestamp(); rooms_deleted integer; quotas_deleted integer; publications_deleted integer;
begin
  if p_room_limit is null or p_room_limit < 1 or p_room_limit > 2000 or
     p_quota_limit is null or p_quota_limit < 1 or p_quota_limit > 5000 then
    raise sqlstate '22023' using message = 'invalid purge limits';
  end if;
  with expired as (
    select id from public.rooms where expires_at <= checked_at
    order by expires_at, id limit p_room_limit for update skip locked
  ) delete from public.rooms where id in (select id from expired);
  get diagnostics rooms_deleted = row_count;
  with expired as (
    select scope, bucket from public.request_quotas
    where bucket <> 'global' and expires_at <= checked_at - interval '1 hour'
    order by expires_at, scope, bucket limit p_quota_limit for update skip locked
  ) delete from public.request_quotas q using expired e where q.scope = e.scope and q.bucket = e.bucket;
  get diagnostics quotas_deleted = row_count;
  with expired as (
    select capability_hash from public.publication_requests where expires_at <= checked_at
    order by expires_at, capability_hash limit p_room_limit for update skip locked
  ) delete from public.publication_requests p using expired e where p.capability_hash = e.capability_hash;
  get diagnostics publications_deleted = row_count;
  return jsonb_build_object('roomsDeleted',rooms_deleted,'quotaBucketsDeleted',quotas_deleted,'publicationRequestsDeleted',publications_deleted);
end;
$$;
comment on table public.publication_requests is
  'Hashed publication capabilities and validated payload hashes, origin and room reference. Recovery ends 24h after immutable capability issuance; maintenance purges expired rows. Deleted room references stay null until then.';
commit;
