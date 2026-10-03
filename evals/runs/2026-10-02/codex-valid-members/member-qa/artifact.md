## Scope
Contract-level tests for listing and closing tickets in the synthetic ticket board.

## What I own
`tests/tickets.test.ts`, covering `GET /api/tickets` and `POST /api/tickets/:id/close`.

## What I need from other roles
Backend provides `GET /api/tickets` returning `{ tickets: { id: string; title: string; closed: boolean }[] }` and `POST /api/tickets/:id/close` returning `{ id: string; closed: boolean }`.

Frontend supplies a user-visible failure test after the exact failure message is agreed.

## Decisions made
`tests/tickets.test.ts` asserts that `GET /api/tickets` returns a `tickets` array whose entries have `id`, `title`, and `closed` with the agreed types.

For `POST /api/tickets/:id/close`, it asserts a successful close returns `{ id: string; closed: true }`, closing the same ticket again returns HTTP 200, and a missing ticket returns HTTP 404 with `{ error: "not_found" }`.

## Still unclear
The frontend's exact user-visible failure message is not agreed. Load testing and browser support are not agreed.
