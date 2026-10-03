## Scope
Frontend behavior for listing tickets and closing a ticket in the synthetic ticket board demo.

## What I own
`src/TicketList.ts`.

## What I need from other roles
Backend owns `GET /api/tickets`, returning `{ tickets: { id: string; title: string; closed: boolean }[] }`.
Backend owns `POST /api/tickets/:id/close`, returning `{ id: string; closed: boolean }`; when the ticket is missing, it returns HTTP 404 with `{ error: "not_found" }`.
Database owns `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL)`.

## Decisions made
After `POST /api/tickets/:id/close` succeeds, reload the ticket list.
If closing returns HTTP 404, show `Ticket no longer exists` and keep the ticket visible.
For any other failed close, show `Could not close ticket` and keep the ticket visible.

## Still unclear
Loading presentation is not agreed.
Authentication policy is not agreed.
