## Scope
The Auth layer of the synthetic ticket board: the access policy for the demo,
expressed in `src/auth.ts`. This layer declares who may call the ticket
endpoints; it does not implement them. Production authentication, session
handling, and authorization are out of scope for this demo and remain
unresolved (see "Still unclear").

## What I own
- `src/auth.ts` — the single place the demo's access policy is expressed.
  Observed today: the file contains one line,
  `export function sessionPolicy() { return 'not yet agreed'; }`. It has no
  callers; neither `src/api.ts` nor `src/TicketList.ts` imports it.
- The access policy for the demo: `src/auth.ts` allows anonymous access to
  `GET /api/tickets` (returns `{ tickets: { id: string; title: string; closed: boolean }[] }`)
  and to `POST /api/tickets/:id/close` (returns `{ id: string; closed: boolean }`).
  No login, no token, and no session is required to call either endpoint in
  the demo.

I do not own the API implementation: `src/api.ts` (`paths`, `listTickets()`,
`closeTicket(id)`) and the HTTP handling for both endpoints belong to Backend.

## What I need from other roles
- Backend (request, not yet agreed): check the `src/auth.ts` helper for
  access decisions on `GET /api/tickets` and `POST /api/tickets/:id/close`
  rather than implementing separate access rules inside the API layer.
  Backend's spec currently parks this — `grill/backend-spec.md:11`,
  "Authentication policy is not agreed" — so this stays a request until
  Backend agrees.
- Database: no request from Auth. `db/schema.sql` defines only
  `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL)`;
  anonymous demo access needs no users or sessions table, so Auth is not
  asking for one.
- Frontend: no request from Auth. `src/TicketList.ts` calls `fetcher(...)`
  with no auth header and no credentials option today, and anonymous access
  requires no change there.

## Decisions made
- For this synthetic demo only, access is anonymous: `src/auth.ts` allows
  `GET /api/tickets` and `POST /api/tickets/:id/close` to be called without
  authentication.
- `src/auth.ts` is the single source of that policy. Backend is asked to
  consult it rather than invent separate access rules (Backend's agreement is
  still pending — see "What I need from other roles").
- Ownership boundary: I own `src/auth.ts`; I do not own the API
  implementation in `src/api.ts` or the endpoint handlers.
- Production authentication, sessions, and authorization are deliberately
  left unresolved rather than designed now.

## Still unclear
- The exported shape of the helper in `src/auth.ts`: its name (the observed
  `sessionPolicy` was never agreed as the final name), parameters, return
  type, and whether it is sync or async. Not chosen.
- How Backend consults the helper: call site, whether it runs as middleware
  or per-handler, and what Backend does with the result. Not chosen.
- Denial behavior: since demo access is anonymous, no deny path, status code,
  or error body was agreed for either endpoint. Backend's agreed
  `404 { error: "not_found" }` (`grill/backend-spec.md:9`) is a
  missing-ticket case, not an auth case.
- Backend's agreement to route access decisions through `src/auth.ts` is
  pending; `grill/backend-spec.md:11` still records authentication policy as
  not agreed.
- Production authentication, sessions, and authorization: explicitly
  unresolved. No decision on identity providers, credential storage, session
  or token format, lifetime, revocation, transport (cookie vs. header), or
  per-user authorization rules for closing tickets.
- Whether a users/actors table or any actor column on `tickets` will ever be
  needed; nothing is requested of Database now.
- Whether the demo's anonymous policy must be explicitly marked
  demo-only/non-production in code (e.g. a guard or comment in
  `src/auth.ts`). Not decided.
