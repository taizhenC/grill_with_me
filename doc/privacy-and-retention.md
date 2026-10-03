# Privacy and retention

This describes the implementation and requirements for operating a copy of
grill-with-me. A repository cron declaration does not establish that a deployed
service has credentials, active scheduling or monitoring.

## Stored data and access

Publishing uploads the project brief and role definitions in `grill-room.json`.
The room row also contains its bearer room key, host token, version, display
names submitted as informational claims, and creation/expiry timestamps. Host
tokens are stored in the server database and never returned by member reads.
The Supabase service credential remains on the application server.

Recoverable publication also stores hashes of the request capability and validated
payload, its origin, issuance/expiry times and a nullable room reference. The raw
capability, room brief and host token are not copied into this ledger. Its bearer
capability can recover the original host token for 24 hours after issuance, unless
the room was deleted or expired. Keep it private. Eligible ledger rows are removed
by configured maintenance after that window; removal can be delayed by failures
or busy rows. A retry with the expired capability cannot create another room.
See [the recovery protocol](publication-recovery-protocol.md).

The application has no upload endpoint for role specs, contracts, source code or
AI conversations; those remain in the team's checkout/editor workflow. Text put
into a room brief or display name is uploaded. Do not put secrets there.

Request protection stores operation, count, expiry and a service-key-HMAC of the
ingress IP or a shared unknown identity. Raw IPs, room keys and host tokens are
absent from quota rows. Four global operation counters may remain. Providers can
separately process request metadata; provider log and backup retention is outside
this application's deletion implementation.

Anyone with a room link can read its brief, download role packs and submit claims.
Claims are informational, not accounts or authorization. The host token additionally
permits replacement/deletion. Keep room links within the team and host tokens
private. No-store/no-index/no-referrer protections cannot erase previously shared
or downloaded copies. Production service connections require HTTPS.

## Expiry and physical deletion

**Room access expires 30 days after creation. Expired rows are physically removed
by a successful configured purge.** Republishing does not extend expiry. Reads,
claims and republishing reject expired rooms even while their database row remains.

An operator can enable the daily maintenance declaration and monitor it using
[the operations runbook](operations-retention-runbook.md). Scheduling is best
effort. Failures, missed delivery, busy rows or a large backlog can delay removal;
the implementation provides no fixed physical-deletion deadline. Operators must
recover and reconcile outstanding expired data.

Client quota hashes become eligible for cleanup one hour after their fixed window
expires. Subsequent traffic removes eligible hashes for that operation in bounded
batches; configured maintenance also removes idle hashes across all operations.
Eligibility does not mean that deletion has already happened.

Hosts can remove a room before or after expiry:

```sh
node cli/grill.mjs delete <room-url>
```

This requires an explicit target and its host token. Saved credentials apply only
to the original origin/room. Prefer `GRILL_WITH_ME_TOKEN` to secret command arguments.
The API is `DELETE /api/room/<key>` with `Authorization: Bearer <hostToken>`.
A successful response confirms removal of the live database row, including its
brief, claims and stored host token. After a lost response, reconcile database
state: a 404 read alone cannot distinguish expiry from physical deletion.

Deletion preserves local packs, specs and saved credentials and cannot erase
team checkouts, screenshots, shared links, provider logs or backups. Backup copies
remain subject to the deployment operator's provider policy.

## Deployment policy

Before public use, record the actual operator, support/contact process, providers,
database region, log/backup retention and recovery policy for that deployment.
No operator contact or legal commitment is invented here. The owner must publish
its actual deployment policy and verify hosted scheduling. Local tests prove
behavior, not a hosting provider's configuration.
