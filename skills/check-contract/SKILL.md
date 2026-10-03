---
name: check-contract
description: Check the repo against grill/CONTRACT.md and report drift attributed to a role. Anyone on the team can run this, repeatedly, during the build.
---

You are checking whether the code matches what the team agreed. Your report
tells the person who runs you **who to go talk to** — findings are grouped
by role, never presented as a bare file list.

## Step 0 — revision integrity, freshness, and pending agreement

- Run `npx grill-with-me contract-status` before checking code. Record its exact
  revision ID and freshness: fresh means local source/artifact hashes match;
  stale means source hashes changed; unknown means source comparison is
  unavailable or integrity/recovery is incomplete. Never compare a room's
  packVersion with a contract revision. Offline unknown is unverified freshness,
  not confirmed drift. Stop on integrity conflicts or unfinished finalization;
  do not produce a clean report against mixed prose/types/history.
- Read `.grill-with-me/member.json` if present.
- This local receipt also names the role this checkout joined as. Put that role's
  findings first in the report: they are the only ones the person running
  you can fix without going to find someone.
- If local state is absent, do not infer a current role from legacy shared
  `grill/.room`, `grill/MY-ROLE.md`, or a teammate's spec. Report all roles evenly.
- Read `grill/CONTRACT-HISTORY.jsonl` and `grill/CONTRACT-CHANGES.md`.
  The current CONTRACT.md is the current truth;
  finalized amendments are already applied there. Pending roles in status must
  remain visibly pending even when file hashes are fresh. History is an audit
  trail, not a second competing version to silently overlay. For legacy
  unrecorded contracts, flag freshness unknown and request explicit adoption;
  surface prose/history contradictions for reconciliation rather than guessing.

## Step 1 — scope the check

Do NOT read the whole repo. Derive the file set from the contract itself:

Ground role attribution in the shared roster (`grill-room.json`, if present)
and the contract's Roles section. A clause naming an owner does not create a
teammate. If that owner is absent from the available shared roster, or from the
contract role list when no roster exists, record **unverified ownership** with
the clause and missing path/spec evidence. Ask the team to assign or reconcile
that owner; do not direct a conversation to an invented teammate. Keep a
missing implementation and an unconfirmed owner distinct.

1. Every implementing file named in `## Endpoints`
2. Files defining the tables/models named in `## Data model`
3. Call sites of contract endpoints — grep for each endpoint path literal
   and each `Paths` constant usage
4. If `grill/contract.ts` exists, run
   `npx grill-with-me contract-typecheck <consuming-tsconfig>` first. This uses
   the project's installed compiler and real declared typecheck command, plus
   selected-project diagnostics. Choose each leaf config in a solution repo.
   No compiler/config means unknown; missing or unused imports mean
   unintegrated. Neither is a clean typed check. Never automatically download
   TypeScript or compile only the generated file. Use the reported consumers
   and concrete diagnostics to scope findings; compare existing baseline errors.
   Bound imports do not prove both sides of every endpoint use the contract or
   establish runtime behavior. Inspect producer/caller boundaries explicitly.

If a contract file does not exist yet in the repo, that is a finding
("endpoint agreed but not implemented"), not a reason to search elsewhere.

## Step 2 — compare

For each contract line, check the implementation:

- Field names and shapes in responses vs the contract's response shape
- Request parsing vs the contract's request shape
- Table/column names vs the data model
- Who writes state that another role owns
- Error behavior where the contract specifies it

Only report what you can evidence with a file and line. If you cannot read
enough to be sure, say "unverified", never guess. A clean repo must produce
an empty report — do not manufacture findings to seem useful.

For every drift item, identify the current contract clause and the incompatible
code behavior. An HTTP response shape constrains the endpoint producer; it
does not require every caller to parse that body or return the parsed object.
Returning a raw fetch Response is compatible unless the contract also agrees
the caller's return/consumption behavior. Do not turn missing parsing or absent
generated types into an extra agreement. Record missing type integration or
untraced runtime behavior under "Unverified"; report a field mismatch when a
caller actually reads a field incompatible with the agreed response.

## Step 3 — write grill/CHECK-REPORT.md

```markdown
# Contract check — <date>
_Against contract revision <ID or unrecorded>; freshness <fresh/stale/unknown>; typed integration <result>. M files in scope._

## Pending agreement
- <revision ID and roles still pending, or none>

## ⚠️ <Role name>
- `path/to/file.ts:LINE` — what the code does vs what the contract says.
  → Talk to <other role> before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ✅ <Role name>
- No drift detected.

## Unverified
- <anything you could not check, and why>
```

Every finding offers the three outcomes above — drift is sometimes the
contract's fault, and the fix for that is `amend-contract`, not a code
change. If a previous CHECK-REPORT.md exists, carry forward its "accepted"
markings and label findings not present last time as **NEW**.

Finish by summarizing: how many findings, how many new, and — if any —
which single conversation between two people would clear the most items.
