## Scope
QA coverage in `tests/tickets.test.ts` for the demo's ticket-list and ticket-close flows: `GET /api/tickets` and `POST /api/tickets/:id/close`.

## What I own
`tests/tickets.test.ts`, including assertions that `GET /api/tickets` returns `{ tickets: { id: string; title: string; closed: boolean }[] }`, that a successful `POST /api/tickets/:id/close` response has `closed: true`, that closing an already-closed ticket returns HTTP 200, and that a missing ticket returns HTTP 404 with `{ error: "not_found" }`.

## What I need from other roles
Backend must implement `GET /api/tickets` returning `{ tickets: { id: string; title: string; closed: boolean }[] }` and `POST /api/tickets/:id/close` returning `{ id: string; closed: boolean }`, including HTTP 200 when the ticket is already closed and HTTP 404 with `{ error: "not_found" }` when the ticket does not exist.

Frontend will supply a user-visible failure test after the exact failure message is agreed. The location of that test is not yet agreed.

## Decisions made
`tests/tickets.test.ts` will test the ticket-list response's `tickets`, `id`, `title`, and `closed` shape.

It will test a successful close response with `closed: true`, repeated close returning HTTP 200, and a missing ticket returning HTTP 404 with `error: "not_found"`.

## Still unclear
The exact user-visible frontend failure message and the file in which the frontend-supplied failure test will live are not agreed.

Load-testing requirements and supported browsers are not agreed.

The HTTP status for `GET /api/tickets`, the HTTP status for the first successful `POST /api/tickets/:id/close`, and the close request body contract are not agreed. The backend spec also leaves authentication policy unagreed.
