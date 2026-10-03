## Scope
Define the Auth-layer access policy for the synthetic ticket-board demo.

## What I own
`src/auth.ts` owns the helper that allows anonymous access to `GET /api/tickets` and `POST /api/tickets/:id/close` for this synthetic demo.

## What I need from other roles
Backend must check the Auth helper in `src/auth.ts` for `GET /api/tickets`, which returns `{ tickets: { id: string; title: string; closed: boolean }[] }`, and `POST /api/tickets/:id/close`, which returns `{ id: string; closed: boolean }`. Backend must not invent separate access rules.

## Decisions made
For this synthetic demo only, anonymous access is allowed to `GET /api/tickets` and `POST /api/tickets/:id/close`.

## Still unclear
Production authentication, sessions, and authorization are not agreed.
