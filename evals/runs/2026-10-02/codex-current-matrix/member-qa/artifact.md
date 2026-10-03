## Scope
QA coverage for the synthetic ticket board API in `tests/tickets.test.ts`.

## What I own
`tests/tickets.test.ts`, including assertions for listing tickets, successfully closing a ticket, repeatedly closing an already-closed ticket, and attempting to close a missing ticket.

## What I need from other roles
The backend provides `GET /api/tickets` returning `{ tickets: { id: string; title: string; closed: boolean }[] }` and `POST /api/tickets/:id/close` returning `{ id: string; closed: boolean }`.

The frontend supplies a user-visible failure test after the exact failure message is agreed.

## Decisions made
`tests/tickets.test.ts` asserts that `GET /api/tickets` returns an object with a `tickets` collection whose entries have `id: string`, `title: string`, and `closed: boolean`.

`tests/tickets.test.ts` asserts that a successful `POST /api/tickets/:id/close` returns a response with `closed: true`.

`tests/tickets.test.ts` asserts that repeating `POST /api/tickets/:id/close` for the same ticket returns HTTP 200 with `closed: true`.

`tests/tickets.test.ts` asserts that `POST /api/tickets/:id/close` for a missing ticket returns HTTP 404 with `{ error: "not_found" }`.

The exact user-visible frontend failure message is not chosen by QA, and its test is not owned by `tests/tickets.test.ts`.

## Still unclear
The exact user-visible frontend failure message remains unagreed.

Load-testing requirements remain unagreed.

Browser-support requirements remain unagreed.
