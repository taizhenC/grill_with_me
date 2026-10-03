# Contract check — 2026-10-02
_Against contract revision `2322416109177933a597802db958bb32ea7571579d3946297f1debe4734fd8a6` (number 2, kind amend); freshness **fresh**; typed integration **not applicable — no `grill/contract.ts` exists** (`typesHash: null`, proposal `"types": "none"`). 5 files in scope._

Scope derived from the contract: `src/api.ts` (Endpoints), `db/schema.sql` and `db/adapter.ts` (Data model), plus call sites found by grepping the endpoint literals and the `paths` constant: `src/TicketList.ts`, `src/auth.ts`.

No local role: there is no `.grill-with-me/member.json` (no `.grill-with-me/` directory at all), so this checkout has no role receipt. `grill/.room` (`"role":"backend"`) and `grill/MY-ROLE.md` ("Your role is Backend") are legacy shared files and are **not** used to infer a current role. All roles are therefore reported evenly, in contract order, with no role promoted to the top.

## Pending agreement
- None. Revision 2 reports `approval: agreed`, `agreedBy: ["Backend","Frontend"]`, `pendingRoles: []`, and `contract-status` returns `pending: []`. No role is awaiting approval.

## ✅ Backend
- No drift detected.
- `src/api.ts:2` declares both agreed paths (`/api/tickets`, `/api/tickets/:id/close`).
- `src/api.ts:3-6` — `GET /api/tickets` returns `{ items: result.rows }`, matching the revision-2 shape `{ items: { id; title; closed }[] }`; the query selects exactly `id, title, closed`.
- `src/api.ts:7-10` — close returns `result.rows[0]` from `UPDATE tickets SET closed = TRUE WHERE id = $1 RETURNING id, closed`, matching `{ id: string; closed: boolean }` and the data-model's agreed statement verbatim.
- Writes to `tickets.closed` stay with Backend, as `ownership.tickets` assigns.
- No error behavior is invented, as `errors.unspecified` requires.

## ✅ Frontend
- No drift detected.
- `src/TicketList.ts:2-4` reads `body.items` from `GET /api/tickets` — this matches the **current** contract (`grill/CONTRACT.md:10`).
- Note for readers: `grill/frontend-spec.md:4` ("reads `response.tickets`") and `grill/backend-spec.md:4` (`{ tickets: ... }`) still describe the pre-amendment wrapper. Those are grilling-phase role specs and the superseded revision-1 shape, not a competing current version; revision 2 ("Backend and Frontend agree items wrapper replaces tickets") is already applied to `CONTRACT.md`. The code agrees with the contract, so this is **not** a finding.
- `src/TicketList.ts:7` closes a ticket by calling the agreed `POST /api/tickets/:id/close` endpoint rather than writing table state directly, so the `ownership.tickets` restriction ("Frontend must not write tickets table state") holds.

## ✅ Database
- No drift detected.
- `db/schema.sql:1` defines `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)` — column names, types, and default match `data.tickets` exactly.
- `db/adapter.ts:5-7` adapts an **injected** query driver and opens no live connection, matching "adapts an injected PostgreSQL-compatible query driver; no live connection or HTTP wiring is agreed in this fixture."
- `db/adapter.ts:1-4` types `TicketRow` as `{ id; title; closed }`, consistent with the agreed row shape consumed by `src/api.ts:1`.

## ✅ Auth
- No drift detected.
- `src/auth.ts:1` returns `'not yet agreed'` and asserts no session policy. The contract agrees nothing about auth beyond ownership, so there is nothing to contradict.

## ✅ QA
- No drift detected against any agreement. See Unverified for the absent test file.

## Unverified
- **QA's owned artifact does not exist.** `grill/CONTRACT.md:7` and `grill-room.json:74` name `tests/tickets.test.ts` as QA-owned, but there is no `tests/` directory. Ownership is the only thing agreed for that path — no endpoint, shape, or test behavior is agreed for it — so this is recorded as unverified (nothing to compare), not as drift. If the team expects tests to exist, that is a new agreement for `amend-contract`, not a code fix.
- **Typed integration was not exercised.** `grill/contract.ts` does not exist, so the `contract-typecheck` step does not apply. Independently, the fixture has no `package.json`, no `tsconfig*.json`, and no installed compiler, so no typecheck could have been run even if types were generated; TypeScript was deliberately not downloaded. Treat type-level conformance as **unknown**, established here by reading source only.
- **Runtime behavior was not exercised.** There is no HTTP wiring or live database in this fixture (and none is agreed), so the checks above are static reads of producer/consumer boundaries. Reading `src/api.ts:5` and `src/TicketList.ts:4` shows both sides use the `items` wrapper, but no request was executed.
- **Leftover staging artifacts, reviewed and benign.** `grill/CONTRACT.next.md` is byte-identical to `grill/CONTRACT.md` (compared in full, 1223 bytes each), and `grill/CONTRACT-PROPOSAL.json` is exactly revision 2's proposal (`parentRevision` = revision 1's id, same summary, same `changedAgreementIds`, same `agreedBy`). `grill/CONTRACT-STATE.json` points at revision 2, which is the last entry in `grill/CONTRACT-HISTORY.jsonl`, and `contract-status` returns `ok: true`. Finalization is complete and consistent — no integrity conflict and no unfinished finalization, so this check was allowed to proceed.
- Room `packVersion` (1) was deliberately **not** compared with the contract revision number; they are unrelated.

---

## Outcomes
No findings, so no outcome checkboxes are required. For reference, every finding in this report format offers:
`[ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore`

No previous `grill/CHECK-REPORT.md` existed in this checkout, so there are no "accepted" markings to carry forward and no baseline against which to mark findings **NEW**.
