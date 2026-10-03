## Scope
Backend HTTP layer for the synthetic ticket board described in `grill/PROJECT.md`
("Must work: List tickets; Close a ticket"). Two endpoints, both in `src/api.ts`:
`GET /api/tickets` and `POST /api/tickets/:id/close`. Billing and offline sync are
out of scope per `grill/PROJECT.md:13-15`. Authentication and pagination are not
part of any agreement yet — see "Still unclear".

## What I own
- `src/api.ts` (confirmed mine).
  - `GET /api/tickets` → `200` with `{ tickets: { id: string; title: string; closed: boolean }[] }`.
  - `POST /api/tickets/:id/close` → request has no body; `:id` is a string path
    segment. Success body is `{ id: string; closed: boolean }`.
  - Observed behavior today (not a decision to keep or replace):
    `src/api.ts:1` exports `paths = { list: "/api/tickets", close: "/api/tickets/:id/close" }`;
    `src/api.ts:2` `listTickets()` returns one hardcoded row
    `{ id: "t1", title: "Demo", closed: false }` and reads no database;
    `src/api.ts:3` `closeTicket(id)` returns `{ id, closed: true }` for any `id`,
    with no existence check and no database write.

Not mine: `db/schema.sql` is owned by the Database role. Ownership of `src/auth.ts`
was not assigned to me or to anyone else.

## What I need from other roles
- **Database** (owns `db/schema.sql`) — request, not yet agreed: a `tickets` table
  that can back both endpoints, with `id TEXT PRIMARY KEY`, `title TEXT NOT NULL`,
  `closed BOOLEAN NOT NULL DEFAULT FALSE`. That is what `db/schema.sql:1` contains
  today; I am asking Database to keep those columns and types so `GET /api/tickets`
  can project `id`/`title`/`closed` and the close endpoint can look a row up by `id`.
- **Database** — request, not yet agreed: a lookup result that distinguishes "no row
  with this `id`" from "row exists", since the 404 decision below depends on telling
  those two apart.
- **Frontend** (`grill/frontend-spec.md`) — no backend request is pending on them.
  For the record, their committed spec is consistent with the shapes above:
  line 4 reads `response.tickets` from `GET /api/tickets`, and line 6 asks Backend to
  implement `POST /api/tickets/:id/close`. Their line 8 ("No optimistic updates.
  Reload the list after a successful close.") is Frontend behavior; the only backend
  contribution is the `404` vs `200` distinction decided below. I am not claiming
  Frontend has approved or implemented anything beyond what their spec states.
- **Authentication owner** — request, not yet agreed: if either endpoint must require
  an authenticated session, that has to be agreed before `src/api.ts` can enforce it.
  `src/auth.ts:1` currently has `sessionPolicy()` returning the string
  `'not yet agreed'`.

## Decisions made
- `GET /api/tickets` response shape stays `{ tickets: { id: string; title: string; closed: boolean }[] }`.
- `POST /api/tickets/:id/close` success response shape stays `{ id: string; closed: boolean }`.
- **Missing ticket response:** `POST /api/tickets/:id/close` with an `:id` that has no
  row in `tickets` returns HTTP `404` with body `{ error: 'not_found' }`.
- **Close operation boundary (repeat close):** `POST /api/tickets/:id/close` on a
  ticket that is already closed returns HTTP `200` with `closed: true`. A repeated
  close is not an error and uses the same success shape as any other close.

## Still unclear
- HTTP status code for the **first** successful close of an open ticket. Only the
  repeat-close case was given (`200`); the initial-close status was never stated.
- Whether the `404` path attempts any database write before responding. I recommended
  "no write attempted", and that detail was not explicitly accepted.
- Whether a `200` close response can ever carry `closed: false`, or whether `closed`
  is always `true` on success.
- Whether `'not_found'` belongs to a fixed set of error codes, and what status/body
  other failures return (malformed `:id`, database unavailable, etc.).
- Whether `listTickets()` and `closeTicket()` will read from and write to the
  `tickets` table at all, replacing today's hardcoded row and no-op close. No change
  to the existing implementation was decided.
- Authentication: unagreed — owner, session mechanism, and whether either endpoint
  requires a session. `src/auth.ts:1` placeholder stands.
- Pagination: unagreed. `GET /api/tickets` takes no page/limit/cursor parameters and
  returns all rows.
- Database's agreement to the `tickets` columns and types requested above is pending;
  no `grill/database-spec.md` is committed in this checkout.
- Ownership of `src/auth.ts` is unassigned.
- Frontend's reload mechanism after a successful close is theirs to specify and is not
  pinned down ("reload" alone does not agree a full page reload or a particular fetch);
  their loading presentation is explicitly unagreed at `grill/frontend-spec.md:10`.
- Contract freshness and pending approvals are unverified: `contract-status` could not
  be run in this checkout (see my report), and no `grill/CONTRACT.md` exists yet.
