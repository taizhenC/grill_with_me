# Contract check — 2026-10-02
_Against contract revision b033c0aad022a528296ccf76fab39b978516b7bdb248fd9c7577ad2515d83c6e; freshness fresh; typed integration unintegrated (`grill/contract.ts` is absent). 4 files in scope._

## Pending agreement
- None.

## ⚠️ Frontend
- **NEW** `src/TicketList.ts:7` — the `POST /api/tickets/:id/close` caller returns the raw fetch response without reading the agreed `{ id: string; closed: boolean }` response shape, so the caller boundary is not integrated with or checked against the contract.
  → Talk to Backend before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ✅ Backend
- No drift detected.

## ⚠️ Database
- **NEW** `db/adapter.ts:3` — the adapter types every query result as `TicketRow[]`, which requires `title`, but the agreed close update returns only `id` and `closed`; the adapter cannot accurately represent that agreed result shape.
  → Talk to Backend before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## Unverified
- Runtime behavior was not executed because the fixture contains no agreed live database connection or HTTP wiring.
- Static typed integration could not be checked because `grill/contract.ts` is absent; no compiler was installed or invoked.
