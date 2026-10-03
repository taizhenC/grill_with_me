# Frontend spec

## Scope
The Frontend layer of the synthetic ticket board: listing tickets and closing
a ticket from `src/TicketList.ts`, plus the close-failure messages and the
post-close refresh. Backend owns the HTTP API; Database owns the `tickets`
table. Billing and offline sync are out of scope per `grill/PROJECT.md:13-15`.

## What I own
- `src/TicketList.ts` — the only file I own.
  - `loadTickets(fetcher)` — calls `GET /api/tickets` and returns
    `{ id: string; title: string; closed: boolean }[]` taken from `body.tickets`.
  - `closeTicket(fetcher, id)` — calls `POST /api/tickets/:id/close` and
    reports success or one of the two failure messages below.
- The two user-facing close-failure strings, verbatim:
  - `Ticket no longer exists`
  - `Could not close ticket`
- The decision to re-fetch the list after a successful close.

I do not own `src/api.ts`, `src/auth.ts`, `db/schema.sql`, or any endpoint
implementation.

## What I need from other roles
From Backend (matches `grill/backend-spec.md:4-5,9`):
- `GET /api/tickets` → `200` with
  `{ tickets: { id: string; title: string; closed: boolean }[] }`.
- `POST /api/tickets/:id/close` (no request body) → `200` with
  `{ id: string; closed: boolean }`.
- Missing ticket → `404` with `{ error: "not_found" }`. I branch on the `404`
  status code, so that status must not be reused for other failures.
- `GET /api/tickets` must already reflect a completed close when it is called
  immediately after a `200` from the close endpoint, because that refetch is
  how the closed state reaches the UI.

From Database (matches `grill/backend-spec.md:7` and `db/schema.sql:1`):
- `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL
  DEFAULT FALSE)` — I rely on `id`, `title`, and `closed` being present and
  non-null for every ticket returned by the list endpoint.

## Decisions made
- Refresh behavior: after a successful close, reload the whole list by calling
  `GET /api/tickets` again. No optimistic local mutation of the closed ticket.
- Close failure presentation:
  - HTTP `404` from `POST /api/tickets/:id/close` → show `Ticket no longer exists`.
  - Any other failed close → show `Could not close ticket`.
- After a failed close the ticket stays visible in the list — it is not removed,
  and no refetch is triggered by the failure.
- Role boundaries: I own `src/TicketList.ts` only; Backend owns the API and
  Database owns the `tickets` table.

## Still unclear
- Whether `src/TicketList.ts` stays headless (today it is: `src/TicketList.ts:1-8`
  takes an injected `fetcher` and returns data) or also owns rendering/DOM. Not
  agreed, so the mechanism that displays the two failure strings — and where
  they are mounted — is undecided.
- Loading presentation (what the user sees while `GET /api/tickets` or the close
  request is in flight) is not agreed.
- Authentication is not agreed — `grill/backend-spec.md:11` leaves the policy
  open and `src/auth.ts:1` returns `'not yet agreed'`. Unresolved: whether
  requests carry credentials and what the UI does on a `401`/`403` close
  failure (today it would fall into `Could not close ticket`).
- Whether a `200` close response whose body says `closed: false` counts as a
  success for refresh purposes, or as a failure. I currently treat any non-`200`
  or thrown request as failure and do not inspect the close response body.
- Empty-list and list-load-failure presentation were not discussed; only close
  failures were agreed.
