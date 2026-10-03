# Contract check — 2026-10-02
_Against contract revision b033c0aad022a528296ccf76fab39b978516b7bdb248fd9c7577ad2515d83c6e (number 1, "Initial synthetic ticket agreement"); freshness fresh; typed integration not applicable — no `grill/contract.ts` and `typesHash` is null, so no typed-integration check was run. 5 files in scope._

Files in scope, derived from the contract: `src/api.ts` (both endpoints), `db/schema.sql` and `db/adapter.ts` (data model), `src/TicketList.ts` (call sites of `/api/tickets` and `/api/tickets/:id/close`), `src/auth.ts` (ownership only). One contract-named file, `tests/tickets.test.ts`, does not exist. A repo-wide grep for the two endpoint literals and for the `paths` constant found no other call sites.

Local receipt `.grill-with-me/member.json` names this checkout's role as **frontend**, so Frontend findings come first. No previous `CHECK-REPORT.md` existed, so there are no carried-forward "accepted" markings and anything listed would be **NEW**.

## Pending agreement
- None. `contract-status` reports `pendingRoles: []` and `pending: []` for revision b033c0aa; `grill/CONTRACT-HISTORY.jsonl` holds exactly that one revision, `grill/CONTRACT-CHANGES.md` records "Pending roles: none", and `grill/CONTRACT-STATE.json` points at the same revision ID. Agreed by Backend, Frontend, Database.

## ✅ Frontend
- No drift detected. `src/TicketList.ts:2` fetches the agreed `/api/tickets` literal and `src/TicketList.ts:4` reads `body.tickets`, matching `CONTRACT.md:10`. `src/TicketList.ts:7` posts to `/api/tickets/<id>/close` with `{ method: "POST" }`, matching `CONTRACT.md:12`. No write to tickets table state from this file, per `CONTRACT.md:4`.

## ✅ Backend
- No drift detected. `src/api.ts:2` declares both agreed paths verbatim. `src/api.ts:3-6` returns `{ tickets: result.rows }` where rows are `{ id; title; closed }` (`db/adapter.ts:1`), matching `CONTRACT.md:10`. `src/api.ts:7-10` runs `UPDATE tickets SET closed = TRUE WHERE id = $1 RETURNING id, closed` through the injected adapter and returns that row — the exact statement and route agreed at `CONTRACT.md:12,16`. No error behavior is implemented, which is correct against `CONTRACT.md:19`.

## ✅ Database
- No drift detected. `db/schema.sql:1` defines `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)`, character-for-character the data model at `CONTRACT.md:15`. `db/adapter.ts:5-7` adapts an injected PostgreSQL-compatible query driver (`$1` placeholders, positional parameter array) without opening a live connection, as agreed at `CONTRACT.md:16`.

## ✅ Auth
- No drift detected. `src/auth.ts:1` exposes only `sessionPolicy()` returning `'not yet agreed'`. The contract agrees nothing about auth behavior beyond ownership (`CONTRACT.md:7`), and the auth spec's own "Still unclear" section matches.

## ✅ QA
- No drift detected against any agreed behavior. `tests/tickets.test.ts` is named as QA's owned surface at `CONTRACT.md:7` but does not exist; the contract agrees no test behavior, so this is an unwritten owned file rather than drift. See Unverified.

## Unverified
- Runtime behavior of either endpoint. The contract explicitly leaves HTTP wiring and the live driver unagreed (`CONTRACT.md:1,16`), so `src/api.ts` exports plain functions with no route registration. Nothing checks that a real server mounts `GET`/`POST` at the agreed paths — that is out of scope by agreement, not a gap in the code.
- Typed integration. There is no `grill/contract.ts`, so `contract-typecheck` has no contract types to verify, and this fixture has no package manager or installed TypeScript compiler. No compiler was installed and no file was compiled, so type-level agreement between `src/` and `db/` is unverified rather than clean.
- Whether `tests/tickets.test.ts` is intended for this fixture at all. It is listed as QA's owned surface but absent, and no test command or framework exists here to run it.

## Notes (observations, not findings — no action implied)
- `grill/CONTRACT.next.md` is byte-identical to `grill/CONTRACT.md`, and `grill/CONTRACT-PROPOSAL.json` describes exactly the revision already applied and recorded in history. These are residue of a completed finalization, not a competing or unfinished version: `contract-status` returns `ok: true` with no integrity conflict.
- `grill/backend-spec.md` lists a "decision made" that a missing ticket returns HTTP 404 with `{ error: "not_found" }`, but that never entered the agreement — `CONTRACT.md:19` agrees no error behavior. The code correctly implements none, so there is no drift; if the team wants the 404, it needs `amend-contract` rather than a code change.
- `db/adapter.ts:3` types every `query` result as `TicketRow[]` (including `title`), so the close path's `RETURNING id, closed` row is statically wider than the agreed `{ id; closed }` response. The contract does not specify adapter types (`typesHash` is null) and the SQL matches the agreement verbatim, so this is a typing imprecision inside Database's own file, not contract drift.
