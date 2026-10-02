-- Serialize mutations on the room row. Only the server service role may call
-- these functions; RLS remains enabled and no browser policies are introduced.
begin;

create or replace function public.claim_room(
  p_key text, p_role_slug text, p_display_name text
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  current_room public.rooms%rowtype;
begin
  select * into current_room from public.rooms where key = p_key for update;
  if not found or current_room.expires_at <= clock_timestamp() then
    raise exception using errcode = 'PT404', message = 'room or role not found';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(current_room.room -> 'roles') as role
    where role ->> 'slug' = p_role_slug
  ) then
    raise exception using errcode = 'PT404', message = 'room or role not found';
  end if;
  update public.rooms
    set claims = claims || jsonb_build_object(p_role_slug, p_display_name)
    where key = p_key;
end;
$$;

create or replace function public.republish_room(
  p_key text, p_host_token text, p_room jsonb
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  current_room public.rooms%rowtype;
  committed_version integer;
begin
  select * into current_room from public.rooms where key = p_key for update;
  if not found or current_room.expires_at <= clock_timestamp() then
    raise exception using errcode = 'PT404', message = 'room not found';
  end if;
  if current_room.host_token is distinct from p_host_token then
    raise exception using errcode = 'PT403', message = 'bad host token';
  end if;
  update public.rooms as r
    set room = p_room, version = r.version + 1,
        claims = (
          select coalesce(jsonb_object_agg(c.key, c.value), '{}'::jsonb)
          from jsonb_each(r.claims) as c
          where exists (
            select 1 from jsonb_array_elements(p_room -> 'roles') as role
            where role ->> 'slug' = c.key
          )
        )
    where r.key = p_key
    returning version into committed_version;
  return committed_version;
end;
$$;

revoke execute on function public.claim_room(text, text, text)
  from public, anon, authenticated;
revoke execute on function public.republish_room(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_room(text, text, text) to service_role;
grant execute on function public.republish_room(text, text, jsonb) to service_role;

commit;
