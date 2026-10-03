---
name: merge-contract
description: Merge all committed grill/*-spec.md files into grill/CONTRACT.md (and grill/contract.ts on TypeScript stacks). Run by the host once every role's spec is committed.
---

You are producing the **contract** — the one document every role codes
against. Two people arguing at hour 14 must be able to point at the same
line. Precision beats prose everywhere in this task.

## Step 1 — collect and validate the specs

Keep the host's current `grill-room.json` in this checkout. Run:

```bash
npx grill-with-me merge-preflight grill-room.json
```

This read-only gate validates project context and the expected role roster,
then checks every required `grill/<role>-spec.md`. It returns JSON containing
`manifest.project`, `manifest.roles`, the exact `specs` file list, and warnings.
Use that project context and role roster, even if this host has no
`grill/PROJECT.md` or a teammate's personal pack. Read only the listed role
specs after the gate passes. A member may own more than one role; each role
still needs its separate spec file.

Run `npx grill-with-me contract-status` and read the current contract plus
`grill/CONTRACT-HISTORY.jsonl` and `grill/CONTRACT-CHANGES.md` when present.
Record the current `revision.id` as the proposal's exact parent. Contract
revision IDs are separate from room pack versions. Stop on integrity conflicts
or unfinished finalization; do not overwrite a journal or guess a parent.
An unrecorded old contract requires explicit adoption with the legacy history
hash returned by status. Preserve the prior prose and typed agreements when
adding stable IDs; show the user any proposed agreement changes first.

If the command exits nonzero, is unavailable, or reports `ok: false`, STOP and
report its errors. Do not write or replace `grill/CONTRACT.md`,
`grill/contract.ts`, or amendment history. Ask for missing role specs or a
corrected host input. Never skip the gate or infer a missing role from whoever
happened to commit a spec. Run it again after any input changes.

Each spec MUST contain exactly these five headings, in this order:

## Scope
## What I own
## What I need from other roles
## Decisions made
## Still unclear

Headings must be exact lines outside backtick/tilde code fences and HTML
comments. Trailing whitespace and up to three leading spaces are accepted;
duplicate, suffixed, missing, extra H2, or out-of-order headings fail. CRLF
and LF inputs use the same policy. A spec empty under all five headings fails;
individual empty or short sections are thin warnings when some content exists.

If a spec is malformed or is empty under all of them, STOP and report
the file by name — do not guess at its content, do not merge around it
silently. Tell the user which role needs to re-run their grill. A thin spec
(headings present but nearly empty) is merged, but flag it in the output
under `## ⚠️ THIN SPECS`.

## Step 2 — cross-check the specs

For every "What I need from other roles" entry, find the matching "What I
own" / "Decisions made" entry in the other role's spec:

- **Match** → it becomes a contract line.
- **Contradiction** (shapes disagree, names disagree, both claim ownership)
  → it goes under `## ⚠️ UNRESOLVED — decide this before you code`, quoting
  both specs so the two people can settle it at the table.
- **No counterpart** (a need no role owns) → it goes under
  `## ⚠️ NOBODY OWNS THIS`.

Never resolve a contradiction yourself. Your job is to notice and name;
deciding is theirs.

## Step 3 — stage grill/CONTRACT.next.md

Stage new prose rather than replacing the current contract directly. Assign
each concrete agreement a stable, unique H3 marker such as
`### [agreement:api.rank.response]`. IDs use lowercase letters/digits with
dot/hyphen separators; retain an ID when its agreement changes. Use at most
100 blocks, each containing its concrete agreement. Do not manufacture an
agreement merely to satisfy the format gate.

Structure:

```markdown
# Contract — <project name>
_Current agreement from N role specs. Revision receipts in CONTRACT-STATE.json; history in CONTRACT-CHANGES.md._

## Endpoints
### [agreement:api.rank.response]
<!-- Replace this note with METHOD /path, implementing file, concrete request/response shapes and owner role. -->

## Data model
<!-- table/collection — columns with types — owner role -->

## State ownership
<!-- what state — who owns it — who may write it -->

## Auth model
<!-- what exists, what is faked for the demo -->

## Error behavior
<!-- what the UI receives on failure, per endpoint where it differs -->

## ⚠️ UNRESOLVED — decide this before you code
## ⚠️ NOBODY OWNS THIS
## ⚠️ THIN SPECS
```

Every line must be concrete: `POST /api/rank` in `app/api/rank/route.ts`
returning `{ trails: { id: string; shadeScore: number }[] }`, owner
Backend. "An endpoint that returns items" must never appear. Omit the ⚠️
sections when they are empty. Do not put an agreement in the contract that
does not appear in a spec or a recorded amendment. Reconcile current amendments
with new specs explicitly; do not silently regenerate away agreed changes.

## Step 4 — emit grill/contract.ts on TypeScript stacks

If `manifest.project.knownStack` names TypeScript (or the repo has a tsconfig), also
stage `grill/contract.next.ts`: the same agreements as importable types.

- One exported interface per request/response shape and per table row
- A `Paths` constant mapping endpoint names to their literal paths
- Comments carrying the owner role
- No imports, no runtime code — types and constants only, so it compiles in
  any TS project

Bind actual implementing code and callers to these exported types at the
producer/consumer boundaries. A standalone generated file or an unused import
does not establish integration. Keep prose and staged types consistent; a
finalizer hashes artifacts but cannot infer their semantic equivalence. For a
non-TypeScript project select `types: "none"` and note prose-only checking.
Existing types require explicit `preserve` or `replace`; never silently drop them.

## Step 5 — finalize and verify the consuming project

Write `grill/CONTRACT-PROPOSAL.json` with schemaVersion 1, kind `merge` (or
explicit legacy `adopt`), exact `parentRevision` (null for a first contract), a
one-line summary, `changedAgreementIds`, `approval`, `agreedBy`, `pendingRoles`,
`types` (`none`, `preserve`, or `replace`), `amendmentResolution`, and
`resolvesPending` (usually []). Changed IDs must include every changed prose
block and identify agreements affected by changed types. For a re-merge,
`amendmentResolution` must name EVERY prior amendment revision, with decision
`preserved` or `reconciled` and a concrete note. Preserved blocks and current
types must remain unchanged; changed agreements require explicit reconciliation.
There is no force bypass. If any role has not agreed, use approval `pending`
and its role slug in `pendingRoles`; do not invent approval. Resolving prior
pending entries requires agreed approval and their exact revision IDs.

First-merge proposal example (replace names/IDs with this project's actual
agreements; choose `replace` when staging types):

```json
{
  "schemaVersion": 1,
  "kind": "merge",
  "parentRevision": null,
  "summary": "Agree the rank response",
  "changedAgreementIds": ["api.rank.response"],
  "approval": "agreed",
  "agreedBy": ["Backend", "Frontend"],
  "pendingRoles": [],
  "types": "none",
  "amendmentResolution": [],
  "resolvesPending": []
}
```

Run `npx grill-with-me contract-finalize`, then `contract-status`. The command
publishes current prose/types, appends both histories, and writes state last.
On an interrupted write, status is unknown; retry the SAME proposal and staged
outputs after fixing the filesystem error. Changed outputs or canonical edits
stop for reconciliation. A killed process may leave a lock/temp file: inspect
the journal and ensure its process stopped before removing only that leftover.
Never mark an incomplete revision fresh or delete its journal to skip recovery.

For TypeScript run `npx grill-with-me contract-typecheck <consuming-tsconfig>`.
It runs installed project tools only: the declared `npm run typecheck`, or an
installed compiler with `--noEmit -p` when no script exists. It also checks the
selected project's diagnostics. Missing tools/configs and solution references
are unknown; choose each consuming leaf config. Never use `npx tsc` to download
tools or compile `contract.ts` alone. Unintegrated imports or failures block a
claim that typed integration passed. Report baseline errors separately and
repair newly introduced mismatches before claiming a passing handoff.

See the repository's `doc/contract-revisions.md` and
`examples/type-integration/` for executable proposal and producer/consumer examples.

Tell the host: commit the current prose, optional types, both histories, and
state together; tell the team to pull, and from now on
anyone can run `check-contract` to find drift and `amend-contract` when the
contract itself needs correcting. Name pending roles and unverified freshness
explicitly. Hash preservation proves bookkeeping, not human agreement truth.
