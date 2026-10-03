## Scope
Database schema and migrations for the synthetic ticket board's `tickets` table.

## What I own
`db/schema.sql` and database migrations. The schema defines `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)`.

## What I need from other roles
Backend alone writes `tickets.closed` through `POST /api/tickets/:id/close`, using `UPDATE tickets SET closed = TRUE WHERE id = $1`. Frontend never writes SQL and accesses ticket data through Backend's API.

## Decisions made
New tickets default to open when `closed` is omitted: `closed BOOLEAN NOT NULL DEFAULT FALSE`. Database owns schema and migrations. Backend is the sole writer of `tickets.closed`; Frontend does not write SQL.

## Still unclear
Indexes beyond the primary key are not agreed. Authentication remains unagreed.
