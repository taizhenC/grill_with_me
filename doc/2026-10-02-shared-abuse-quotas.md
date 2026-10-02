# Shared request quotas for the public beta

Completed: 2026-10-02. Upgrade plan: **P0-03 shared abuse protection**.
Branch: `codex/shared-abuse-quotas`. This feature completes the shared-quota
portion; strong room capabilities and request-byte bounds shipped separately.

## Result

Every API operation checks one atomic global/client budget before body parsing,
room lookup, rendering, or mutation, including failed attempts. Room and host
pages are protected once through Next's Node proxy before metadata/page DB
reads. Skill downloads share the read budget. Exhaustion returns HTTP 429
with `Retry-After` and `no-store`; unavailable shared quotas return a generic
503 with no private database details. Production never falls back to a local
counter; explicit development/test memory mode has the same budget behavior.

| Fixed one-hour operation budget | Per trusted client IP | Global |
|---|---:|---:|
| Create | 20 | 500 |
| Read, download, join/host page | 1,000 | 10,000 |
| Claim | 120 | 1,000 |
| Republish | 60 | 500 |

The service-role-only invoker RPC locks each operation's global row before
its client row. It increments both only when both allow the request; rejected
IP requests do not drain global capacity, and exhausted global budgets do not
allocate arbitrary new client rows. An indexed cleanup deletes up to 128
expired client rows for that operation under the same global lock, avoiding
cross-operation cleanup deadlocks. The table has RLS enabled with no browser
policies, and anon/authenticated/PUBLIC cannot execute the RPC.

Client buckets use a service-key HMAC with a quota-specific domain string.
Only hashes, counters, operation names, and expiry timestamps are stored.
IPv6 spellings normalize to the same identity. Vercel client forwarding
headers are accepted only with `VERCEL=1`; elsewhere all clients share an
unknown-client bucket unless an explicitly trusted ingress is configured with
`GRILL_TRUST_PROXY=1`. That ingress must overwrite caller forwarding headers.
Vercel documents overwriting external forwarding data to prevent spoofing.
[Vercel forwarding headers](https://vercel.com/docs/headers/request-headers#x-forwarded-for)

## Validation

- Node **24.21.0**, Windows: **293 tests passed, seven Unix-only filesystem or
  permission checks skipped**; those remain covered by Linux CI.
- TypeScript typecheck, Next **16.3.8** production build, and production skill
  traces passed. `npm audit` reported zero vulnerabilities.
- The actual compiled Next runtime passed all API and join/host-page 429 plus
  `Retry-After` checks using controlled RPC responses, then returned 503 when
  that backend failed. This caught an Error-subclass identity mismatch across
  API/proxy bundles; a stable internal error code now preserves the 503.
- Compiled cached MemoryStore checks passed: wrong token 403; absent room,
  absent role, and expired room read/claim/republish 404. Compiled APIs and
  page proxy returned 503 for missing production credentials and for forbidden
  production memory mode. `npm run test:runtime` repeats these checks in CI.
- Real **PostgreSQL 17.10** on Windows passed eight-session global/client
  contention checks, exact allowed counts, rejection accounting, allocation
  bounds after global exhaustion, budget survival in a fresh Node process,
  expired-window reset, bounded cleanup, invalid-input rejection, browser-role
  RPC denial, and RLS checks. `npm run test:db` now runs both real persistence
  and quota fixtures in the PostgreSQL CI job; `test:quotas` runs quotas alone.

All implementation commits use author and committer
`taizhenC <tzhcheung@gmail.com>` with no coauthor trailers. Changes are split
into SQL, HTTP integration, real-DB tests, compiled-runtime regression, and
this completion report.

## Deployment and limits

Apply migration `0003_shared_request_quotas.sql` after earlier migrations before
deploying. No hosted Supabase or public deployment was modified. Controlled
RPC responses validate the actual built server transport and HTTP behavior;
vanilla PostgreSQL with Supabase-style roles validates SQL concurrency and
permissions. Actual hosted Supabase API/grant/schema-cache wiring remains a
deployment smoke-test requirement.

Fixed windows permit adjacent-window bursts. Shared networks share IP budgets;
per-IP fairness requires trusted ingress. Global caps limit the heavier room
operations but quota RPC calls themselves still reach the database. Expired
client rows are purged after a one-hour grace period when later traffic arrives
for that operation; they remain physically present while that operation is
idle. Retention scheduling, hosting-level abuse controls, and operational
monitoring remain separate plan work.
