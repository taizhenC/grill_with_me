# Publication recovery backend completion

Scope: P1-03 recoverable room creation. This feature supplies the server/database
protocol and a browser-safe, dependency-free capability helper. Browser and CLI
persistence/user flows are delivered separately.

## Changes

- Optional `Idempotency-Key` binds a 256-bit random bearer capability to the
  validated room and service origin. First creation is 201; replay is 200 with
  the same room and host token. Credential responses disable caching.
- Recovery lasts 24 hours from the immutable capability timestamp, with at most
  five minutes future skew. Changed bindings return 409; expired windows and
  removed/expired rooms return 410 without credentials or automatic recreation.
- Migration 0005 serializes creation across workers, distinguishes random room
  key collisions, leaves nullable references after deletion, and purges expired
  recovery records in existing bounded maintenance batches. Old clients without
  the header retain nonrecoverable creation.
- Privacy, operations and protocol docs describe stored hashes, clock assumptions,
  deployment order and backup limitations. A format-only shared parser permits
  saving an already committed acknowledgement that arrives just after expiry.

## Commits

- `75350ba` — atomic recovery protocol, service-only ledger, maintenance, API and
  actual database fixtures, protocol/privacy/operations documentation.
- Follow-up completion commit — format-only shared parser and this record.

## Executed validation

Windows, Node 22.15.0, PostgreSQL 17.10 in the disposable loopback `grill_test`
database; no hosted database was modified.

- `npm ci --no-audit --no-fund` passed.
- Focused API, publication, Supabase transport and retention suites: **48 passed**.
- `npm run typecheck` passed.
- `npm run test:db` passed all four sequential real database fixtures: prior
  store/quota/retention coverage plus eight concurrent publishers, identical-token
  replay, payload/origin conflicts, collision rollback, both deletion lock orders,
  expiry after waiting, expiry after ledger purge, and anonymous-role denial.
- Initial API replay test failed with duplicate 201 creation; initial database
  concurrency fixture failed because the recovery RPC was absent, before fixes.
- Format-only helper smoke and `git diff --check` passed.

Parent review read the route, binding, stores and SQL and found no blocker in
scope. Full application/build/client integration is deliberately checked after
the separate client features are combined; no hosted CI success is claimed here.

## Limitations and deployment requirements

Apply migration 0005 and verify hosted service grants/RPC availability before
enabling recovery clients. Clocks must remain synchronized. Rate limits still
apply to retries. The capability is a credential: never log headers or expose it
in URLs. Development memory mode loses all state on server restart. Recovery
records are not a historical deletion log and cannot reapply deletions after a
backup restore. Older clients without the header remain nonrecoverable. This PR
does not claim completed browser or CLI reload recovery or a public deployment.
