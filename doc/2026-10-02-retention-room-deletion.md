# Retention and host deletion completion — 2026-10-02

Implemented the public-beta retention feature from main `8419bcd` in six focused
commits under the owner's author and committer identity, without coauthor trailers.
This report records local validation; deployment/scheduling/monitoring setup remains
an owner-operated release gate.

## Result

- Host-authorized `DELETE /api/room/<key>` physically removes the room row, even
  after access expiry. Atomic row locking prevents queued claim/republish calls
  from restoring deleted content. The API shares republish quotas and returns
  401/403/404 for missing authorization, bad token or absent row.
- `delete <room-key|url>` in the CLI requires an explicit target and reuses exact
  origin/room credential binding. It refuses redirects/retries, validates the
  server confirmation and preserves local packs, specs and saved credentials.
- Migration 0004 adds service-role-only deletion and bounded cleanup RPCs. Each
  purge transaction removes expired rooms and stale client quota hashes together,
  skips locked rows, preserves global counters and returns actual deletion counts.
- Maintenance GET/POST requires a separate strong `CRON_SECRET`. Auth fails before
  backend access; failures/responses never include credentials or content. Work
  stops starting batches after 20 seconds or 20 batches, each RPC has a 5-second
  timeout, and the route explicitly sets a 30-second function limit.
- `vercel.json` declares a daily 03:00 UTC purge, compatible with Hobby frequency.
  This declares configuration only; it creates no hosted schedule or alert.
- [Privacy/retention](privacy-and-retention.md) and
  [operations/recovery](operations-retention-runbook.md) document aggregate
  monitoring, missed/failed run recovery, backlog reconciliation, provider copies,
  rollback and restore limits. README and the release runbook point to them.

Required wording: **Access expires 30 days after room creation. Physical removal
requires a successful configured purge.** Daily scheduling is best effort, and
failures/busy rows/backlogs require operator reconciliation. There is no hard
physical-deletion deadline or claim of a deployed cron.

## Validation

Windows, official Node 24.21.0, and real PostgreSQL 17.10:

- Full Vitest suite: 425 passed, 8 platform-dependent tests skipped; typecheck passed.
- Secret-free production build passed and emitted `maxDuration:30` for the
  maintenance route in its functions manifest.
- Actual compiled Next server checks passed for DELETE 401/403/404/200, expired
  host deletion, authenticated/repeated maintenance GET/POST, physical memory
  removal, shared quota 429/503 and invalid production storage 503 across bundles.
- Actual CLI loopback tests passed for explicit targets, scope binding, method,
  authorization, redirect refusal, redaction and preservation of local files.
  The credential/deletion suite also passed on Node 22.15.0: 40 passed, 3 skipped.
- `npm run test:db` passed all store, quota and retention fixtures. Retention used
  eight independent SQL sessions to prove physical deletion, queued-writer 404,
  concurrent bounded purge totals, busy-row skip/reconciliation, rollback of both
  room/quota deletions on failure, input bounds, RLS and browser-role 42501.
- Installed CLI archive verification, production skill tracing and dependency
  audit passed; audit reported zero vulnerabilities. No runtime dependency added.

The database runtime was a temporary Windows PostgreSQL 17.10 distribution from
the pinned `@embedded-postgres/windows-x64@17.10.0-beta.17` package with npm integrity
verification. It ran on loopback in a disposable `grill_test` database. The fixtures
refuse existing application tables and clean up tables/functions they own. Test
roles remain in the disposable cluster; no project credentials or live data used.

## Review and limits

The parent independently reviewed SQL, auth, deletion, fixtures and runtime code;
no correctness blocker was found. Its operator-duration/failure-event requests
were incorporated. Bundled Next 16 route-handler and duration guides were read
before route changes.

This proves vanilla PostgreSQL behavior and simulated Supabase-role privileges,
plus real client transport and compiled server behavior. It does not prove an
actual Supabase project's API/schema cache, service grants, region or backups, or
Vercel's active schedule, plan/settings or monitoring. These require the owner's
deployment access and recorded hosted checks before public release.

A 200 maintenance response and `needsAnotherRun=false` are not an empty-backlog
certificate because locked rows may be skipped. Earlier batches may have committed
before a later 503. Restore can reintroduce deleted rows; no historical host-deletion
tombstones are stored. Provider backups/logs and downloaded copies are outside
this live-row deletion feature. No external deployment, publication or contact
with another person occurred.

Official facts checked 2026-10-02: [Hobby daily/hour precision](https://vercel.com/docs/cron-jobs/usage-and-pricing),
[secret authorization and best-effort/no-retry delivery](https://vercel.com/docs/cron-jobs/manage-cron-jobs),
and [current Vercel duration configuration](https://vercel.com/docs/functions/configuring-functions/duration).
