## Scope
Frontend behavior for listing and closing tickets in `src/TicketList.ts`. Existing code observes `GET /api/tickets`, returns the response body's `tickets` field, and sends `POST /api/tickets/:id/close` without inspecting the response, updating local state, or refreshing the list.

## What I own
`src/TicketList.ts` only.

## What I need from other roles
Backend owns and has committed `GET /api/tickets` returning `{ tickets: { id: string; title: string; closed: boolean }[] }`, and `POST /api/tickets/:id/close` returning `{ id: string; closed: boolean }` on success. Backend has also committed that a missing ticket returns HTTP 404 with `{ error: "not_found" }`.

Database owns `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL)`; the Frontend has no direct ownership of this table.

## Decisions made
After `POST /api/tickets/:id/close` succeeds, reload the displayed tickets.

When a close request returns HTTP 404, show `Ticket no longer exists` and keep the ticket visible.

For any other failed close request, show `Could not close ticket` and keep the ticket visible.

## Still unclear
The reload mechanism after a successful close is not agreed: “reload” does not specify a full-page reload or re-fetching `GET /api/tickets`.

Loading presentation is not agreed.

Authentication remains unagreed, including the Backend's authentication policy and any Frontend authentication behavior.
