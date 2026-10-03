# Contract check — 2026-10-02
_Against contract revision b033c0aad022a528296ccf76fab39b978516b7bdb248fd9c7577ad2515d83c6e (recorded revision 1); freshness fresh; typed integration not applicable (no `grill/contract.ts`; recorded `typesHash` is null). 5 files in scope._

Scope derived from the contract: `src/api.ts` (both endpoints), `db/schema.sql` and `db/adapter.ts` (data model), `src/TicketList.ts` and `src/auth.ts` (owned surfaces), plus a repo-wide grep for the endpoint path literals `/api/tickets`, `/api/tickets/:id/close` and for `paths` constant usage. Local role receipt `.grill-with-me/member.json` names this checkout as **frontend**, so Frontend is reported first.

## Pending agreement
- None. `contract-status` reports `pending: []` and revision 1 carries `pendingRoles: []`, agreed by Backend, Frontend, Database. `grill/CONTRACT-STATE.json` points at the same revision ID, `grill/CONTRACT.next.md` is byte-identical to `grill/CONTRACT.md`, and `grill/CONTRACT-PROPOSAL.json` matches the recorded revision — no unfinished finalization or integrity conflict.

## ✅ Frontend
- No drift detected. `src/TicketList.ts:2` calls `GET /api/tickets` and `src/TicketList.ts:4` reads `body.tickets`, matching `[agreement:api.tickets.list]`. `src/TicketList.ts:7` POSTs to `/api/tickets/<id>/close`, matching `[agreement:api.tickets.close]`. No write to tickets table state, as required by `[agreement:ownership.tickets]`.

## ✅ Backend
- No drift detected. `src/api.ts:2` declares both contract paths; `src/api.ts:3-6` returns `{ tickets: [...] }` with rows typed `{ id: string; title: string; closed: boolean }` (`db/adapter.ts:1`); `src/api.ts:7-10` returns the `UPDATE ... RETURNING id, closed` row, matching the agreed `{ id, closed }` shape. The UPDATE text at `src/api.ts:8` matches `[agreement:data.tickets]` verbatim and runs through the injected adapter. No error behavior is invented, per `[agreement:errors.unspecified]`.

## ✅ Database
- No drift detected. `db/schema.sql:1` defines `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)` exactly as agreed. `db/adapter.ts:2-7` adapts an injected query driver with `$1`-style parameters and opens no live connection, matching `[agreement:data.tickets]`.

## ✅ Auth
- No drift detected. `src/auth.ts:1` is a placeholder (`'not yet agreed'`); the contract agrees no authentication behavior, so there is nothing to diverge from.

## ✅ QA
- No drift detected against any agreed behavior. See Unverified for the owned test file.

## Unverified
- `tests/tickets.test.ts` — QA's owned file does not exist in this checkout, so nothing could be compared. The contract states ownership only and agrees no test behavior, so this is recorded as unverified rather than drift.
- Typed integration — `grill/contract.ts` does not exist, so `contract-typecheck` does not apply. Separately, this fixture has no package manager or installed TypeScript compiler, so no compiler-backed check of `src/*.ts` / `db/adapter.ts` was performed; type agreement above is read from source text, not from diagnostics. `src/TicketList.ts:1,6` take an untyped `fetcher` parameter — unchecked by a compiler, but the contract agrees no types for it.
- Runtime behavior — the contract agrees no HTTP or driver wiring for this fixture, and nothing is executable here, so endpoint behavior at runtime (status codes, serialization) is out of scope and unverified by design.

Every finding would offer: Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore — there are no findings to apply them to. No previous `grill/CHECK-REPORT.md` existed, so no "accepted" markings were carried forward and no items are labeled NEW.
