## Scope
Frontend ticket-list behavior for listing and closing tickets in `src/TicketList.ts`.

## What I own
`src/TicketList.ts` only.

## What I need from other roles
Backend owns `GET /api/tickets`, returning `{ tickets: { id: string; title: string; closed: boolean }[] }`, and `POST /api/tickets/:id/close`, returning `{ id: string; closed: boolean }`. Backend has committed that a missing ticket returns HTTP 404 with `{ error: "not_found" }`.

Database owns `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL)`; the frontend does not own or access this table directly.

## Decisions made
After `POST /api/tickets/:id/close` succeeds, reload the ticket list.

When a close request returns HTTP 404, show `Ticket no longer exists`. For any other failed close request, show `Could not close ticket`. Keep the ticket visible after either failure.

## Still unclear
Whether successful-close reload means re-fetching `GET /api/tickets` or performing a full page reload is not agreed.

Loading presentation is not agreed. Authentication remains unagreed.
