## Scope
Frontend behavior for listing and closing tickets in `src/TicketList.ts`. The project demo requires listing tickets and closing a ticket; billing and offline sync are out of scope. The Backend owns the ticket API, and the Database role owns the tickets table.

## What I own
`src/TicketList.ts` only. Observed behavior: `loadTickets` calls `GET /api/tickets`, parses the JSON response, and returns `body.tickets`. Observed behavior: `closeTicket` calls `POST /api/tickets/:id/close` with `{ method: "POST" }` and currently returns the raw fetch response.

## What I need from other roles
The Backend's committed spec supplies `GET /api/tickets` returning `{ tickets: { id: string; title: string; closed: boolean }[] }` and `POST /api/tickets/:id/close` returning `{ id: string; closed: boolean }`. It also commits that a missing ticket returns HTTP 404 with `{ error: "not_found" }`. The Database role owns `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL)`, as requested by the Backend's committed spec.

## Decisions made
After a successful close, reload the tickets. When a close returns HTTP 404, show `Ticket no longer exists` inline on that ticket and keep the ticket visible. For any other failed close, show `Could not close ticket` inline on that ticket and keep the ticket visible so the user can retry.

## Still unclear
The mechanism for reloading after a successful close is not agreed: a full-page reload versus another ticket fetch remains open. The HTTP success status for either endpoint, the `POST /api/tickets/:id/close` request-body contract, and response shapes for non-404 close failures are not agreed; the omission of a request body in `src/TicketList.ts` is only observed behavior. Loading presentation and authentication remain unagreed.
