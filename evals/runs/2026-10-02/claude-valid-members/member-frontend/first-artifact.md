# Frontend spec

## Scope
The Frontend layer of the synthetic ticket board: fetching the ticket list, closing a
single ticket, and deciding what the user sees when a close fails.

In scope:
- Listing tickets from `GET /api/tickets`.
- Closing one ticket via `POST /api/tickets/:id/close`.
- Close-failure presentation (the exact user-facing message per failure kind).
- Refresh behavior after a successful close.

Out of scope for this role: the API implementation and the `tickets` table (owned by
Backend and Database respectively), plus the product-level exclusions in
`grill/PROJECT.md` — billing and offline sync.

## What I own
`src/TicketList.ts` — and nothing else. `src/api.ts`, `src/auth.ts`, `db/schema.sql`
and the server are not mine to change.

Current state of the file (today):
- `loadTickets(fetcher)` — `GET /api/tickets`, returns `body.tickets`.
- `closeTicket(fetcher, id)` — `POST /api/tickets/:id/close`, returns the raw
  `Response` at line 7 and never inspects it.

What I own in it after this spec:
- `loadTickets(fetcher)`: calls `GET /api/tickets`, returns
  `{ id: string; title: string; closed: boolean }[]` taken from `body.tickets`.
- `closeTicket(fetcher, id)`: calls `POST /api/tickets/:id/close` and stops returning
  the unexamined `Response`. It inspects the status and resolves to a discriminated
  result:
  - success — `{ ok: true; tickets: { id: string; title: string; closed: boolean }[] }`
  - failure — `{ ok: false; message: string; ticketId: string }`
- The two failure message strings, which are frontend-owned copy:
  - HTTP 404 → `"Ticket no longer exists"`
  - any other failed close → `"Could not close ticket"`
- The post-success refresh: on success `closeTicket` re-issues `loadTickets(fetcher)`
  and returns that freshly loaded array, rather than mutating the caller's local copy
  of the closed ticket.
- The failure invariant: on any failure the ticket stays in the list, unchanged and
  visible. No optimistic removal, no optimistic flipping of `closed`, no refetch.

## What I need from other roles
From Backend (matches `grill/backend-spec.md`, "What I own" and "Decisions made" —
I am agreeing to it as written, not asking for changes):
- `GET /api/tickets` → `200` with `{ tickets: { id: string; title: string; closed: boolean }[] }`.
  I read `body.tickets` and nothing else off that response.
- `POST /api/tickets/:id/close` → `200` with `{ id: string; closed: boolean }`.
- Missing ticket on close → HTTP `404` with `{ error: "not_found" }`. I branch on the
  `404` **status code**, not on the `error` string, so the body wording is Backend's to
  change freely; the status code is the part I depend on.
- Any other close failure is signalled by a non-`2xx` status. I need no distinct body
  shape for those — they all collapse to `"Could not close ticket"`.
- `GET /api/tickets` must stay cheap enough to call again immediately after every
  successful close, since that is my refresh mechanism.

From Database (via Backend, per `grill/backend-spec.md` "What I need from other roles"
and `db/schema.sql`):
- `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL)`.
- `title` and `closed` are non-null, so I never render a placeholder for a missing
  title or treat `closed` as tri-state.

## Decisions made
1. **Refresh after a successful close is a full reload.** On `2xx` from
   `POST /api/tickets/:id/close`, `src/TicketList.ts` re-calls `GET /api/tickets` and
   replaces the list with the server's response. The `{ id, closed }` body of the close
   response is not used to patch local state; the server is the single source of truth
   for what the list looks like.
2. **404 on close shows `"Ticket no longer exists"`.** This is the one failure that gets
   its own copy, because it means someone else already removed the ticket.
3. **Every other failed close shows `"Could not close ticket"`.** This covers non-404
   non-`2xx` statuses (e.g. `500`), a rejected `fetcher` promise (network failure), and
   a response body that does not parse. One generic string, no status code shown to the
   user, no retry attempted.
4. **A failed close leaves the ticket visible and unchanged.** The row is not removed,
   not greyed out, not marked closed, and the list is not refetched. The user sees the
   same list they saw before they clicked, plus the message. This is deliberately the
   opposite of the success path in decision 1.
5. **`closeTicket` stops returning a raw `Response`.** Line 7 of `src/TicketList.ts`
   today hands the caller a `Response` nobody inspects; that makes failure presentation
   the caller's decision, and it is mine. It returns the discriminated result described
   under "What I own" instead.
6. **Role boundaries as stated by the member:** Frontend owns `src/TicketList.ts` only;
   Backend owns the API; Database owns the `tickets` table. No contradiction with
   `grill/backend-spec.md` was found, so nothing needs renegotiating.

## Still unclear
- **Authentication is not agreed.** `grill/backend-spec.md` "Still unclear" says the
  authentication policy is not agreed, and `src/auth.ts` is a stub whose
  `sessionPolicy()` returns the literal string `'not yet agreed'`. Unresolved for the
  Frontend: whether `fetcher` must attach a credential, and what the UI does on a `401`
  or `403` from either endpoint. Until that is agreed, a `401`/`403` on close falls into
  decision 3 and shows `"Could not close ticket"`, which is a placeholder, not an
  agreement.
- **Loading presentation is not agreed.** No decision on what the user sees while
  `GET /api/tickets` or the post-close reload is in flight — spinner, skeleton, disabled
  close button, or nothing.
- **Failure of the post-success reload is undecided.** Decision 1 fires a second request
  after the close succeeds. If that `GET /api/tickets` fails, it is not settled whether
  the user sees `"Could not close ticket"` (misleading — the close worked), a separate
  message, or a stale list with no message.
- **Where the message is rendered is undecided.** `src/TicketList.ts` will produce the
  message string as view state; nothing in this repo renders anything today. Whether the
  string becomes a toast, an inline row-level error, or a banner — and which file draws
  it, given Frontend owns only `src/TicketList.ts` — is not agreed.
- **Error-list failure presentation is undecided.** This spec covers close failures. What
  the user sees when the initial `GET /api/tickets` itself fails was not decided.
- **No contract file exists yet.** `grill/CONTRACT.md` and `grill/contract.ts` are absent,
  so the shapes above are two specs that happen to agree, not a ratified contract.
