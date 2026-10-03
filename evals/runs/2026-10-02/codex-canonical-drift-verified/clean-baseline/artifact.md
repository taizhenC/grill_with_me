# Contract check — 2026-10-02
_Against contract revision 250d45987606bd0dbb54acf6e4a1d43611218cf7acf3e12e2d5e2fad358325a7; freshness fresh; typed integration unverified (no `grill/contract.ts`, and this fixture has no compiler). 3 files in scope._

## Pending agreement
- None.

## ✅ Frontend
- No drift detected.

## ⚠️ Backend
- **NEW** `src/api.ts:3` — `closeTicket` returns `{ id, closed: true }` but does not write `tickets.closed`; the contract assigns that state write to Backend.
  → Talk to Database before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ✅ Database
- No drift detected.

## Unverified
- Typed integration is unverified because `grill/contract.ts` does not exist and the fixture has no package manager/compiler. Static producer and caller boundaries were inspected instead.
