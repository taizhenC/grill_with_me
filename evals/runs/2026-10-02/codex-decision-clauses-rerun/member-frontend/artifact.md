## Scope
Frontend behavior for listing and closing tickets in `src/TicketList.ts`. Observed behavior: `loadTickets` calls `GET /api/tickets`, parses JSON, and returns `body.tickets`; `closeTicket` calls `POST /api/tickets/:id/close` and returns the raw response.

## What I own
`src/TicketList.ts` only.

## What I need from other roles
Backend owns the API and has committed that `GET /api/tickets` returns `{ tickets: { id: string; title: string; closed: boolean }[] }`, `POST /api/tickets/:id/close` returns `{ id: string; closed: boolean }`, and a missing ticket returns HTTP 404 with `{ error: "not_found" }`.

Database owns the `tickets` table. The Backend spec identifies the required table shape as `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL)`.

## Decisions made
After a successful close, reload the tickets.

When a close returns HTTP 404, show `Ticket no longer exists` and keep the ticket visible.

For another failed close, show `Could not close ticket` and keep the ticket visible.

## Still unclear
The reload mechanism after a successful close is not agreed; “reload” does not decide between a full-page reload and fetching the ticket list again.

The placement and presentation mechanism for close-failure messages is not agreed.

Loading presentation is not agreed.

Authentication policy is not agreed.
