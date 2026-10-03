# Database spec

## Scope
The Database layer of the synthetic ticket board (`grill/PROJECT.md`): the
`tickets` table definition in `db/schema.sql` and the SQL write statement that
closes a ticket. The demo must support listing tickets and closing a ticket.

Not in this scope: HTTP endpoints, status codes, and response bodies (Backend,
per `grill/backend-spec.md`), and the list UI (Frontend, per
`grill/frontend-spec.md`).

## What I own
- `db/schema.sql` — currently one statement (observed, `db/schema.sql:1`):
  `CREATE TABLE tickets (id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE);`
- Schema and migrations for the `tickets` table. I claimed migrations in the
  grill; no migration directory, file-naming scheme, or migration tool was
  agreed, so those are under "Still unclear" and no path other than
  `db/schema.sql` is settled here.

## What I need from other roles
Requests, not agreements — none of these has been confirmed by the role named.

- Backend: be the only writer of `tickets.closed`, and write it only through
  `POST /api/tickets/:id/close`. `grill/backend-spec.md:5` commits Backend to
  owning that endpoint returning `{ id: string; closed: boolean }`, but their
  spec does not state that Backend is the sole writer of the column.
- Backend: use the column names and types exactly as in `db/schema.sql:1`.
  `grill/backend-spec.md:7` already asks Database for
  `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL)`;
  it names no default, which is an omission, not a rejection of
  `DEFAULT FALSE`.
- Backend: execute the close write as
  `UPDATE tickets SET closed = TRUE WHERE id = $1`.
- Frontend: never write SQL; reach ticket data only through Backend's HTTP
  endpoints. `grill/frontend-spec.md` does not mention SQL either way; the
  observed `src/TicketList.ts:1` calls `GET /api/tickets` and
  `POST /api/tickets/:id/close` through an injected `fetcher`.

## Decisions made
- `tickets.closed` is `BOOLEAN NOT NULL DEFAULT FALSE`. This is my explicit
  decision, not merely inherited code: a newly inserted row is open without the
  inserter naming the column. `NOT NULL` with a default still satisfies
  Backend's `NOT NULL` request.
- The `tickets` table stays exactly
  `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)`
  in `db/schema.sql` — no column additions, renames, or type changes.
- Backend alone writes `tickets.closed`, and does so through
  `POST /api/tickets/:id/close`. Frontend never writes SQL.
- Closing a ticket uses the statement
  `UPDATE tickets SET closed = TRUE WHERE id = $1`.
- I own the schema and its migrations.

## Still unclear
- Indexes beyond the `id` primary key: unagreed. No secondary index is
  specified for `title` or `closed`.
- Authentication policy: unagreed. `grill/backend-spec.md:11` also lists it as
  not agreed, and `src/auth.ts:1` observably returns `'not yet agreed'` from
  `sessionPolicy()`.
- Backend's agreement to the three requests above (sole writer of `closed`,
  exact column names and types, the `UPDATE` statement as written) is pending.
- Frontend's agreement that it never writes SQL is pending.
- Migration mechanics: directory, file naming, ordering, and tooling are not
  agreed, and whether migration files may live outside `db/schema.sql` is
  unresolved.
- The database engine and SQL dialect are not named anywhere in the repo. The
  `$1` placeholder and the `TRUE` / `BOOLEAN` literals were my question's
  phrasing carried into your answer; no engine choice was decided.
- How the Database layer signals that no row matched the close `UPDATE` (for
  example rows-affected) is not agreed. `grill/backend-spec.md:10` decides a
  missing ticket returns HTTP 404 with `{ error: "not_found" }`, but the
  mechanism Backend reads to reach that decision is unspecified.
- The read path for Backend's `GET /api/tickets` has no agreed SQL statement,
  ordering, or pagination. `src/api.ts:2` observably returns a hard-coded
  single ticket and touches no database.
- Behavior when closing an already-closed ticket (idempotent re-`UPDATE` versus
  a distinguished outcome) is not agreed.
- Who supplies schema tests or assertions, and which file they live in, is not
  agreed; nothing here excludes such a file from another role's ownership.
