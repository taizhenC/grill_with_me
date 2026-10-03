## Scope
Backend behavior for listing and closing tickets. `src/api.ts` currently exposes paths for `GET /api/tickets` and `POST /api/tickets/:id/close`; its current `closeTicket(id)` implementation always returns `{ id, closed: true }` and does not handle an unknown ticket ID.

## What I own
The Backend role owns `src/api.ts`. The Database role owns `db/schema.sql`.

## What I need from other roles
The committed Frontend spec says `src/TicketList.ts` reads `response.tickets` from `GET /api/tickets` and requests that Backend implement `POST /api/tickets/:id/close`. No additional request of the Frontend or Database role was agreed during this interview.

## Decisions made
- `GET /api/tickets` keeps the response shape `{ tickets: { id: string; title: string; closed: boolean }[] }`.
- `POST /api/tickets/:id/close` keeps the response shape `{ id: string; closed: boolean }`.
- When the ticket ID does not exist, `POST /api/tickets/:id/close` returns HTTP `404` with `{ error: 'not_found' }`.
- Closing an already closed ticket is idempotent: `POST /api/tickets/:id/close` returns HTTP `200` with `closed: true`.

## Still unclear
- Authentication requirements for `GET /api/tickets` and `POST /api/tickets/:id/close` are not agreed.
- Pagination for `GET /api/tickets` is not agreed.
- The request-body rule for `POST /api/tickets/:id/close` is not agreed.
- The success status for the first close of an open ticket is not agreed.
- The success status for `GET /api/tickets` is not agreed.
