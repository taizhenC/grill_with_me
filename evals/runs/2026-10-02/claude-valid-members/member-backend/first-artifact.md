# Backend spec

## Scope
The HTTP API for the synthetic ticket board, covering both flows in
`grill/PROJECT.md:10-11` ("List tickets", "Close a ticket"):

- `GET /api/tickets` — list every ticket.
- `POST /api/tickets/:id/close` — close one ticket by id.

Both live in `src/api.ts`, whose paths are already declared at `src/api.ts:1`
as `{ list: "/api/tickets", close: "/api/tickets/:id/close" }`. Today
`listTickets()` (`src/api.ts:2`) and `closeTicket(id)` (`src/api.ts:3`) are
untyped stubs returning hardcoded data with no database access; replacing that
with typed handlers backed by the `tickets` table is my work.

Out of scope for me: the `tickets` DDL itself (Database's file), the list UI
(`src/TicketList.ts`, Frontend's file), and everything `grill/PROJECT.md:13-15`
excludes (billing, offline sync).

## What I own
- `src/api.ts` — the only file I change. Request handling, response shapes,
  status codes, and the SQL reads/writes against the `tickets` table.

I do not own `db/schema.sql`, `src/TicketList.ts`, or `src/auth.ts`.

## What I need from other roles
From Database (owner of `db/schema.sql`):
- The `tickets` table as it stands at `db/schema.sql:1` —
  `id TEXT PRIMARY KEY`, `title TEXT NOT NULL`,
  `closed BOOLEAN NOT NULL DEFAULT FALSE`. These three columns are exactly
  what I serialize; I need no new columns, and no timestamp column was added.
- `closed` must stay writable so `POST /api/tickets/:id/close` can set it to
  true; `id` must stay unique so lookup by `:id` resolves to at most one row.
- Tell me before any rename, type change, or column removal on that table: all
  three names are visible in my response bodies and in Frontend's spec.

From Frontend (owner of `src/TicketList.ts`):
- Nothing new. `grill/frontend-spec.md:4` reads `response.tickets` from
  `GET /api/tickets` and `grill/frontend-spec.md:6` calls
  `POST /api/tickets/:id/close`; both match what I am building.
- `grill/frontend-spec.md:8` ("No optimistic updates. Reload the list after a
  successful close") means a close is followed by a fresh `GET /api/tickets`,
  so my close response does not need to carry the updated list — only
  `{ id, closed }`.

## Decisions made
Response shapes (both confirmed against the stubs already in `src/api.ts`):

- `GET /api/tickets` → `200`
  `{ tickets: { id: string; title: string; closed: boolean }[] }`.
  Exactly the three columns of `db/schema.sql:1`. No `createdAt`, no
  pagination fields, no `total`. The envelope key is `tickets`, matching
  `grill/frontend-spec.md:4`.
- `POST /api/tickets/:id/close` → `200` `{ id: string; closed: boolean }`.
  No `title` in this response; Frontend re-reads the list anyway.

Missing ticket:

- `POST /api/tickets/:id/close` with an `:id` that has no row in `tickets`
  returns `404` with body `{ error: 'not_found' }`.

Close operation boundary:

- The close is idempotent. Closing a ticket whose `closed` is already true
  returns `200` with `closed: true` — not `404`, not `409`, and no error
  body. Repeat calls are indistinguishable from the first success.
- `closed` only ever moves false → true through this endpoint. There is no
  reopen endpoint; nothing in `grill/PROJECT.md:10-11` asks for one.

File ownership: `src/api.ts` is mine; `db/schema.sql` is Database's.

## Still unclear
Not agreed — do not treat any of these as settled, and do not let them leak
into `grill/CONTRACT.md`:

- **Authentication.** Unagreed. `src/auth.ts:1` still returns
  `'not yet agreed'`, and both of my endpoints are currently unauthenticated
  with no session, header, or caller-identity requirement decided. If auth
  lands later it may add a status code (e.g. `401`) to both endpoints.
- **Pagination.** Unagreed. `GET /api/tickets` returns every row with no
  `limit`, `offset`, or cursor parameter, and no `total` in the envelope. If
  the list needs paging, both the request parameters and the envelope change.
- **List ordering.** Since no timestamp column was added to `db/schema.sql:1`,
  the order of the `tickets` array is unspecified. Frontend's spec does not
  state an expected order.
- **Request body for close.** `grill/frontend-spec.md:6` names only the path.
  Whether `POST /api/tickets/:id/close` accepts or ignores a JSON body, and
  what a malformed body does, was not decided.
- **Non-404 error responses.** Only the `{ error: 'not_found' }` body for a
  missing ticket was agreed. The shape for any other failure — a database
  error on either endpoint, a malformed `:id` — is undecided, so whether
  `error` is a stable code-style string across all failures is also open.
- **Interview coverage.** You ended the grill after the first question, so the
  branches above were never put to you. The decisions section reflects only
  what you stated.
