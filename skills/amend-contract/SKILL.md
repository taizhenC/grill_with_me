---
name: amend-contract
description: Amend grill/CONTRACT.md when the team changes an agreement. Anyone can run this; amendments are authoritative over the original contract.
---

The contract was written hours ago and reality has moved. Your job is to
record the new agreement so `check-contract` stops reporting it as drift —
a contract that can't be corrected becomes noise, and a noisy check gets
ignored.

## Input

The user tells you what changed, in plain words ("we moved auth to a
header", "shadeScore is now 0–100 int, not 0–1 float"). Ask exactly enough
to pin the change to specific contract lines — which endpoint, which field,
which table. One question at a time.

## What to check before writing

- Read `grill/CONTRACT.md` and `grill/CONTRACT-CHANGES.md`.
- Name the roles the change touches. If the user is one of them and the
  other role hasn't been told, say so: "this changes Backend's response
  shape — have you agreed this with them?" Record their answer in the
  amendment. Do not refuse to write it — recording an un-agreed change
  loudly beats an undocumented verbal one.

## Write

1. **Append** to `grill/CONTRACT-CHANGES.md` (create it if absent):

```markdown
## <date> — <one-line summary>
- Changed: <the specific agreement, old → new, concrete shapes>
- Touches: <roles>
- Agreed by: <who, per the user> | ⚠️ not yet agreed with <role>
```

2. **Update the affected lines in `grill/CONTRACT.md` in place**, so the
   contract stays readable as one document. The changes file is the audit
   trail; the contract is the current truth.

3. If `grill/contract.ts` exists, update the affected types and verify they
   still compile (`npx tsc --noEmit grill/contract.ts`).

Never rewrite history in CONTRACT-CHANGES.md — it is append-only. Never
batch unrelated changes into one entry.

## Hand off

Tell the user: commit all changed files together, tell the team to pull,
and if the check previously flagged this as drift, the next run will treat
the amendment as the agreement.
