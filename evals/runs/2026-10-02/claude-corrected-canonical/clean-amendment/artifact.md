# Contract check — 2026-10-02
_Against contract revision 2322416109177933a597802db958bb32ea7571579d3946297f1debe4734fd8a6 (number 2, kind amend); freshness fresh; typed integration n/a — no `grill/contract.ts` in the repo and the revision records `typesHash: null` / proposal `types: "none"`, so no typecheck is owed. 5 files in scope._

Scope derived from the contract: `src/api.ts` (Endpoints), `db/schema.sql` + `db/adapter.ts` (Data model), `src/TicketList.ts` and `src/auth.ts` (call sites / owned files). Grep for the endpoint path literals `/api/tickets`, `/api/tickets/:id/close` and the `paths` constant found call sites only in `src/api.ts` and `src/TicketList.ts`.

Finalization integrity: `grill/CONTRACT-STATE.json` records the same revision the CLI reports, and `grill/CONTRACT.next.md` is byte-identical to `grill/CONTRACT.md` — a leftover finalization artifact, not an unapplied pending version. `grill/CONTRACT-HISTORY.jsonl` and `grill/CONTRACT-CHANGES.md` agree with the current prose: revision 2 changed `api.tickets.list` only, agreed by Backend and Frontend. No prose/history contradiction to reconcile.

## Pending agreement
- None. `contract-status` reports `pendingRoles: []` and `pending: []` for revision 2322416…, approval `agreed` (Backend, Frontend).

## ✅ Frontend (this checkout's role, per `.grill-with-me/member.json`)
- No drift detected. `src/TicketList.ts:4` reads `body.items` from `GET /api/tickets`, matching the current contract (`grill/CONTRACT.md:10`). `src/TicketList.ts:7` calls `POST /api/tickets/:id/close` — the agreed Backend endpoint — and writes no tickets table state, satisfying `grill/CONTRACT.md:4`.

## ✅ Backend
- No drift detected. `src/api.ts:5` returns `{ items: result.rows }` with `id, title, closed` selected at `src/api.ts:4`, matching `grill/CONTRACT.md:10`. `src/api.ts:8` issues `UPDATE tickets SET closed = TRUE WHERE id = $1 RETURNING id, closed` through the injected adapter and returns `{ id, closed }`, matching `grill/CONTRACT.md:12` and `grill/CONTRACT.md:16`. Paths at `src/api.ts:2` match the contract literals exactly.
- Not drift, noted for awareness: the adapter's `query` is declared to resolve `TicketRow[]` (`db/adapter.ts:3`), so `closeTicket`'s declared static type carries `title` even though the `RETURNING` clause yields only `id, closed`. The runtime shape conforms to the contract, and no types are agreed for this fixture, so there is nothing to fix against the contract.

## ✅ Database
- No drift detected. `db/schema.sql:1` defines `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)`, exactly as `grill/CONTRACT.md:15` specifies. `db/adapter.ts:5-7` adapts an injected driver with no live connection, as `grill/CONTRACT.md:16` requires.

## ✅ Auth
- No drift detected. `src/auth.ts:1` returns `'not yet agreed'` and asserts no behavior; no auth agreement exists in the contract to drift from.

## ✅ QA
- No drift detected. `tests/tickets.test.ts` (owned by QA per `grill/CONTRACT.md:7`) is not present in the repo. The contract assigns ownership of that path but agrees no test content or coverage obligation, so its absence is not contract drift.

## Unverified
- Runtime/HTTP behavior of either endpoint. `grill/CONTRACT.md:1` and `:16` state that driver and HTTP wiring are explicitly not agreed in this fixture; there is no server, router, or live connection to exercise, so the check is static only.
- No compiler or declared typecheck command exists in this fixture. This does not downgrade the typed-integration result, because no `grill/contract.ts` exists to check; nothing was installed or downloaded to get around it.

## Notes on inputs that are not the current truth
- `grill/backend-spec.md:4` and `grill/frontend-spec.md:4` still describe the pre-amendment `{ tickets: … }` wrapper. These are the source specs that fed the revisions, and their hashes match what revision 2 recorded (freshness fresh). Revision 2 superseded that wording, and `grill/CONTRACT.md:10` is the current truth. The code agreeing with the contract rather than the stale spec prose is correct — this is deliberately **not** reported as drift.
