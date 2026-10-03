# Contract check — 2026-10-02
_Against contract revision af606180d0a5520ec298be188d54a7111b98a25fcba3c046ccd6e7050b220ff1; freshness fresh; typed integration unavailable (`grill/contract.ts` is absent). 6 files in scope._

## Pending agreement
- None.

## ⚠️ Frontend
- **NEW** `src/TicketList.ts:4` — `loadTickets` reads `body.tickets`, but agreement `api.tickets.list` says `GET /api/tickets` returns the list in `body.items`.
  → Talk to Backend before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore
- **NEW** `src/TicketList.ts:9` — Frontend directly issues `UPDATE tickets SET closed = TRUE`, but agreement `ownership.tickets` says Frontend must not write tickets table state and Backend writes `tickets.closed`.
  → Talk to Backend and Database before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ⚠️ Backend
- **NEW** `grill/CONTRACT.md:14` — agreement `api.archive` requires Backend's `POST /api/archive` implementation in `src/archive.ts`, but `src/archive.ts` is absent.
  → Talk to Backend before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ✅ Database
- No drift detected.

## ✅ Auth
- No drift detected.

## ✅ QA
- No drift detected.

## ⚠️ Unassigned owner (Payments ownership unverified)
- **NEW** `grill/CONTRACT.md:16` — agreement `api.billing` requires `POST /api/billing` in `src/billing.ts`, but `src/billing.ts` is absent. The clause names Payments, which is not in `grill-room.json` or the contract's Roles section, so ownership cannot be attributed to a teammate.
  → Ask the team to assign or reconcile the owner before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## Unverified
- Typed integration is unverified because `grill/contract.ts` is absent; no compiler was installed or invoked.
- Ownership of agreement `api.billing` is unverified because Payments is absent from both the shared roster and the contract's Roles section.
