# Backend spec

## Scope
The Backend layer of the synthetic ticket board (`grill/PROJECT.md`): the HTTP
surface that lets the demo list tickets and close one ticket.

In scope for this role: `GET /api/tickets` and `POST /api/tickets/:id/close`,
their request/response shapes, and the missing-ticket and repeated-close
outcomes for the close endpoint.

Out of scope per `grill/PROJECT.md`: billing, offline sync. Not owned by this
role: the `tickets` table definition in `db/schema.sql` (Database), and the
ticket list UI in `src/TicketList.ts` (Frontend, `grill/frontend-spec.md:4`).

## What I own
`src/api.ts` — the only file in this role's scope.

Observed behavior in `src/api.ts` today (described as-is, not as a decision to
keep or replace it):

- `src/api.ts:1` exports `paths = { list: "/api/tickets", close: "/api/tickets/:id/close" }`.
- `src/api.ts:2` — `listTickets()` returns a hardcoded
  `{ tickets: [{ id: "t1", title: "Demo", closed: false }] }`. It reads nothing
  from the database.
- `src/api.ts:3` — `closeTicket(id)` returns `{ id, closed: true }` for any
  `id`. It performs no existence check and no database write.
- `src/auth.ts:1` — `sessionPolicy()` returns the string `'not yet agreed'`.
  This file is outside this role's declared scope (see "Still unclear").

## What I need from other roles
These are requests. No other role has agreed to them yet.

Database (stated owner of `db/schema.sql`; no `grill/database-spec.md` has been
committed, so nothing here is their commitment):

- Keep a `tickets` table that the backend can read and update. Observed at
  `db/schema.sql:1`: `tickets (id TEXT PRIMARY KEY, title TEXT NOT NULL,
  closed BOOLEAN NOT NULL DEFAULT FALSE)`.
- Backend needs to read `id TEXT`, `title TEXT`, `closed BOOLEAN` for the list
  endpoint, and to look up a row by `id` plus set `closed` for the close
  endpoint. The 404 and repeated-close outcomes below both depend on the row's
  identity and state being readable.

Frontend (`grill/frontend-spec.md`):

- `grill/frontend-spec.md:6` already asks Backend to implement
  `POST /api/tickets/:id/close`; this spec provides it.
- Request: accept the missing-ticket response `HTTP 404` with body
  `{ error: 'not_found' }` as the failure signal for that endpoint. Frontend's
  committed spec does not mention this shape, so it is not yet agreed by them.
- No conflict found with `grill/frontend-spec.md:4` (`response.tickets` from
  `GET /api/tickets`) or `:8` (no optimistic updates; reload after a successful
  close). Frontend does not enumerate the fields of a ticket item; that is an
  omission, not a contradiction of the item shape below.

## Decisions made
Explicitly decided by the role owner in this interview:

- `GET /api/tickets` keeps its response shape:
  `{ tickets: { id: string; title: string; closed: boolean }[] }`.
- `POST /api/tickets/:id/close` keeps its response shape:
  `{ id: string; closed: boolean }`.
- Close with an `id` that has no `tickets` row responds `HTTP 404` with body
  `{ error: 'not_found' }`.
- Closing an already-closed ticket again responds `HTTP 200` with
  `closed: true` (repeated close is not an error).
- Ownership boundary: this role owns `src/api.ts`; the Database role owns
  `db/schema.sql`.
- Authentication and pagination are left unagreed for now (recorded below).

## Still unclear
- Success status code for the first close of an open ticket. Only the
  *repeated* close was pinned to `HTTP 200`; the open-to-closed transition's
  status code was not stated.
- How Frontend treats non-2xx responses from the close endpoint. Its reload
  rule (`grill/frontend-spec.md:8`) triggers on "a successful close", but
  mapping 404 — or any other non-2xx — onto that rule was recommended, not
  accepted. The mechanism of "reload" is also not pinned down by either role.
- Persistence for `src/api.ts`. The agreed 404 and repeated-close outcomes
  require reading and updating the `tickets` row, but no data-access mechanism
  (client, query layer, migration step) was discussed, and none exists in the
  repo today.
- Whether `listTickets()` keeps returning its hardcoded stub
  (`src/api.ts:2`) or reads the table, and if it reads: whether closed tickets
  are included or filtered, and in what order.
- Request shape and body (if any) for `POST /api/tickets/:id/close` beyond the
  `:id` path parameter.
- Error shapes for any case other than missing-ticket (for example malformed
  `id`, or a database failure).
- Authentication: explicitly unagreed. `src/auth.ts:1` still returns
  `'not yet agreed'`, and `src/auth.ts` is not listed in this role's owned
  files — its ownership is also unresolved.
- Pagination for `GET /api/tickets`: explicitly unagreed.
- Database's agreement to the `tickets` read/update requests above is pending;
  no Database spec exists in `grill/`.
- Frontend's agreement to the `404 { error: 'not_found' }` body is pending.
- Contract freshness is unknown. `grill/CONTRACT.md` does not exist (grilling
  phase), and `contract-status` could not be run in this checkout — there is no
  `.eval-cli/` directory, so `node .eval-cli/grill.mjs contract-status` fails
  with `MODULE_NOT_FOUND`.
