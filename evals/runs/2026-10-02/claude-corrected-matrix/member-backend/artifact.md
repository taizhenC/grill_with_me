## Scope

The Backend layer of the synthetic ticket board: the HTTP surface behind the two
flows `grill/PROJECT.md` lists under "Must work" — list tickets and close a
ticket. Two endpoints are in scope:

- `GET /api/tickets`
- `POST /api/tickets/:id/close`

Both paths are already named in `src/api.ts:1` as
`paths = { list: "/api/tickets", close: "/api/tickets/:id/close" }`, and
`grill/frontend-spec.md` ("What I own" and "What I need from other roles") uses
the same two paths.

Out of scope per `grill/PROJECT.md`: billing and offline sync.

Observed current state of my layer, recorded as behavior rather than as a
decision to keep or replace:

- `src/api.ts:2` — `listTickets()` takes no arguments and returns a hardcoded
  `{ tickets: [{ id: "t1", title: "Demo", closed: false }] }`; it reads no
  database.
- `src/api.ts:3` — `closeTicket(id)` returns `{ id, closed: true }` without
  looking up or writing any row.
- `src/auth.ts:1` — `sessionPolicy()` returns the string `'not yet agreed'`.
- Neither function in `src/api.ts` is an HTTP handler today, so no status code
  is emitted anywhere in this file.

## What I own

- `src/api.ts` — agreed explicitly: I own this file. It currently exports
  `paths`, `listTickets()`, and `closeTicket(id)`.

Ownership agreed elsewhere:

- `db/schema.sql` — owned by the Database role (agreed explicitly in this
  grill). It holds `tickets (id TEXT PRIMARY KEY, title TEXT NOT NULL, closed
  BOOLEAN NOT NULL DEFAULT FALSE)` at `db/schema.sql:1`.
- `src/TicketList.ts` — claimed by Frontend in `grill/frontend-spec.md`
  ("src/TicketList.ts reads response.tickets from GET /api/tickets").

Owning these two endpoints settles their paths and the response bodies listed
under "Decisions made". It does not settle their HTTP status codes beyond the
repeated-close case, their request bodies, pagination, or authentication — those
are under "Still unclear".

`src/auth.ts` is not assigned to any role yet; see "Still unclear".

## What I need from other roles

From the Database role (owner of `db/schema.sql`) — requests, not yet agreed;
no `grill/database-spec.md` has been committed:

- A persisted `tickets.closed` column that a close can durably set, so that a
  subsequent `GET /api/tickets` reports `closed: true`. `db/schema.sql:1`
  already declares `closed BOOLEAN NOT NULL DEFAULT FALSE`; I am asking the
  Database role to agree to keep it, not treating the committed file as their
  agreement.
- `tickets.id` as the lookup key (`TEXT PRIMARY KEY` at `db/schema.sql:1`) and a
  way to distinguish "no such id" from an existing row, so
  `POST /api/tickets/:id/close` can return `404 { error: 'not_found' }`.
- `tickets.title TEXT NOT NULL` available for the list response's `title` field.

From the Frontend role — request, not yet agreed:

- Handling of `404 { error: 'not_found' }` from `POST /api/tickets/:id/close`.
  `grill/frontend-spec.md` requests the endpoint and decides "No optimistic
  updates. Reload the list after a successful close," but says nothing about the
  missing-ticket response.

From whichever role owns authentication — request, not yet agreed:

- A session/authentication policy for both endpoints. `src/auth.ts:1` still
  returns `'not yet agreed'`.

## Decisions made

Explicitly agreed in this grill:

- `GET /api/tickets` responds with `{ tickets: { id: string; title: string;
  closed: boolean }[] }`. This matches the field names the Frontend reads via
  `response.tickets` in `grill/frontend-spec.md`.
- `POST /api/tickets/:id/close` responds with `{ id: string; closed: boolean }`.
- When the ticket named by `:id` does not exist, `POST /api/tickets/:id/close`
  responds `HTTP 404` with body `{ error: 'not_found' }`.
- Closing a ticket that is already closed responds `HTTP 200` with
  `closed: true` — repeated closes are not an error.
- File ownership: `src/api.ts` is mine; `db/schema.sql` is the Database role's.

## Still unclear

- Where the `tickets.closed` write happens. I recommended that
  `POST /api/tickets/:id/close` perform a single
  `UPDATE tickets SET closed = TRUE WHERE id = ?` itself inside `src/api.ts`,
  with no service or repository layer; that recommendation was not accepted, so
  the close operation's internal boundary — including whether any other file
  issues that write — is unresolved. `src/api.ts:3` currently performs no write
  at all.
- Status code for a *first* successful close. Only the already-closed repeat was
  agreed at `HTTP 200`.
- Status code for `GET /api/tickets`. A 200 on success is a convention, not
  something agreed here.
- Request body, if any, for `POST /api/tickets/:id/close`. The Frontend call
  site at `src/TicketList.ts:6` sends `{ method: "POST" }` with no body, but
  that is observed code, not an agreed transport rule.
- Error responses other than the agreed 404 — for example a failed write or a
  malformed id — including whether they reuse the `{ error: string }` shape.
- Authentication: explicitly left unagreed. Ownership of `src/auth.ts` and the
  fate of `sessionPolicy()` at `src/auth.ts:1` are also unassigned.
- Pagination: explicitly left unagreed. `listTickets()` at `src/api.ts:2` takes
  no pagination arguments, which is observed behavior only, not a decision that
  the endpoint is unpaginated.
- Ordering of the `tickets` array in the `GET /api/tickets` response.
- The Database role's agreement to the requests under "What I need from other
  roles" is pending; nothing has been approved or implemented by them.
- The Frontend's agreement to handle `404 { error: 'not_found' }` is pending.
- What "Reload the list after a successful close"
  (`grill/frontend-spec.md`, "Decisions made") requires of me, if anything. The
  mechanism is not specified there, and I have not agreed to any refresh
  behavior, cache header, or response field to support it.
