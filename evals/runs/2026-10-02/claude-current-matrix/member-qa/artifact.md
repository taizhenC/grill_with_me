## Scope
QA layer of the synthetic ticket board: automated test coverage for listing
tickets and closing a ticket, the two flows `grill/PROJECT.md` lists under
"Must work".

Covered by this spec:
- The response shape of `GET /api/tickets`.
- The success, repeat, and missing-ticket outcomes of
  `POST /api/tickets/:id/close`.

Not covered by this spec: load testing and browser-support testing (see
"Still unclear"), billing and offline sync (out of scope per
`grill/PROJECT.md:13-15`).

## What I own
- `tests/tickets.test.ts` — the only file I own. It does not exist in this
  checkout yet; there is also no `package.json`, no test runner dependency,
  and no `tests/` directory.

Assertions I own in that file, against the shapes backend committed in
`grill/backend-spec.md:4-5` and `grill/backend-spec.md:9`:

1. **List shape** — `GET /api/tickets` returns a body with a `tickets` array,
   and each element has `id: string`, `title: string`, `closed: boolean`.
2. **Successful close** — `POST /api/tickets/:id/close` for an existing open
   ticket returns `{ id: string; closed: boolean }` with `closed: true`.
3. **Repeated close** — calling `POST /api/tickets/:id/close` again on an
   already-closed ticket returns HTTP 200.
4. **Missing ticket** — `POST /api/tickets/:id/close` for an id not in
   `tickets` returns HTTP 404 with body `{ error: "not_found" }`.

Observed behavior of the code these assertions will run against (stated as
observation, not as a decision to keep or change it):
- `src/api.ts:2` — `listTickets()` returns a hardcoded
  `{ tickets: [{ id: "t1", title: "Demo", closed: false }] }`.
- `src/api.ts:3` — `closeTicket(id)` returns `{ id, closed: true }`
  unconditionally, with no ticket lookup and no 404 path, so assertion 4 has
  nothing to exercise today.
- `src/TicketList.ts:1-5` — `loadTickets(fetcher)` returns `body.tickets`.
- `src/TicketList.ts:6-8` — `closeTicket(fetcher, id)` returns the raw
  `fetcher` result without parsing it or checking status.
- `db/schema.sql:1` — `tickets (id TEXT PRIMARY KEY, title TEXT NOT NULL,
  closed BOOLEAN NOT NULL DEFAULT FALSE)`.

## What I need from other roles

From **backend** (requests; not yet agreed by backend):
- Implement `POST /api/tickets/:id/close` so that a repeated close on an
  already-closed ticket returns **HTTP 200**. `grill/backend-spec.md:5`
  specifies the success body `{ id: string; closed: boolean }` but says
  nothing about repeat calls, so my assertion 3 needs backend to commit to
  this status explicitly.
- Confirm the status code for the successful first close, so assertion 2
  asserts the same number backend implements. `grill/backend-spec.md:5` gives
  the body but no status.
- Implement the 404 path backend already decided at
  `grill/backend-spec.md:9` (`404` with `{ error: "not_found" }`). It is
  stated in their spec but not present in `src/api.ts:3`; assertion 4 cannot
  pass until it exists.
- Tell me whether an authentication/session policy will apply to these two
  endpoints. `grill/backend-spec.md:11` leaves it unagreed and
  `src/auth.ts:1` returns the placeholder `'not yet agreed'`. If a policy
  lands, my four assertions may need auth setup.

From **frontend** (request; not yet agreed by frontend):
- Supply the user-visible failure test, including its exact failure message
  string. The member was explicit that frontend owns that message and that QA
  will not choose it. Until frontend agrees the wording, that test is not in
  `tests/tickets.test.ts`.

From **backend/whoever owns the runtime** (request; depends on the
unresolved execution-layer question below):
- If my tests run over HTTP, I need a startable server entrypoint and a test
  database fixture. Neither exists in this checkout and neither appears in
  `grill/backend-spec.md`. If my tests run as in-process unit tests, I need
  nothing new — `src/TicketList.ts:1` already accepts an injectable
  `fetcher`.

## Decisions made
- `tests/tickets.test.ts` is owned by QA.
- The four assertions listed under "What I own" are the agreed QA coverage:
  list shape (`tickets` array of `{ id, title, closed }`), successful close
  asserting `closed: true`, repeated close asserting HTTP 200, and missing
  ticket asserting HTTP 404 with `{ error: "not_found" }`.
- The user-visible failure test is frontend's to supply, and QA will not pick
  its message wording.
- Load testing and browser-support testing are not agreed, and QA is not
  deciding them unilaterally.

## Still unclear
- **What the tests execute against.** I asked whether
  `tests/tickets.test.ts` should be (a) in-process unit tests importing
  `listTickets`/`closeTicket` from `src/api.ts` and
  `loadTickets`/`closeTicket` from `src/TicketList.ts` with a fake `fetcher`,
  (b) HTTP integration tests against a running server, or (c) both. I
  recommended (a). The member did not answer before ending the interview, so
  this is unresolved. Note that assertions 3 and 4 assert HTTP status codes,
  which an in-process unit test can only observe if the functions surface
  status — so this question has to be settled before the file can be written.
- **Test runner.** No `package.json`, `node_modules`, or runner is present. I
  recommended `node --test` because it needs no install; the member did not
  accept that, so the runner is unchosen.
- **Status code for the first successful close** — pending backend
  (`grill/backend-spec.md:5` gives only the body).
- **Repeated-close idempotency** — my assertion 3 expects HTTP 200; backend
  has not agreed to that behavior in `grill/backend-spec.md`.
- **Backend's implementation of the 404 path** — decided at
  `grill/backend-spec.md:9` but absent from `src/api.ts:3`; pending backend.
- **Exact user-visible failure message** — pending frontend. The
  corresponding failure test is blocked on it. `grill/frontend-spec.md` does
  not mention a failure message; `grill/frontend-spec.md:10` leaves loading
  presentation unagreed.
- **Authentication/session policy for the tested endpoints** — pending
  backend (`grill/backend-spec.md:11`).
- **Load testing** — explicitly unagreed. No tool, no target throughput, no
  pass threshold.
- **Browser support** — explicitly unagreed. No browser matrix and no
  cross-browser test mechanism.
- **Server entrypoint and test database fixture** — pending backend, and only
  needed if the execution-layer question resolves to (b) or (c).
- **Contract freshness** — unknown. `node .eval-cli/grill.mjs
  contract-status` failed with `MODULE_NOT_FOUND` (that path does not exist
  in this checkout), and there is no `grill/CONTRACT.md`, so per
  `AGENTS.md:23-25` the team is still in the grilling phase. I could not
  confirm freshness or pending approvals.
