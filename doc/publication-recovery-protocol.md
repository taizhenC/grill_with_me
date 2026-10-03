# Publication recovery protocol

`POST /api/rooms` accepts the existing room JSON body and an optional
`Idempotency-Key` credential. Without the header, creation remains compatible
with older clients but is **not recoverable after a lost response**.

A recovery capability is `v1.<Unix issuance seconds>.<64 lowercase hex digits>`.
Generate the secret with 32 cryptographically random bytes using the shared
browser/server/CLI module `cli/publication-capability.mjs`. Never put the header
in URLs, output, analytics or logs. Possession authorizes recovery of the host
token, so treat it like the host token itself.

Persist the immutable capability, target origin and original request body before
sending. The window ends 24 hours after the embedded timestamp; up to five minutes
of future clock skew is accepted. Retry the same request after an unknown outcome.
Do not automatically generate another capability on any failure or expiry. A new
publication requires an explicit user decision and can create another room.

The server binds the capability hash to the validated service origin (configured
`GRILL_PUBLIC_ORIGIN` or validated ingress under the existing trust policy) and
SHA-256 of the schema-normalized room. Unknown fields, JSON whitespace and object
key order are excluded by validation; changed validated fields conflict. Clients
may enforce stricter raw-body matching before retrying. Room and host token are
created atomically with that binding.

First creation returns HTTP 201; replay returns 200. Both are `Cache-Control:
no-store` and return `{key, hostToken, url, recovery: {expiresAt, replayed}}`.
`expiresAt` is a canonical ISO timestamp matching the capability's timestamp plus
24 hours; `replayed` is a boolean. Errors return `{code, errors: string[]}`:

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `publication_invalid` | Invalid capability or excessive clock skew |
| 409 | `publication_conflict` | Capability was bound to another origin/payload |
| 410 | `publication_gone` | Recovery window elapsed or original room removed/expired |

No error response includes the capability, original room key or host token. A new
random capability does not give access to another publication's credentials.
Create rate limits still apply to retries. Schema validation and quota failures
do not create a room or publication ledger entry.

Migration `0005_publication_recovery.sql` adds a service-only ledger containing
hashes, origin, timestamps and a nullable room reference. Deletion nulls that
reference; replay returns 410 rather than recreating a room. Maintenance can
purge the entry once recovery expires because the original immutable capability
is rejected by its timestamp even when no ledger row exists. A deployment must
keep clocks synchronized; database time checks repeat after transaction waits.

Concurrent creation uses a unique capability hash plus transaction serialization.
The room's independent unique-key collision rolls back the entire transaction;
only that collision is retried with a new random room key. Replay does not acquire
a room lock while holding the ledger lock, avoiding a cycle with deletion's
foreign-key update. A replay concurrent with deletion may complete just before
the deletion; a retry after committed deletion is denied. See PostgreSQL's
[INSERT conflict handling](https://www.postgresql.org/docs/17/sql-insert.html),
[foreign-key actions](https://www.postgresql.org/docs/17/ddl-constraints.html), and
[Read Committed visibility](https://www.postgresql.org/docs/17/transaction-iso.html).

This guarantees recovery within the same durable deployment and window. Memory
development mode loses rooms and recovery state when the server restarts. Backup
restores must reconcile deletion/expiry under the operator policy; the short-lived
ledger is not a historical deletion log. Hosted database grants, RPC availability
and ingress configuration require deployment checks.
