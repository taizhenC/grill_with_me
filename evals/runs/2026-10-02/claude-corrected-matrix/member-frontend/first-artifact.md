# Frontend spec

## Scope
The Frontend layer of the synthetic ticket board: the client-side code that lists tickets and closes a ticket against the Backend's HTTP API (`grill/PROJECT.md`: "List tickets", "Close a ticket"; billing and offline sync are out of scope).

Observed in this repo, not chosen as a decision:
- `src/TicketList.ts` contains `loadTickets(fetcher)` which calls `fetcher("/api/tickets")`, awaits `response.json()`, and returns `body.tickets`; and `closeTicket(fetcher, id)` which calls `fetcher("/api/tickets/" + id + "/close", { method: "POST" })` and returns the `fetcher` result without reading the body. Both functions are untyped, inject `fetcher`, and contain no DOM, state, or rendering.
- `src/api.ts` holds `paths = { list: "/api/tickets", close: "/api/tickets/:id/close" }` and in-memory stubs `listTickets()` / `closeTicket(id)`.
- `src/auth.ts` has `sessionPolicy()` returning the literal `'not yet agreed'`.

Whether this layer is data-access only or also owns rendering and state was raised in the interview and left unanswered; see "Still unclear".

## What I own
- `src/TicketList.ts` — stated by me as the only file I own.

The two HTTP call sites that live in that file today (`GET /api/tickets` and `POST /api/tickets/:id/close`) are mine as call sites; the endpoints themselves are owned by Backend (below).

Not owned by me and not assigned in this interview: `src/api.ts`, `src/auth.ts`.

## What I need from other roles
From Backend (committed in `grill/backend-spec.md`, so these are agreements I can build on):
- `GET /api/tickets` returns `{ tickets: { id: string; title: string; closed: boolean }[] }`.
- `POST /api/tickets/:id/close` returns `{ id: string; closed: boolean }`.
- A missing ticket returns HTTP 404 with `{ error: "not_found" }`. My 404 close-failure message depends on this status being the signal for a ticket that no longer exists.

Open requests to Backend — not yet agreed by Backend, do not treat as approved:
- Confirm whether `POST /api/tickets/:id/close` accepts or requires a request body. `src/TicketList.ts` sends none today; `grill/backend-spec.md` does not say.
- Confirm the HTTP status returned on a successful close, and which non-404 statuses a client should expect on failure, so I can route them to the generic failure message.
- Confirm whether `GET /api/tickets` takes pagination or filtering parameters and what it does when a client sends none. `src/TicketList.ts` sends no query parameters today; `grill/backend-spec.md` does not say.
- Agree an authentication policy for both endpoints, and what the client must send.

Open requests to Database — not yet agreed by Database:
- Confirm the `tickets` table shape that backs these responses. `grill/backend-spec.md` asks Database for `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL)`; `db/schema.sql` in this repo reads `CREATE TABLE tickets (id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)`. The default is an extra detail in the repo, not a conflict with Backend's request.

## Decisions made
These are my explicit answers in this interview:
- After a close succeeds, the ticket list is reloaded. (The mechanism was not chosen — see "Still unclear".)
- When a close fails with HTTP 404, the user is shown the message `Ticket no longer exists`.
- When a close fails any other way, the user is shown the message `Could not close ticket`.
- After a failed close, the ticket stays visible; it is not removed or hidden.
- Role boundaries: I own `src/TicketList.ts` only; Backend owns the API; Database owns the table.
- Loading presentation and authentication are deliberately left unagreed for now.

## Still unclear
- Whether `src/TicketList.ts` stays a data-access module only, or also owns rendering the list and the close button. My recommendation was data-access only; it was not accepted, so this is open.
- Where the two failure messages are rendered and by which module, given the ownership question above is open.
- How a failed close is represented inside `src/TicketList.ts`: the current `closeTicket` returns the `fetcher` result unread (observed), and no new return shape, thrown-error shape, or result type was chosen.
- How the 404 case is detected in code — e.g. reading `response.status`, or parsing the committed `{ error: "not_found" }` body. Only the user-facing behavior for "HTTP 404" was decided.
- The reload mechanism after a successful close: full page reload, re-calling `loadTickets`, or something else, and what it returns. "Reload" alone does not settle this.
- Whether the successful-close response body `{ id: string; closed: boolean }` is read and used by the frontend at all, given the list is reloaded.
- Retry behavior on a failed close or a failed load: none specified.
- Loading presentation while `GET /api/tickets` or the close request is in flight — explicitly left unagreed by me.
- Authentication policy — unagreed on both sides: `grill/backend-spec.md` lists it under "Still unclear", `src/auth.ts` returns `'not yet agreed'`, and I left it unagreed.
- Error presentation for a failed *load* (as opposed to a failed close): not discussed.
- Whether `GET /api/tickets` is paginated or filtered, and whether `POST /api/tickets/:id/close` carries a request body: pending Backend's answers above. `src/TicketList.ts` omitting both is observed behavior only, not an agreement.
- Whether TypeScript types are added to `loadTickets` / `closeTicket` in `src/TicketList.ts`, and whether `grill/contract.ts` types are imported once a contract exists.
- Ownership and fate of `src/api.ts` and `src/auth.ts`, which exist in this checkout but are outside my stated owned file.
- Test ownership and placement for this layer: not discussed, so no file location is agreed.
