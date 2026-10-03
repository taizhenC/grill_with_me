# Contract check — 2026-10-02
_Against contract revision b033c0aad022a528296ccf76fab39b978516b7bdb248fd9c7577ad2515d83c6e (number 1); freshness fresh; typed integration not applicable — no `grill/contract.ts` (recorded `typesHash: null`). 5 files in scope._

Local receipt `.grill-with-me/member.json` names this checkout's role as **Frontend**, so Frontend findings are listed first.

Scope derived from the contract: `src/api.ts` (both endpoints), `db/schema.sql` and `db/adapter.ts` (data model), `src/TicketList.ts` (call sites of `/api/tickets` and `/api/tickets/:id/close`), `src/auth.ts` (ownership). Endpoint path literals and the `paths` constant in `src/api.ts:2` were grepped repo-wide; the only call sites are `src/TicketList.ts:2` and `src/TicketList.ts:7`.

## Pending agreement
- None. Revision 1 is `agreed` by Backend, Frontend, Database with `pendingRoles: []`; `grill/CONTRACT-STATE.json` points at the same revision ID as `grill/CONTRACT-HISTORY.jsonl`, and `grill/CONTRACT-CHANGES.md` records the same revision — no integrity conflict and no unfinished finalization. `grill/CONTRACT.next.md` is present but byte-identical to `grill/CONTRACT.md`, so it is a leftover staging copy, not competing prose.

## ✅ Frontend
- No drift detected. `src/TicketList.ts:2` calls the agreed `/api/tickets` path and reads `body.tickets` (`src/TicketList.ts:4`), matching `[agreement:api.tickets.list]`. `src/TicketList.ts:7` POSTs `/api/tickets/<id>/close`, matching `[agreement:api.tickets.close]`. No write to tickets table state, as `[agreement:ownership.tickets]` requires.

## ✅ Backend
- No drift detected. `src/api.ts:3-6` returns `{ tickets: result.rows }` where rows are `TicketRow { id; title; closed }` (`db/adapter.ts:1`) selected as `id, title, closed` (`src/api.ts:4`) — matches the agreed list response shape. `src/api.ts:8` runs exactly the agreed `UPDATE tickets SET closed = TRUE WHERE id = $1 RETURNING id, closed` through the injected adapter and returns the `{ id, closed }` row (`src/api.ts:9`). `src/api.ts:2` declares both agreed path literals.

## ✅ Database
- No drift detected. `db/schema.sql:1` defines `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)`, matching `[agreement:data.tickets]` column-for-column. `db/adapter.ts:5-7` adapts an injected query driver rather than opening a connection, as agreed.

## ✅ Auth
- No drift detected. `src/auth.ts:1` returns `'not yet agreed'`; the contract assigns Auth ownership of that file and agrees no session behavior, so there is nothing to diverge from.

## Unverified
- **QA — `tests/tickets.test.ts` does not exist.** `[agreement:ownership.tickets]` assigns the path to QA but no test content, assertion, or endpoint behavior is agreed for it, so its absence is not evidenced drift against any contract line. Nothing to compare.
- **Typed integration.** `grill/contract.ts` does not exist, so `contract-typecheck` does not apply and no typed check was attempted. Separately, this fixture has no package manager or installed compiler, so a typecheck could not have been run even if a contract types file existed — reported as unverified rather than installing one. `src/TicketList.ts` is untyped JS-style TypeScript (`fetcher` and `id` have implicit `any` at lines 1 and 6); whether that would raise diagnostics under a real project config is unverified.
- **Runtime/HTTP behavior.** The contract header states driver and HTTP wiring are not agreed, and no HTTP route registration or driver instantiation exists in the repo. Static shapes were compared; runtime behavior of either endpoint was not executed or verified.
- **Error behavior.** `[agreement:errors.unspecified]` agrees no error behavior. `src/api.ts:9` would yield `undefined` for a missing ticket and `src/TicketList.ts:7` returns the raw fetch result, but since nothing is agreed here, neither is reportable drift.

No previous `grill/CHECK-REPORT.md` existed, so there are no carried-forward "accepted" markings.
