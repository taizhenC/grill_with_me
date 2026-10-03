# Database spec

## Scope

The SQL storage layer for the synthetic ticket board (`grill/PROJECT.md`: list a
ticket and close a ticket). This covers the `tickets` table definition and its
schema changes over time. It does not cover the HTTP API (Backend) or any UI
(Frontend).

Observed in the repo today, not decided here:

- `db/schema.sql:1` contains `CREATE TABLE tickets (id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE);`
- `src/api.ts` is a stub: `listTickets()` returns hardcoded `{ tickets: [{ id: "t1", title: "Demo", closed: false }] }` and `closeTicket(id)` returns `{ id, closed: true }` without touching SQL.
- `src/auth.ts` `sessionPolicy()` returns `'not yet agreed'`.
- There is no migrations directory or migration file in this checkout.

## What I own

- `db/schema.sql` — the `tickets` table:
  - `id TEXT PRIMARY KEY`
  - `title TEXT NOT NULL`
  - `closed BOOLEAN NOT NULL DEFAULT FALSE`
- Migrations for this schema (future changes to `tickets` and any later tables).
  The migration tool, file layout, and whether the current `db/schema.sql` is
  restated as an initial migration are not yet decided — see "Still unclear".

## What I need from other roles

Requests to Backend (not yet agreed by Backend):

- Backend is the only writer of `tickets.closed`, and it writes it only while
  serving `POST /api/tickets/:id/close` (Backend owns that endpoint per
  `grill/backend-spec.md:5`, returning `{ id: string; closed: boolean }`).
- That close path issues `UPDATE tickets SET closed = TRUE WHERE id = $1`.
- Inserts of a new ticket may name only `id` and `title`; `closed` then falls to
  `DEFAULT FALSE`. Backend may also pass `closed` explicitly.

Request to Frontend (not yet agreed by Frontend):

- Frontend issues no SQL and never writes `tickets` directly; it reaches the data
  only through Backend's HTTP endpoints. This is consistent with
  `grill/frontend-spec.md:5` (`src/TicketList.ts` reads `response.tickets` from
  `GET /api/tickets`), but Frontend has not stated it.

Already committed by Backend, which this schema satisfies:

- `grill/backend-spec.md:7` asks Database to own
  `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL)`.
  The columns and types match; Backend's line omits the default rather than
  rejecting it.
- `grill/backend-spec.md:4` serves `GET /api/tickets` as
  `{ tickets: { id: string; title: string; closed: boolean }[] }`, which maps
  one-to-one onto the three columns above.

## Decisions made

- `db/schema.sql` keeps `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)`.
  `closed` keeps `DEFAULT FALSE`, so an insert naming only `id` and `title`
  yields an open ticket.
- Write ownership of `closed`: Backend alone writes it, through
  `POST /api/tickets/:id/close`. Frontend never writes SQL.
- The closing write is `UPDATE tickets SET closed = TRUE WHERE id = $1`.
- Schema and migrations are owned by the Database role.

## Still unclear

- Indexes beyond the `id` primary key: not agreed.
- Authentication policy: not agreed. `grill/backend-spec.md:9` also records this
  as open, and `src/auth.ts` still returns `'not yet agreed'`.
- Backend's agreement to the three requests above (sole writer of `closed`, the
  exact `UPDATE ... WHERE id = $1` statement, and relying on `DEFAULT FALSE` for
  inserts) is pending.
- Frontend's agreement that it never writes SQL is pending.
- Reopening a ticket (any write setting `closed = FALSE` after close) is not
  agreed; only the set-to-`TRUE` statement above is.
- Behavior when `POST /api/tickets/:id/close` names an id that is not in
  `tickets`: the `UPDATE` matches zero rows, but how Backend detects that and
  turns it into the HTTP 404 `{ error: "not_found" }` from
  `grill/backend-spec.md:8` (affected-row count or a prior read) is not agreed.
- The SQL engine and client library are not agreed. The `$1` placeholder is
  PostgreSQL-style, while `grill/PROJECT.md` says only "TypeScript; SQL".
- Migration tooling, migration file paths, and whether the existing
  `db/schema.sql` is also expressed as an initial migration: not agreed.
- Seed or demo rows: not agreed. The `t1`/`"Demo"` values in `src/api.ts` are a
  stub's hardcoded response, not an agreed fixture.
