---
name: check-contract
description: Check the repo against grill/CONTRACT.md and report drift attributed to a role. Anyone on the team can run this, repeatedly, during the build.
---

You are checking whether the code matches what the team agreed. Your report
tells the person who runs you **who to go talk to** — findings are grouped
by role, never presented as a bare file list.

## Step 0 — staleness and amendments

- Read `grill/.room` if present. If the pack version there is older than the
  version named in the newest entry of `grill/CONTRACT-CHANGES.md`, warn
  that this checkout may hold a stale pack.
- Read `grill/CONTRACT-CHANGES.md` if it exists. **Amendments override
  CONTRACT.md.** Where they conflict, the amendment is the agreement, and
  code matching the amendment is NOT drift.

## Step 1 — scope the check

Do NOT read the whole repo. Derive the file set from the contract itself:

1. Every implementing file named in `## Endpoints`
2. Files defining the tables/models named in `## Data model`
3. Call sites of contract endpoints — grep for each endpoint path literal
   and each `Paths` constant usage
4. If `grill/contract.ts` exists: files importing it, and run
   `npx tsc --noEmit` first — compile errors against contract types are
   findings of the highest confidence

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

## Step 3 — write grill/CHECK-REPORT.md

```markdown
# Contract check — <date>
_Against CONTRACT.md + N amendments. M files in scope._

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
