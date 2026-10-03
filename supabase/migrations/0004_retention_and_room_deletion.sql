-- Host-authorized removal also works after access expiry. The row lock
-- serializes with claim/republish so neither can resurrect a deleted room.
begin;
create index if not exists request_quotas_retention_idx
  on public.request_quotas(expires_at, scope, bucket) where bucket <> 'global';
create or replace function public.delete_room(p_key text, p_host_token text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare stored public.rooms%rowtype;
begin
  select * into stored from public.rooms where key = p_key for update;
  if not found then raise sqlstate 'PT404' using message = 'room not found'; end if;
  if p_host_token is null or stored.host_token <> p_host_token then
    raise sqlstate 'PT403' using message = 'bad host token';
  end if;
  delete from public.rooms where id = stored.id;
  return true;
end;
$$;

-- A bounded transaction removes expired content and idle client hashes.
-- Concurrent/repeated maintenance is safe. Busy rows are retried next run.
create or replace function public.purge_expired_data(p_room_limit integer, p_quota_limit integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare checked_at timestamptz := clock_timestamp(); rooms_deleted integer; quotas_deleted integer;
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
  ) delete from public.request_quotas q using expired e
    where q.scope = e.scope and q.bucket = e.bucket;
  get diagnostics quotas_deleted = row_count;
  return jsonb_build_object('roomsDeleted', rooms_deleted, 'quotaBucketsDeleted', quotas_deleted);
end;
$$;

grant delete on public.rooms to service_role;
revoke all on function public.delete_room(text, text) from public, anon, authenticated;
revoke all on function public.purge_expired_data(integer, integer) from public, anon, authenticated;
grant execute on function public.delete_room(text, text) to service_role;
grant execute on function public.purge_expired_data(integer, integer) to service_role;
comment on table public.rooms is
  'Room access expires at expires_at. Hosts can physically delete rows; configured maintenance purges expired rows in bounded batches.';
comment on table public.request_quotas is
  'Request counters only. Client identifiers are server-HMAC hashes; stale client buckets are purged by subsequent traffic or configured maintenance.';
commit;
