# Explicit room privileges for hosted Supabase

On 2026-10-02 deployment preflight found that the room migration relied on
Supabase's former automatic table grants. Migration `0001_rooms.sql` enables
RLS but does not grant room SELECT, INSERT or UPDATE to `service_role`;
`0004_retention_and_room_deletion.sql` grants only DELETE. The existing
disposable database fixtures supplied the missing grants themselves, masking
the deployment dependency.

Supabase changed new-project defaults starting 2026-05-30 so newly created
public tables require explicit grants. RLS bypass does not grant table access.
This is a source/configuration finding, not a claimed failure observed on the
new hosted project. [Supabase primary changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)

`0006_explicit_room_privileges.sql` explicitly grants room SELECT, INSERT,
UPDATE and DELETE to `service_role`, and revokes direct table privileges from
PUBLIC, anon and authenticated. It retains RLS and creates no browser policies.
The migration can be applied repeatedly and after an installation that still
has the former automatic browser grants. It changes privileges without
changing room rows, tokens, tables or function definitions.

The store database fixture now starts with every room privilege revoked and
proves that even its BYPASSRLS service role receives permission denied before
the migration. It applies the actual migration, exercises real service-role
CRUD, reinstates former PUBLIC/browser grants and reapplies the migration to
verify their removal. Browser SELECT, INSERT, UPDATE, DELETE and mutation RPCs
must be denied. An independent controlled SELECT grant still checks that RLS
with no policies hides rows, then removes that test-only grant. Publication
and retention fixtures also use the actual migration instead of manually
supplying server room grants.

The operational and beta runbooks require ordered migrations through 0006.
Check each CRUD privilege individually: PostgreSQL privilege-check helpers
with a comma-separated list succeed when any listed privilege exists, so that
form does not prove all four server permissions.

The root task performs database checks after the focused feature PR is merged
and records their executed results separately. This report does not claim
hosted migrations, production smoke checks or scheduled purge verification.
