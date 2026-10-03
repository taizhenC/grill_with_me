# Retention and service operations

These files prepare configuration and recovery; no hosted schedule, credentials,
alert or public deployment has been created by committing them.

## Configure and verify

Apply all migrations in order, including `0005_publication_recovery.sql`.
Deletion/cleanup functions are security invoker, use an empty search path and
allow only service-role execution. Keep RLS enabled without browser policies.
Verify actual Supabase grants and RPC/schema-cache availability after migration;
the vanilla PostgreSQL fixture cannot verify hosted API configuration.

Set server-only `GRILL_STORE=supabase`, HTTPS `SUPABASE_URL`, and
`SUPABASE_SERVICE_KEY`. Generate a separate random 32-byte base64url secret with
Node's `crypto.randomBytes(32).toString("base64url")` and save it as `CRON_SECRET`
through hosting settings. The endpoint requires 32–256 URL-safe characters.
Never put secrets in Git, tickets, URLs, screenshots or logs. Missing/invalid
maintenance configuration returns 503; wrong credentials return 401 before backend
access. Rotate the secret after suspected exposure.

`vercel.json` declares GET `/api/maintenance/purge` at `0 3 * * *` (03:00 UTC
daily); Vercel supplies Bearer authorization from `CRON_SECRET`. After an authorized
production deployment, confirm this cron is enabled on the intended project and
revision, and verify an authenticated invocation. Local/preview builds do not prove
scheduled delivery. [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

The daily expression fits Hobby's once-per-day restriction; Hobby invocation can
occur anywhere during the selected hour. Pro/Enterprise support more frequent
schedules. Verify the actual plan before increasing frequency.
[Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

The route exports `maxDuration=30`; verify 30 seconds in the built
`.next/server/functions-config-manifest.json` and the deployed function settings.
Current Vercel Fluid limits allow 300 seconds on Hobby; other deployment settings
must still permit this route's configured limit. Each RPC times out after 5 seconds;
the application stops starting batches after 20 seconds or 20 batches.
[Vercel duration configuration](https://vercel.com/docs/functions/configuring-functions/duration)

## Results and monitoring

Each atomic database batch deletes at most 1,000 expired rooms, 1,000 expired
publication ledger entries and 2,000 client hashes whose window expired at least
one hour ago. Global counters remain. One invocation removes at most 20,000 rooms,
20,000 publication entries and 40,000 client hashes; time limits can
stop it earlier. Busy rows are skipped and retried later; repeated/concurrent
purges do not double-delete data.

HTTP 200 returns aggregate `roomsDeleted`, `quotaBucketsDeleted`,
`publicationRequestsDeleted`, `batches` and
`needsAnotherRun`. Full batches or a time/batch limit set the backlog hint.
**`needsAnotherRun=false` does not certify an empty backlog:** rows can be locked.
If a later batch fails, earlier batches may have committed. A 503 is not proof
that no deletion occurred; safely retry and reconcile aggregate database counts.

Before admitting public users, configure operator-owned monitoring for 503/504,
`needsAnotherRun=true`, an old/growing backlog, or no successful completion event
within 26 hours. Fixed failure events are `retention purge failed; reconcile and
retry` and `retention purge configuration unavailable`. Success events contain
counts only. Never add headers, keys, briefs, claims, IP identities or exception
objects to logs.

Vercel delivery is best effort and can miss/duplicate runs; failures are not
automatically retried. A missed request creates no runtime event, so absence of
success must also be monitored.
[Vercel delivery and errors](https://vercel.com/docs/cron-jobs/manage-cron-jobs#cron-job-delivery-and-idempotency)

## Recovery

Check configuration, active cron target, grants/RPC availability, database health
and locks, and hosting duration. Set `GRILL_SERVICE_ORIGIN` to the verified HTTPS
origin and `CRON_SECRET` privately through the environment/secret manager. This
manual POST command passes no secret argument, refuses redirects and performs
one request without automatic retries:

```sh
node --input-type=module -e 'const r = await fetch(new URL("/api/maintenance/purge", process.env.GRILL_SERVICE_ORIGIN), {method:"POST",redirect:"error",headers:{authorization:"Bearer "+process.env.CRON_SECRET},signal:AbortSignal.timeout(35000)}); if(!r.ok)throw new Error("Purge HTTP "+r.status); console.log(await r.json());'
```

Repeat recovery invocations as needed and reconcile via the operator database
connection without displaying content or keys:

```sql
select count(*) as expired_rooms, min(expires_at) as oldest_room_expiry
from public.rooms where expires_at <= clock_timestamp();
select count(*) as stale_client_hashes, min(expires_at) as oldest_window_expiry
from public.request_quotas
where bucket <> 'global' and expires_at <= clock_timestamp() - interval '1 hour';
select count(*) as expired_publications, min(expires_at) as oldest_recovery_expiry
from public.publication_requests where expires_at <= clock_timestamp();
```

Investigate persistent locks and retry after they clear. If daily capacity is
insufficient, recover manually and revise capacity/scheduling on a suitable plan.
Access expiry still denies expired room reads and mutations during an outage.

Host DELETE shares republish budgets: 60/client/hour and 500/global/hour. Valid
hosts can delete expired rows. Missing token/invalid token/absent row produce
401/403/404. Success confirms row removal; timeout can have an uncertain outcome.

## Release, rollback and restore

Run `npm test`, `npm run typecheck`, secret-free `npm run build` and
`npm run test:runtime`. Run `npm run test:db` only against an empty disposable
PostgreSQL 17 database named `grill_test` or `grill_test_*`. Fixtures refuse existing
application tables and remove tables/functions they own; test roles remain in
the disposable cluster. These checks do not prove hosted Supabase/Vercel setup.
Complete actual hosted auth/RLS/RPC/expiry checks and record schedule/monitoring
evidence in `doc/`; also follow [the beta runbook](beta-release-runbook.md).

Code rollback can retain additive functions/index. Disable or retarget scheduling
if rolling back to code without this route; do not drop application data for code
rollback. Purged rows cannot be recovered from the live database. Document backup
retention/recovery rights before release. A restore can reintroduce deleted or
expired rows: immediately reconcile expiry and handle host-deleted data under
the deployment's recovery policy. The publication ledger only prevents retrying
a removed publication during its 24-hour recovery window; it is not a historical
deletion log and cannot reapply host deletions after backup restore. Keep service
and database clocks synchronized and exclude `Idempotency-Key` headers from logs.
