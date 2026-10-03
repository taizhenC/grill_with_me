# Contract check — 2026-10-02
_Against contract revision 2322416109177933a597802db958bb32ea7571579d3946297f1debe4734fd8a6; freshness fresh; typed integration unverified (no `grill/contract.ts` and no compiler available). 4 files in scope._

## Pending agreement
- None.

## ✅ Backend
- No drift detected.

## ⚠️ Database
- **NEW** `db/adapter.ts:3` — the adapter types every query result as a complete `TicketRow` including `title`, but the agreed close mutation returns only `id` and `closed`.
  → Talk to Backend before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ✅ Frontend
- No drift detected.

## ✅ Auth
- No drift detected.

## ✅ QA
- No drift detected.

## Unverified
- Typed integration is unverified because `grill/contract.ts` is absent and this fixture has no compiler; no compiler was installed.
- `.grill-with-me/member.json` is absent, so no local role was inferred and all roles are reported evenly.
