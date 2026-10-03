# Frontend spec

## Scope
The Frontend layer of the synthetic ticket board: listing tickets and closing
a ticket from `src/TicketList.ts`, per `grill/PROJECT.md` ("List and close a
ticket"). Covers what happens after a close succeeds (reload) and what the
user is shown when a close fails. Billing and offline sync are out of scope
per `grill/PROJECT.md:13-15`.

Observed behavior in the repo today (not decisions, just the starting point):

- `src/TicketList.ts:1-5` — `loadTickets(fetcher)` calls
  `fetcher("/api/tickets")`, awaits `response.json()`, and returns
  `body.tickets`. It does not inspect HTTP status. Parameters are untyped.
- `src/TicketList.ts:6-8` — `closeTicket(fetcher, id)` calls
  `fetcher("/api/tickets/" + id + "/close", { method: "POST" })` and returns
  the fetcher's result unread: it neither parses the body nor inspects status.
- `src/TicketList.ts` contains no rendering and no refresh code.
- `src/api.ts:1-3` — `paths` constants plus in-memory stubs `listTickets()`
  (one ticket `t1` / "Demo" / `closed: false`) and `closeTicket(id)`
  (`{ id, closed: true }`). Not owned by this role.
- `src/auth.ts:1` — `sessionPolicy()` returns `'not yet agreed'`.

## What I own
- `src/TicketList.ts` — the only file this role owns.

Explicitly not owned by this role, per my answer: the ticket API (Backend)
and the `tickets` table (Database). `src/api.ts` and `src/auth.ts` are not in
this role's "What you own" list.

## What I need from other roles

Already committed by Backend in `grill/backend-spec.md` — I depend on these
and ask that they stay stable:

- `GET /api/tickets` → `{ tickets: { id: string; title: string; closed: boolean }[] }`
  (`grill/backend-spec.md:4`). This is the shape `loadTickets` reads
  `body.tickets` from.
- `POST /api/tickets/:id/close` → `{ id: string; closed: boolean }`
  (`grill/backend-spec.md:5`).
- Missing ticket → HTTP `404` with `{ error: "not_found" }`
  (`grill/backend-spec.md:9`). My "Ticket no longer exists" message is keyed
  on this 404.

Requests to Backend, not yet agreed by Backend:

- Define the HTTP status codes and response body for close failures that are
  **not** 404 (for example server-side failure), so the "Could not close
  ticket" branch has a specified trigger and shape.
  `grill/backend-spec.md` currently specifies only the 404 case.
- Agree an authentication policy for `GET /api/tickets` and
  `POST /api/tickets/:id/close`. Backend lists this as not agreed
  (`grill/backend-spec.md:11`); `src/auth.ts:1` returns `'not yet agreed'`.
  My answer also left authentication unagreed.

Request to Database, not yet agreed by Database (no `grill/database-spec.md`
is committed in this repo):

- A successful close must persist, so that the reload after a close shows the
  ticket as closed. The table observed at `db/schema.sql:1` is
  `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)`;
  Backend records the same table as a dependency, without the default, at
  `grill/backend-spec.md:7`.

## Decisions made
These are my explicit answers in this interview:

- **Refresh after success:** after a successful close, the ticket list
  reloads.
- **Close failure presentation — 404:** when a close fails with HTTP `404`,
  show the message `Ticket no longer exists`.
- **Close failure presentation — other failures:** when a close fails for any
  other reason, show the message `Could not close ticket`.
- **Close failure presentation — list state:** after a failed close, the
  ticket stays visible. It is not removed or hidden.
- **Failure branching key:** the two messages are distinguished by the HTTP
  status of the close response — `404` versus not `404`.
- **Ownership boundary:** this role owns `src/TicketList.ts` only; the API
  belongs to Backend and the `tickets` table belongs to Database.
- **Loading presentation:** left unagreed (see "Still unclear").
- **Authentication:** left unagreed (see "Still unclear").

## Still unclear

Not decided in this interview — I am not choosing these:

- **Reload mechanism.** "Reload" was agreed; whether that is a full page
  reload, a re-call of `loadTickets`, or something else was not specified,
  and neither was the result shape it produces.
- **How the two failure messages reach the user.** `src/TicketList.ts` has no
  rendering today. Where the strings render, how long they persist, and
  whether they are dismissed on the next action were not specified.
- **How `closeTicket` surfaces the 404-vs-other distinction.** Its return
  shape, and whether it throws, returns a result object, or returns the raw
  response, were not decided. It currently returns the fetcher's result
  unread (`src/TicketList.ts:6-8`).
- **Which conditions count as "another failed close."** Whether non-2xx
  statuses, network/transport errors, or unparseable bodies are all mapped to
  "Could not close ticket" was not specified, and Backend has not defined
  non-404 failure responses.
- **Data source for `src/TicketList.ts`.** I asked whether the module keeps
  the injected `fetcher` against Backend's real endpoints or reads the
  `src/api.ts` stubs (`src/api.ts:1-3`); that question was not answered
  before the interview ended. Whether the `fetcher` injection parameter stays
  is therefore open.
- **Status handling in `loadTickets`.** It does not check HTTP status today
  (`src/TicketList.ts:1-5`); no change was decided.
- **Loading presentation** while the list or a close is in flight — my answer
  states this remains unagreed.
- **Authentication** for the Frontend's calls — my answer states this remains
  unagreed, and Backend also lists it as unagreed
  (`grill/backend-spec.md:11`).
- **Pending agreement from other roles** on every request in "What I need
  from other roles" that is marked not yet agreed: Backend's non-404 close
  failure contract, Backend's authentication policy, and Database's
  persistence of a close. No teammate has approved or implemented these.
- **Contract freshness.** `grill/CONTRACT.md` does not exist, so no finalized
  agreement is in force. `contract-status` could not be run in this checkout
  (the CLI is not present), so contract freshness is unknown, not fresh.
