# Durable room persistence and atomic mutations

Completed: 2026-10-02. Upgrade plan: **P0-04**. Branch:
`codex/durable-store-correctness`. Changes are split into configuration,
database mutations, credential transport, integration checks, and this report.

## Result

Room storage defaults to Supabase. Missing, partial, malformed, or unsafe
configuration fails on first use; room APIs return a generic HTTP 503 with no
credential details. Production cannot select MemoryStore. Credential-less
local use requires `GRILL_STORE=memory` with `NODE_ENV=development` or `test`.
The environment template makes local mode explicit, and secret-free production
builds still succeed. Production service credentials require HTTPS; HTTP is
limited to localhost, 127.0.0.1, or ::1 development/test endpoints.

Migration `0002_atomic_room_mutations.sql` supplies two invoker RPCs whose
execution grants are limited to the server service role. Existing table RLS
remains enabled. Supabase recommends invoker functions and explicitly
revoking default/public execution when limiting database functions.
[Supabase function security](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker)

Claims and republishes lock the room row, then check wall-clock expiry and
authorization/role membership. This prevents independent claims overwriting
each other and prevents successful acknowledgements for skipped updates.
Each successful republish returns the actual committed version. Claims for a
removed role disappear, while surviving roles retain their claims. Authorized
concurrent republishes preserve last-committed-content behavior; no stale
compare-and-swap success is reported. MemoryStore matches these semantics.
PostgreSQL documents that a waiting `SELECT FOR UPDATE` returns the updated
row once its preceding transaction completes.
[PostgreSQL row locks](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)

## Validation

- Clean `npm ci` succeeded; `npm audit` reported zero vulnerabilities.
- Node 24.21.0 on Windows: **173 tests passed, four Unix-only filesystem tests
  skipped**. Those platform tests remain covered by the Linux CI job.
- TypeScript typecheck, Next 16.3.8 production build without storage secrets,
  skill bundle traces, and installed CLI tarball smoke checks passed.
- The real compiled Next server was started twice: missing Supabase
  credentials and forbidden production memory mode. Create, read, claim, and
  republish all returned HTTP 503 without exposing the bearer token.
- Real PostgreSQL **17.10** on Windows passed the integration fixture:
  eight visibly blocked independent sessions claimed different roles with no
  loss; 40 contended republishes returned distinct versions 2–41; mixed claims
  and republishes preserved all claims; removed-role requests and expiry were
  rejected after waiting on a lock; wrong tokens and missing rooms could not
  mutate data; anon/authenticated RPC execution and RLS-protected reads were
  denied. Applying the new migration twice also passed.

`npm run test:db` repeats these checks. Set `GRILL_TEST_DATABASE_URL` to an
empty disposable admin database named `grill_test` or `grill_test_*`.
The script refuses an existing rooms table and removes its table/functions
afterward; test roles remain in the disposable cluster. A PostgreSQL 17
service job runs the same fixture in CI. `pg` is a development dependency.
The local runtime came from the npm-integrity-checked Windows binary package
`@embedded-postgres/windows-x64@17.10.0-beta.17`, installed outside the repo
in a task-specific temporary folder; it runs ordinary PostgreSQL processes.
[Binary package source](https://github.com/leinelissen/embedded-postgres)

## Deployment and limits

Apply all Supabase migrations in order **before** deploying the updated
server. No deployment or hosted Supabase migration was performed. These
results prove actual PostgreSQL SQL concurrency and simulated Supabase-role
privileges; they do not verify a hosted Supabase project's credentials,
PostgREST schema cache, default grants, or API wiring. The real Supabase
JavaScript client's RPC transport was tested separately with controlled HTTP
responses, and a hosted project smoke test remains a deployment requirement.

Shared abuse quotas, retention/purge operations, and operational monitoring
remain separate upgrade-plan features. Local memory remains volatile by design
and must not be used to serve a public production beta.
