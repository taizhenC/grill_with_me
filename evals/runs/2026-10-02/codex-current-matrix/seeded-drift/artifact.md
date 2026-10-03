# Contract check — 2026-10-02
_Against contract revision af606180d0a5520ec298be188d54a7111b98a25fcba3c046ccd6e7050b220ff1; freshness fresh; typed integration unverified (no `grill/contract.ts` and no compiler available). 6 files in scope._

## Pending agreement
- None.

## ⚠️ Frontend
- **NEW** `src/TicketList.ts:4` — the caller reads `body.tickets`, but `GET /api/tickets` returns the agreed `{ items: ... }` wrapper.
  → Talk to Backend before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore
- **NEW** `src/TicketList.ts:9` — Frontend directly updates `tickets.closed`, but the contract says Frontend must not write ticket-table state and Backend owns writes to `tickets.closed`.
  → Talk to Backend before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ⚠️ Backend
- **NEW** `grill/CONTRACT.md:14` — the contract assigns `POST /api/archive` to `src/archive.ts`, but that implementing file does not exist.
  → Talk to Frontend before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ⚠️ Payments
- **NEW** `grill/CONTRACT.md:16` — the contract assigns `POST /api/billing` to `src/billing.ts`, but that implementing file does not exist.
  → Talk to Frontend before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ✅ Database
- No drift detected.

## Unverified
- Typed integration is unverified because `grill/contract.ts` does not exist and this fixture has no package manager/compiler. Runtime producer/caller boundaries were inspected directly.
- Error behavior is unverified because the contract explicitly leaves it unspecified.
