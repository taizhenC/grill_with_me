## Scope
Backend support for listing and closing tickets in the synthetic ticket board through `GET /api/tickets` and `POST /api/tickets/:id/close`.

## What I own
`src/api.ts`, including `GET /api/tickets` returning `{ tickets: { id: string; title: string; closed: boolean }[] }` and `POST /api/tickets/:id/close` returning `{ id: string; closed: boolean }`.

## What I need from other roles
Database owns `db/schema.sql` and the existing `tickets` table with `id TEXT PRIMARY KEY`, `title TEXT NOT NULL`, and `closed BOOLEAN NOT NULL DEFAULT FALSE`. Frontend consumes `response.tickets` from `GET /api/tickets` and calls `POST /api/tickets/:id/close`, as recorded in `grill/frontend-spec.md`.

## Decisions made
`GET /api/tickets` keeps the response shape `{ tickets: { id: string; title: string; closed: boolean }[] }`. `POST /api/tickets/:id/close` keeps the response shape `{ id: string; closed: boolean }`. A missing ticket returns HTTP 404 with `{ error: 'not_found' }`. Closing an already closed ticket is idempotent: it returns HTTP 200 with `{ id: string; closed: true }`.

## Still unclear
Authentication is not agreed. Pagination for `GET /api/tickets` is not agreed.
