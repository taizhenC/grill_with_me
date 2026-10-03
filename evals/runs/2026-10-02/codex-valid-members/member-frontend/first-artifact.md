## Scope
Render the ticket list and allow a user to close a ticket in `src/TicketList.ts`.

## What I own
Frontend owns only `src/TicketList.ts`.

## What I need from other roles
Backend owns `GET /api/tickets`, returning `{ tickets: { id: string; title: string; closed: boolean }[] }`, and `POST /api/tickets/:id/close`, returning `{ id: string; closed: boolean }`. A missing ticket must return HTTP 404 with `{ error: "not_found" }`.

Database owns `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL)`.

## Decisions made
After `POST /api/tickets/:id/close` succeeds, reload the page.

If the close request returns HTTP 404, keep the ticket visible and show `Ticket no longer exists`.

If the close request fails for any other reason, keep the ticket visible and show `Could not close ticket`.

## Still unclear
Loading presentation is not agreed.

Authentication is not agreed.
