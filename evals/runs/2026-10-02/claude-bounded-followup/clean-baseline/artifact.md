# Contract check — 2026-10-02
_Against contract revision 250d45987606bd0dbb54acf6e4a1d43611218cf7acf3e12e2d5e2fad358325a7 (revision number 1); freshness fresh; typed integration not applicable — no `grill/contract.ts` in the repo (`typesHash: null`). 4 files in scope._

Local receipt `.grill-with-me/member.json` names this checkout's role as **frontend**, so Frontend findings come first. (Its `packVersion: 1` is unrelated to the contract revision and was not compared to it.)

## Pending agreement
- None. `contract-status` reports `pendingRoles: []` and a top-level `pending: []` for revision 250d4598; approval is `agreed` by Backend, Frontend, Database. `grill/CONTRACT-STATE.json` points at the same revision as `grill/CONTRACT-HISTORY.jsonl` and `grill/CONTRACT-CHANGES.md`, with no integrity conflict and no unfinished finalization (`grill/CONTRACT.next.md` is byte-identical to `grill/CONTRACT.md`).

## ✅ Frontend
- No drift detected. `src/TicketList.ts:2` calls `GET /api/tickets` and `src/TicketList.ts:4` reads `body.tickets`, matching `[agreement:api.tickets.list]`. `src/TicketList.ts:7` calls `POST /api/tickets/<id>/close`, matching `[agreement:api.tickets.close]`. No write to tickets table state, as required by `[agreement:ownership.tickets]`.

## ✅ Backend
- No drift detected. `src/api.ts:1` declares the two contract path literals; `src/api.ts:2` returns `{ tickets: [{ id, title, closed }] }` and `src/api.ts:3` returns `{ id, closed }`, matching both endpoint agreements. `closed` is written by Backend only, per `[agreement:ownership.tickets]`.

## ✅ Database
- No drift detected. `db/schema.sql:1` defines `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)`, matching `[agreement:data.tickets]` exactly.

## ✅ Auth
- No drift detected. `src/auth.ts:1` is the owned surface and asserts no session policy; the contract agrees no auth behavior, so there is nothing to diverge from.

## ✅ QA
- No drift detected against any agreed line. `tests/tickets.test.ts` (named as QA's owned surface in `[agreement:ownership.tickets]`) is not present in the checkout, but no agreement specifies behavior for it, so there is no contract line to compare it against — this is not reported as drift.

## Unverified
- Runtime behavior of the endpoints. `src/api.ts:2-3` return static literals with no HTTP server or handler registration in this fixture; the shapes match the contract, but that the paths are actually served cannot be evidenced from the files in scope.
- Typed integration. `grill/contract.ts` does not exist, so `contract-typecheck` does not apply. The fixture also has no installed compiler or tsconfig; had a generated contract existed, the typed check would be **unknown**, not clean. No compiler was downloaded.
- `grill/backend-spec.md:9` records a role-level decision ("Missing ticket returns HTTP 404 with `{ error: \"not_found\" }`") that the finalized contract did not adopt — `[agreement:errors.unspecified]` says no error behavior is agreed. The code invents no error behavior, so this is consistent with the contract; flagged only so the team knows that spec decision is unagreed, not as drift.
