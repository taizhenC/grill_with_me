# Contract check — 2026-10-02
_Against contract revision af606180d0a5520ec298be188d54a7111b98a25fcba3c046ccd6e7050b220ff1 (number 2, amend, "Backend and Frontend agree items wrapper replaces tickets"); freshness fresh; typed integration not applicable — no `grill/contract.ts` and `typesHash` is null for this revision. 8 files in scope (5 present, 3 absent)._

Local receipt `.grill-with-me/member.json` names this checkout's role as **frontend**, so Frontend findings are listed first — they are the ones the person running this can fix without going to find someone.

Files in scope, derived from the contract: `src/api.ts`, `src/TicketList.ts`, `db/schema.sql`, `db/adapter.ts`, `src/auth.ts` (present); `src/archive.ts`, `src/billing.ts`, `tests/tickets.test.ts` (absent).

Integrity note: `grill/CONTRACT-STATE.json` and `grill/CONTRACT-HISTORY.jsonl` both resolve to revision 2, and `grill/CONTRACT.md` hashes to `877c7af9…`, matching that revision's `proseHash`. A leftover `grill/CONTRACT.next.md` and `grill/CONTRACT-PROPOSAL.json` remain on disk; the `.next.md` file is byte-identical to `CONTRACT.md` and the proposal matches the already-applied revision 2, so finalization is complete and this is stale scratch, not an integrity conflict. The current `grill/CONTRACT.md` is the truth used below.

## Pending agreement
- None. Revision 2 is `approval: agreed`, `agreedBy: [Backend, Frontend]`, `pendingRoles: []`, and `contract-status` reports `pending: []`.

## ⚠️ Frontend
- `src/TicketList.ts:4` — **NEW** `loadTickets` returns `body.tickets`, but `[agreement:api.tickets.list]` says `GET /api/tickets` returns `{ items: { id: string; title: string; closed: boolean }[] }`. Revision 2 replaced the `tickets` wrapper with `items`; the backend at `src/api.ts:5` already returns `{ items: … }`, so this call site reads `undefined`. Note `grill/frontend-spec.md:4` still says "reads response.tickets" — that spec predates the amendment and is not the current agreement.
  → Talk to Backend before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore
- `src/TicketList.ts:9` — **NEW** `forbiddenWrite` issues `UPDATE tickets SET closed = TRUE`, writing state that `[agreement:ownership.tickets]` reserves for Backend ("Frontend must not write tickets table state"; "Backend owns src/api.ts and writes tickets.closed"). The statement also has no `WHERE` clause, so it would close every row.
  → Talk to Backend (owner of `tickets.closed`) and Database before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ⚠️ Backend
- `src/archive.ts` (file absent) — **NEW** `[agreement:api.archive]` agrees `POST /api/archive` in `src/archive.ts` returning `{ archived: boolean }`. The file does not exist and no call site references `/api/archive` anywhere in the repo: endpoint agreed but not implemented.
  → Talk to whoever raised api.archive before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore
- Implemented endpoints are clean: `src/api.ts:5` returns `{ items: result.rows }` matching `api.tickets.list`; `src/api.ts:8-9` runs `UPDATE tickets SET closed = TRUE WHERE id = $1 RETURNING id, closed` and returns `result.rows[0]`, matching `api.tickets.close` and the `data.tickets` statement text; the `paths` constants at `src/api.ts:2` match both agreed path literals.

## ⚠️ Payments
- `src/billing.ts` (file absent) — **NEW** `[agreement:api.billing]` agrees `POST /api/billing` in `src/billing.ts` returning `{ ok: boolean }`. The file does not exist and no call site references `/api/billing`: endpoint agreed but not implemented.
  → Talk to Payments — but note no Payments role exists in `grill-room.json` or in the revision's recorded specs (auth, backend, database, frontend, qa), so there may be no one to talk to. This contract/room mismatch needs reconciling, not guessing.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ✅ Database
- No drift detected. `db/schema.sql:1` defines `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)` exactly as `[agreement:data.tickets]` states. `db/adapter.ts:5-7` adapts an injected driver rather than opening a connection, which is what the agreement describes.

## ✅ Auth
- No drift detected. `src/auth.ts:1` is a placeholder returning `'not yet agreed'`; no agreement specifies auth or session behavior, and `[agreement:errors.unspecified]` forbids inventing one.

## Unverified
- **Typed integration.** `grill/contract.ts` does not exist, so `contract-typecheck` is not applicable. Independently, the fixture has no `package.json`, no `tsconfig.json`, and no installed compiler, so no typecheck could be run even if a contract type file appeared. Reported as unverified; no compiler was downloaded or installed.
- **Runtime/HTTP behavior.** `[agreement:data.tickets]` explicitly states no live connection or HTTP wiring is agreed in this fixture. `src/api.ts` exports plain functions with no route registration, and `src/TicketList.ts` takes an injected `fetcher`, so nothing proves the agreed paths are actually served. Static shapes were checked; runtime behavior was not and cannot be here.
- **QA artifact.** `[agreement:ownership.tickets]` names `tests/tickets.test.ts` as QA-owned, but the `tests/` directory does not exist. No agreement specifies what that file must contain, so this is recorded as unverified rather than scored as drift.
- **Role specs vs current contract.** `grill/backend-spec.md:4` and `grill/frontend-spec.md:4` still describe the pre-amendment `{ tickets: … }` shape. Their hashes match the ones recorded in revision 2 (hence freshness fresh), so this is not drift — the specs are the historical inputs, not the agreement. Flagged only so no one re-derives the old shape from them.
- No previous `grill/CHECK-REPORT.md` existed, so there were no "accepted" markings to carry forward and every finding above is labelled **NEW**.
