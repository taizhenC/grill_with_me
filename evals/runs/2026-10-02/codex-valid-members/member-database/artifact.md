## Scope
Database schema and migrations for the synthetic ticket board's ticket listing and closing flows.

## What I own
- `db/schema.sql`.
- The `tickets` table: `id TEXT PRIMARY KEY`, `title TEXT NOT NULL`, and `closed BOOLEAN NOT NULL DEFAULT FALSE`.
- Database migrations.

## What I need from other roles
- Backend alone writes `tickets.closed` through `POST /api/tickets/:id/close`, which returns `{ id: string; closed: boolean }`.
- Backend closes a ticket with `UPDATE tickets SET closed = TRUE WHERE id = $1`.
- Frontend never writes SQL; it calls the Backend endpoint.

## Decisions made
- New tickets default to open because `tickets.closed` is `BOOLEAN NOT NULL DEFAULT FALSE`.
- The Database role owns the schema and migrations; the Backend role owns writes to `closed`.
- The schema remains `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)` in `db/schema.sql`.

## Still unclear
- Indexes beyond the primary key are not agreed.
- Authentication is not agreed.
