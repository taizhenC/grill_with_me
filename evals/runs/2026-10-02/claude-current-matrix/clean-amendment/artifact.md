# Contract check — 2026-10-02
_Against contract revision 2322416109177933a597802db958bb32ea7571579d3946297f1debe4734fd8a6 (number 2, kind amend, "Backend and Frontend agree items wrapper replaces tickets"); freshness fresh; typed integration not applicable — no `grill/contract.ts` exists and the revision records `typesHash: null`. 4 files in scope._

Local receipt `.grill-with-me/member.json` names this checkout's role as **Frontend**, so Frontend is reported first.

Finalization is complete and consistent: `grill/CONTRACT-STATE.json` points at revision 2, `grill/CONTRACT-HISTORY.jsonl` ends at revision 2, and the leftover `grill/CONTRACT.next.md` is byte-identical to `grill/CONTRACT.md`. No integrity conflict and no unfinished amendment. No previous `grill/CHECK-REPORT.md` existed, so there are no carried-forward "accepted" markings; any finding below would be **NEW**.

Files in scope (derived from the contract): `src/api.ts` (Endpoints), `db/schema.sql` and `db/adapter.ts` (Data model), `src/TicketList.ts` (call site of both endpoint path literals). A grep for `/api/tickets` and for `paths` usage found no other call sites outside `grill/` and the local CLI.

## Pending agreement
- None. Revision 2 is `approval: agreed`, `agreedBy: [Backend, Frontend]`, `pendingRoles: []`, and `contract-status` reports `pending: []`.

## ✅ Frontend
- No drift detected. `src/TicketList.ts:4` reads `body.items` from `GET /api/tickets`, matching the current `[agreement:api.tickets.list]` shape `{ items: { id, title, closed }[] }`. `src/TicketList.ts:7` calls `POST /api/tickets/<id>/close`, matching `[agreement:api.tickets.close]`. No writes to `tickets` table state.

## ✅ Backend
- No drift detected. `src/api.ts:5` returns `{ items: result.rows }` and `src/api.ts:4` selects `id, title, closed` — matching the current list response shape. `src/api.ts:9` returns the row from `UPDATE tickets SET closed = TRUE WHERE id = $1 RETURNING id, closed` (`src/api.ts:8`), matching both `[agreement:api.tickets.close]` and the UPDATE statement spelled out in `[agreement:data.tickets]`. Reads and writes go through the injected `TicketDatabase` adapter (`src/api.ts:1`), as agreed.

## ✅ Database
- No drift detected. `db/schema.sql:1` defines `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)`, exactly the `[agreement:data.tickets]` columns and default. `db/adapter.ts:5` adapts an injected driver and opens no live connection, as the agreement requires.

## Unverified
- **Static typecheck not run.** The fixture has no package manager or installed compiler, and no declared typecheck command, so the TypeScript sources were read but not compiled. Per the skill this is unknown, not a clean typed check; it is also not triggered here, since `grill/contract.ts` does not exist. (`db/adapter.ts:1` types `TicketRow` with `title`, while the close path's `RETURNING id, closed` yields rows without it — a nominal typing looseness inside Database-owned code, not a contract shape difference. It would need a compiler to confirm.)
- **Auth.** `[agreement:errors.unspecified]` and the contract header state that no auth or error behavior is agreed in this fixture. `src/auth.ts:1` returns `'not yet agreed'`, so there is no agreed behavior to compare it against. Nothing checked, nothing claimed.
- **QA.** The contract's Roles section assigns `tests/tickets.test.ts` to QA, but no `tests/` directory exists in this checkout, so no QA-owned code was available to check. The file is not named under Endpoints or Data model, so this is reported as uncheckable rather than as drift.
- **Role specs are pre-amendment, by design.** `grill/frontend-spec.md:4` and `grill/backend-spec.md:4` still describe a `tickets` wrapper, and `grill/backend-spec.md:9` records a 404 error decision. Revision 2 superseded the wrapper in the finalized contract, and the specs' recorded source hashes still match the revision (hence fresh). Specs are inputs and history is an audit trail, so neither was overlaid on the current `grill/CONTRACT.md`; the code is correct against the current agreement.
