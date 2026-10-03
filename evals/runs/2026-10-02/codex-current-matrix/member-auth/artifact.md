## Scope
Authentication policy for the synthetic ticket-board demo. This role determines access for `GET /api/tickets` and `POST /api/tickets/:id/close`; production authentication, sessions, and authorization are outside the agreed demo policy and remain unresolved.

## What I own
`src/auth.ts`. Observed behavior: it currently exports `sessionPolicy()`, which returns `"not yet agreed"`.

## What I need from other roles
Backend must check the helper owned by `src/auth.ts` when handling `GET /api/tickets` and `POST /api/tickets/:id/close`, rather than defining separate access rules. This is a request to the Backend role and is pending that role's agreement.

## Decisions made
For this synthetic demo only, `src/auth.ts` allows anonymous access to `GET /api/tickets` and `POST /api/tickets/:id/close`.

## Still unclear
The `src/auth.ts` helper's TypeScript signature and return shape are not agreed. Production authentication, session handling, and authorization policy are not agreed and must remain explicitly unresolved. Backend agreement to check the `src/auth.ts` helper for both demo endpoints is pending.
