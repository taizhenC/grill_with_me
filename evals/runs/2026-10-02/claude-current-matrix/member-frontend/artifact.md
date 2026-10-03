## Scope
Frontend role of the synthetic ticket board: listing tickets and closing a
ticket from `src/TicketList.ts`, plus what the member sees when a close
succeeds or fails. The HTTP API and the `tickets` table are outside this
scope — the member stated they own `src/TicketList.ts` only, Backend owns the
API, and Database owns the table.

## What I own
- `src/TicketList.ts` — the only file in this role's scope.

Observed behavior of that file today (described as-is, not agreed to keep or
to replace):
- `src/TicketList.ts:1-5` — `loadTickets(fetcher)` calls
  `fetcher("/api/tickets")`, awaits `response.json()`, and returns
  `body.tickets`. There is no status check and no error branch.
- `src/TicketList.ts:6-8` — `closeTicket(fetcher, id)` calls
  `fetcher("/api/tickets/" + id + "/close", { method: "POST" })` and returns
  the raw `Response`. It does not read the body or inspect `response.status`,
  so an HTTP 404 is currently indistinguishable from a success at the call
  site.

Not owned by this role, listed only because the files sit in `src/`:
`src/api.ts` (hardcoded stub: `listTickets()` returns
`{ tickets: [{ id: "t1", title: "Demo", closed: false }] }`) and
`src/auth.ts` (returns the literal string `'not yet agreed'`).

## What I need from other roles
From Backend — already committed in `grill/backend-spec.md`, and the paths
and list shape `src/TicketList.ts` uses line up with it:
- `GET /api/tickets` → `{ tickets: { id: string; title: string; closed: boolean }[] }`
  (`grill/backend-spec.md:4`).
- `POST /api/tickets/:id/close` → `{ id: string; closed: boolean }`
  (`grill/backend-spec.md:5`).
- Missing ticket → HTTP 404 with `{ error: "not_found" }`
  (`grill/backend-spec.md:9`). This is the status the
  'Ticket no longer exists' message is keyed on.

Requests to Backend, not yet agreed by them:
- Enumerate the non-404 failure responses `POST /api/tickets/:id/close` can
  return (which HTTP statuses, and whether they carry a body). The
  'Could not close ticket' message covers "another failed close", and this
  role needs to know what that set actually is.
- Confirm whether `GET /api/tickets` has failure responses, since
  `loadTickets` reloads the list after a successful close.

Request to Database, not yet agreed by them (no `grill/database-spec.md`
exists in this checkout):
- `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL)`,
  as Backend describes the table at `grill/backend-spec.md:7`. The local
  `db/schema.sql:1` additionally shows `closed BOOLEAN NOT NULL DEFAULT FALSE`.

## Decisions made
Decided by the member in this interview:
- After a **successful** close, the ticket list is reloaded.
- On a close that fails with **HTTP 404**, the member is shown the message
  `Ticket no longer exists`.
- On **another failed close** (any other close failure), the member is shown
  the message `Could not close ticket`.
- After a failed close, the ticket **stays visible**.
- Role boundaries: this member owns `src/TicketList.ts`; Backend owns the API;
  Database owns the table.

## Still unclear
- **Reload mechanism.** "Reload after a successful close" was agreed; the
  mechanism was not. Full page reload vs. re-calling `loadTickets` /
  `GET /api/tickets`, and any resulting state or result shape, is undecided.
- **Where the failure messages appear.** An inline error on the failing
  ticket's row was recommended and not accepted; banner vs. row-local vs.
  other placement, and how long a message persists, are undecided.
- **`closeTicket` return shape.** It returns the raw `Response` today
  (`src/TicketList.ts:7`). Whether it changes to carry success/failure to the
  caller was explicitly parked and is not decided.
- **Whether a failed close triggers any reload.** Only "keep the ticket
  visible after failure" was agreed.
- **Loading presentation** (what the member sees while tickets load or while
  a close is in flight) remains unagreed.
- **Authentication** remains unagreed — both by this member and by Backend
  (`grill/backend-spec.md:11`). `src/auth.ts:1` returns `'not yet agreed'`.
- **Pending teammate agreement** on the requests above: Backend has not
  agreed to enumerate non-404 close failures or `GET /api/tickets` failures;
  Database has committed no spec in this checkout, so the `tickets` column
  types are unconfirmed by the owning role.
- **Contract freshness is unknown.** `grill/CONTRACT.md` does not exist, so
  the team is still in the grilling phase; `contract-status` could not be run
  here (see the note accompanying this spec). Unknown, not confirmed drift.
