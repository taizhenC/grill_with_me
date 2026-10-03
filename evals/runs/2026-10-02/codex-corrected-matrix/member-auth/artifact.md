## Scope
Authentication policy for the synthetic ticket-board demo, limited to access decisions implemented in `src/auth.ts` for `GET /api/tickets` and `POST /api/tickets/:id/close`.

## What I own
`src/auth.ts` owns the helper that allows anonymous access to `GET /api/tickets` and `POST /api/tickets/:id/close` for this synthetic demo. Observed current behavior: `src/auth.ts` exports `sessionPolicy()` and returns the string `"not yet agreed"`.

## What I need from other roles
Backend must check the helper owned by `src/auth.ts` when handling `GET /api/tickets` and `POST /api/tickets/:id/close`, rather than implementing separate access rules.

## Decisions made
For this synthetic demo only, anonymous access is allowed to `GET /api/tickets` and `POST /api/tickets/:id/close`.

## Still unclear
The exact TypeScript interface and return shape of the helper in `src/auth.ts` are not agreed. Production authentication, sessions, and authorization are not agreed and remain explicitly unresolved. Backend agreement to use the `src/auth.ts` helper is pending.
