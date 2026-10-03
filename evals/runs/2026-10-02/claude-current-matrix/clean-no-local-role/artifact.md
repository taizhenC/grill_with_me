# Contract check — 2026-10-02
_Against contract revision 2322416109177933a597802db958bb32ea7571579d3946297f1debe4734fd8a6 (number 2, kind amend); freshness fresh; typed integration not applicable — `grill/contract.ts` does not exist (recorded `typesHash: null`). 5 files in scope._

Local state note: `.grill-with-me/member.json` is absent, so this checkout has no joined role.
Findings are therefore reported evenly across all roles, with no role placed first.
Legacy `grill/.room` (`"role":"backend"`) and `grill/MY-ROLE.md` ("Your role is Backend")
were **not** used to infer a current role, per the contract's Step 0.

Integrity: `grill/CONTRACT-STATE.json` revision matches the status revision, `grill/CONTRACT.next.md`
is byte-identical to `grill/CONTRACT.md`, and `grill/CONTRACT-PROPOSAL.json` matches the finalized
revision 2 record in `grill/CONTRACT-HISTORY.jsonl` — finalization is complete, no integrity conflict.

## Pending agreement
- None. Revision 2 reports `approval: "agreed"`, `agreedBy: ["Backend","Frontend"]`,
  `pendingRoles: []`, and `pending: []` in `contract-status`.

## ✅ Backend
- No drift detected.
  - `src/api.ts:2` — path literals `/api/tickets` and `/api/tickets/:id/close` match
    `grill/CONTRACT.md:10` and `grill/CONTRACT.md:12`.
  - `src/api.ts:5` — `GET /api/tickets` returns `{ items: result.rows }`; rows are
    `TicketRow = { id; title; closed }` (`db/adapter.ts:1`), matching the agreed
    `{ items: { id: string; title: string; closed: boolean }[] }` wrapper from revision 2.
  - `src/api.ts:8` — the close path issues exactly
    `UPDATE tickets SET closed = TRUE WHERE id = $1 RETURNING id, closed` through the injected
    adapter, as `grill/CONTRACT.md:16` specifies; `src/api.ts:9` returns that row, matching
    `{ id: string; closed: boolean }`.
  - No error behavior is invented anywhere in `src/api.ts`, as required by
    `grill/CONTRACT.md:19`.

## ✅ Frontend
- No drift detected.
  - `src/TicketList.ts:4` — reads `body.items`, matching the revision 2 `items` wrapper.
  - `src/TicketList.ts:2,7` — calls `/api/tickets` and `/api/tickets/<id>/close` with
    `method: "POST"`, matching the agreed paths.
  - No write to tickets table state from `src/TicketList.ts`, as required by
    `grill/CONTRACT.md:4`.

## ✅ Database
- No drift detected.
  - `db/schema.sql:1` — `tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE)`
    matches `grill/CONTRACT.md:15` exactly, column for column.
  - `db/adapter.ts:5-7` — adapts an injected query driver with positional (`$1`) parameters,
    matching the PostgreSQL-compatible injected-driver wording at `grill/CONTRACT.md:16`.
    No live connection is opened, which the contract explicitly leaves unagreed.

## ✅ Auth
- No drift detected.
  - `src/auth.ts:1` — `sessionPolicy()` returns `'not yet agreed'`; the contract agrees only
    ownership of this file (`grill/CONTRACT.md:7`) and no auth behavior, so there is nothing
    to diverge from.

## ✅ QA
- No drift detected.
  - `tests/tickets.test.ts` is named only in the ownership agreement (`grill/CONTRACT.md:7`).
    No test content, endpoint, or data-model behavior is agreed for QA, so the file's absence
    is not drift against any agreement line. Recorded under Unverified below rather than as
    a finding.

## Unverified
- `tests/tickets.test.ts` does not exist in the repo. Whether it is expected to exist is not
  settled by the contract — ownership is agreed, existence is not. Raise it with QA if the
  team intends the file to be required, and amend the contract rather than treating it as drift.
- Runtime behavior of both endpoints. `grill/CONTRACT.md:16` states that no live connection or
  HTTP wiring is agreed in this fixture; there is no server, no route registration, and no
  driver instance, so the agreed response shapes were verified by reading the producer and
  caller boundaries, not by execution.
- Compile-level typing. There is no `grill/contract.ts`, so `contract-typecheck` does not apply.
  Separately, this fixture ships no package manager or TypeScript compiler, and no compiler was
  downloaded or installed; `src/TicketList.ts` is untyped JavaScript-style TS (its `fetcher` and
  `id` parameters are implicitly `any`), so the Frontend/Backend shape agreement is evidenced by
  reading `body.items` against `{ items: ... }`, not by a type check.
- Stale role specs, noted for context, not as drift: `grill/backend-spec.md:4` and
  `grill/frontend-spec.md:4` still describe the pre-amendment `{ tickets: ... }` wrapper from
  revision 1. Revision 2 amended `api.tickets.list` to `items`, and the finalized
  `grill/CONTRACT.md` is the current truth; the specs are audit input whose hashes are unchanged
  since revision 2 was recorded (hence freshness `fresh`). The code correctly follows the
  amended contract. If the team wants the specs re-synced, that is a spec edit, not a code fix.

---

**0 findings, 0 new.** No previous `grill/CHECK-REPORT.md` existed, so there were no "accepted"
markings to carry forward. No conversation is needed to clear items — the repo matches the
agreed contract at revision 2.
