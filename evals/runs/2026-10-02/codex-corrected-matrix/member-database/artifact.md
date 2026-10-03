## Scope
Database schema for the synthetic ticket board's list-and-close workflow. The existing `db/schema.sql` defines `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)`.
## What I own
`db/schema.sql`, including the `tickets` table schema, and database migrations. No migrations path is currently established in the repository.
## What I need from other roles
Backend must be the only role that writes `tickets.closed`. For `POST /api/tickets/:id/close`, Backend must execute `UPDATE tickets SET closed = TRUE WHERE id = $1`. Frontend must never write SQL and must use the Backend API to close tickets. Backend already commits in `grill/backend-spec.md` to `POST /api/tickets/:id/close` returning `{ id: string; closed: boolean }`; Frontend already commits in `grill/frontend-spec.md` to using that endpoint.
## Decisions made
Keep `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)` in `db/schema.sql`, so a newly inserted ticket is open unless `closed` is explicitly supplied. Database owns the schema and migrations. The intended write boundary is that Backend alone writes `closed` through `POST /api/tickets/:id/close`, using `UPDATE tickets SET closed = TRUE WHERE id = $1`; Frontend never writes SQL.
## Still unclear
Indexes beyond the `tickets.id` primary key are not agreed. Authentication remains unagreed. Backend has not committed in `grill/backend-spec.md` to the exact SQL update or explicitly agreed to being the sole writer of `tickets.closed`; Frontend has not explicitly committed in `grill/frontend-spec.md` to never writing SQL. A migrations file or directory path is not agreed and does not currently exist in the repository.
