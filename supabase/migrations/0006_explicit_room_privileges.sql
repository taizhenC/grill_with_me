-- New Supabase projects no longer grant table access automatically. RLS
-- bypass does not supply table privileges: every server operation needs an
-- explicit grant. Browser roles and PUBLIC have no direct room access.
begin;

revoke all on table public.rooms from public, anon, authenticated;
grant select, insert, update, delete on table public.rooms to service_role;

commit;
