## Scope
Backend behavior for listing and closing tickets in the synthetic ticket board through `GET /api/tickets` and `POST /api/tickets/:id/close`.

## What I own
`src/api.ts`, including the Backend implementation of `GET /api/tickets` and `POST /api/tickets/:id/close`.

## What I need from other roles
The Database role owns `db/schema.sql`. The repository currently contains an observed `tickets` table with `id TEXT`, `title TEXT`, and `closed BOOLEAN`; changes to that schema remain outside the Backend role.

The Frontend role has committed to reading `response.tickets` from `GET /api/tickets`, calling `POST /api/tickets/:id/close`, and reloading the list after a successful close without an optimistic update.

## Decisions made
`GET /api/tickets` returns `{ tickets: { id: string; title: string; closed: boolean }[] }`.

`POST /api/tickets/:id/close` returns `{ id: string; closed: boolean }`.

When the requested ticket does not exist, `POST /api/tickets/:id/close` returns HTTP `404` with `{ error: 'not_found' }`.

Closing an already closed ticket is idempotent: `POST /api/tickets/:id/close` returns HTTP `200` with `closed: true`.

## Still unclear
Authentication is not agreed.

Pagination is not agreed.
