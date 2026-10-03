# Contract check — 2026-10-02
_Against contract revision af606180d0a5520ec298be188d54a7111b98a25fcba3c046ccd6e7050b220ff1 (number 2, kind amend); freshness fresh; typed integration not applicable — no `grill/contract.ts` exists, and the fixture has no compiler or tsconfig. 6 files in scope (2 absent)._

Local receipt `.grill-with-me/member.json` names this checkout's role as **Frontend**; Frontend findings are listed first. `grill/CONTRACT-STATE.json` points at the same revision as `contract-status`, prose/history hashes agree, and `grill/CONTRACT.next.md` / `grill/CONTRACT-PROPOSAL.json` are byte-identical leftovers of the already-finalized revision 2 — no integrity conflict, no unfinished finalization, nothing overlaid from history.

Scope derived from the contract: `src/api.ts`, `src/archive.ts` (absent), `src/billing.ts` (absent), `db/schema.sql`, `db/adapter.ts`, plus the call site `src/TicketList.ts` found by grepping `/api/tickets`, `/api/archive`, `/api/billing` and `paths` usage.

## Pending agreement
- None. Revision 2 is `approval: agreed` (Backend, Frontend) with `pendingRoles: []`, and `contract-status` reports `pending: []`.

## ⚠️ Frontend
- `src/TicketList.ts:4` — **NEW** — `loadTickets` returns `body.tickets`, but `[agreement:api.tickets.list]` (CONTRACT.md:10, as amended in revision 2) says `GET /api/tickets` returns `{ items: { id: string; title: string; closed: boolean }[] }`. The producer already emits `items` (`src/api.ts:5`), so this consumer reads an undefined field.
  → Talk to Backend before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore
- `src/TicketList.ts:9` — **NEW** — `forbiddenWrite` issues `UPDATE tickets SET closed = TRUE` directly. `[agreement:ownership.tickets]` (CONTRACT.md:4-5) says Frontend must not write tickets table state and that Backend writes `tickets.closed`. The statement is also unparameterized, so it would close every row rather than one.
  → Talk to Backend (owner of `tickets.closed` writes) and Database (owner of the adapter) before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ⚠️ Backend
- `src/archive.ts` (file absent) — **NEW** — `[agreement:api.archive]` (CONTRACT.md:14) agrees `POST /api/archive` in `src/archive.ts` returning `{ archived: boolean }`. No such file exists and no call site references `/api/archive`: endpoint agreed but not implemented.
  → Talk to Frontend (the would-be consumer) before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ⚠️ Payments — role not on the team
- `src/billing.ts` (file absent) — **NEW** — `[agreement:api.billing]` (CONTRACT.md:16) agrees `POST /api/billing` in `src/billing.ts` returning `{ ok: boolean }`, attributed to a "Payments" role. That role appears nowhere in `[agreement:ownership.tickets]` (CONTRACT.md:4-7) and nowhere in `grill-room.json:19-81`, and `grill-room.json:10-13` lists "Billing" under `outOfScope`. The file is absent, so the endpoint is agreed but not implemented — and there is no one to assign it to.
  → No Payments member exists to talk to; this needs the team to reconcile the contract itself (`amend-contract`) or to add the role.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ✅ Database
- No drift detected. `db/schema.sql:1` defines `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)`, matching `[agreement:data.tickets]` (CONTRACT.md:19) exactly. `db/adapter.ts:5-7` adapts an injected driver rather than opening a connection, as CONTRACT.md:20 agrees.

## ✅ Auth
- No drift detected. `[agreement:errors.unspecified]` (CONTRACT.md:23) agrees no error behavior, and the contract agrees no auth behavior beyond ownership of `src/auth.ts`; `src/auth.ts:1` returns `'not yet agreed'`, which contradicts nothing agreed.

## Unverified
- **Typed integration.** `grill/contract.ts` does not exist, so Step 1.4 does not apply. There is also no `tsconfig.json`, no `package.json`, and no installed compiler in this fixture, so no typed check of any kind was run. Per instructions no compiler was installed; treat typed integration as unverified rather than clean.
- **`src/api.ts:9` close-response type width.** `closeTicket` returns `result.rows[0]`, whose declared type is `TicketRow` (`db/adapter.ts:1`), including `title` — wider than the `{ id: string; closed: boolean }` of `[agreement:api.tickets.close]` (CONTRACT.md:12). The SQL at `src/api.ts:8` is `RETURNING id, closed`, matching the contract, so the runtime shape looks correct and this may be type-level only. Not reported as drift: confirming it needs a compiler, which is unavailable.
- **Runtime/HTTP behavior.** CONTRACT.md:1 and :20 state that driver and HTTP wiring are not agreed in this fixture. Nothing routes `paths` (`src/api.ts:2`) to a server and no driver is constructed, so no request parsing, status codes, or live query behavior could be checked for either tickets endpoint.
- **QA.** `[agreement:ownership.tickets]` (CONTRACT.md:7) assigns `tests/tickets.test.ts` to QA; there is no `tests/` directory. The contract agrees no test behavior, so this is recorded as uncheckable rather than as drift.
- **No prior report.** No earlier `grill/CHECK-REPORT.md` existed, so there were no "accepted" markings to carry forward and all findings are labelled NEW.
