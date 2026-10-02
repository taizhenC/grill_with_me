-- Fixed-window request budgets shared by every server process.
begin;
create table public.request_quotas (
  scope text not null check (scope in ('create', 'read', 'claim', 'republish')),
  bucket text not null check (bucket = 'global' or bucket ~ '^[a-f0-9]{64}$'),
  hits integer not null default 0 check (hits >= 0),
  expires_at timestamptz not null,
  primary key (scope, bucket)
);
create index request_quotas_expiry_idx on public.request_quotas(scope, expires_at);
alter table public.request_quotas enable row level security;
grant select, insert, update, delete on public.request_quotas to service_role;
create function public.consume_request_quota(
  p_scope text, p_bucket text, p_client_limit integer,
  p_global_limit integer, p_window_seconds integer
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  global_quota public.request_quotas%rowtype;
  client_quota public.request_quotas%rowtype;
  checked_at timestamptz;
  window_end timestamptz;
begin
  if p_scope is null or p_scope not in ('create', 'read', 'claim', 'republish')
    or p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$'
    or p_client_limit is null or p_client_limit not between 1 and 1000000
    or p_global_limit is null or p_global_limit not between 1 and 1000000
    or p_window_seconds is null or p_window_seconds not between 1 and 3600
  then
    raise exception using errcode = '22023', message = 'invalid quota parameters';
  end if;
  -- One global row serializes each scope; every caller locks in this order.
  insert into public.request_quotas(scope, bucket, expires_at)
    values(p_scope, 'global', clock_timestamp()) on conflict do nothing;
  select * into global_quota from public.request_quotas
    where scope = p_scope and bucket = 'global' for update;
  checked_at := clock_timestamp();
  window_end := to_timestamp(
    (floor(extract(epoch from checked_at) / p_window_seconds) + 1) * p_window_seconds
  );
  if global_quota.expires_at <= checked_at then
    update public.request_quotas set hits = 0, expires_at = window_end
      where scope = p_scope and bucket = 'global' returning * into global_quota;
  end if;
  -- Same-scope cleanup cannot deadlock: callers hold that scope's global lock.
  -- Four global rows remain; expired client rows are deleted in bounded batches.
  delete from public.request_quotas where (scope, bucket) in (
    select scope, bucket from public.request_quotas
    where scope = p_scope and bucket <> 'global'
      and expires_at <= checked_at - interval '1 hour'
    order by expires_at limit 128
  );
  if global_quota.hits >= p_global_limit then
    return jsonb_build_object('allowed', false, 'retryAfter',
      greatest(1, ceil(extract(epoch from global_quota.expires_at - checked_at))::integer));
  end if;
  -- Never create attacker-controlled client rows after global exhaustion.
  insert into public.request_quotas(scope, bucket, expires_at)
    values(p_scope, p_bucket, window_end) on conflict do nothing;
  select * into client_quota from public.request_quotas
    where scope = p_scope and bucket = p_bucket for update;
  if client_quota.expires_at <= checked_at then
    update public.request_quotas set hits = 0, expires_at = window_end
      where scope = p_scope and bucket = p_bucket returning * into client_quota;
  end if;
  if client_quota.hits >= p_client_limit then
    return jsonb_build_object('allowed', false, 'retryAfter',
      greatest(1, ceil(extract(epoch from client_quota.expires_at - checked_at))::integer));
  end if;
  update public.request_quotas set hits = hits + 1
    where scope = p_scope and bucket in ('global', p_bucket);
  return jsonb_build_object('allowed', true, 'retryAfter', 0);
end;
$$;
revoke execute on function public.consume_request_quota(text, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_request_quota(text, text, integer, integer, integer)
  to service_role;
comment on table public.request_quotas is
  'Request counters only. Client identifiers are server-HMAC hashes; expired client buckets are purged on subsequent traffic for that scope.';
commit;
