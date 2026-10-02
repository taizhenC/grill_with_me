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

## Step 3 — write grill/CONTRACT.md

Structure:

```markdown
# Contract — <project name>
_Generated <date> from N role specs. Amendments in CONTRACT-CHANGES.md override this file._

## Endpoints
<!-- METHOD /path — implementing file — request shape — response shape — owner role -->

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
does not appear in a spec.

## Step 4 — emit grill/contract.ts on TypeScript stacks

If `manifest.project.knownStack` names TypeScript (or the repo has a tsconfig), also
write `grill/contract.ts`: the same agreements as importable types.

- One exported interface per request/response shape and per table row
- A `Paths` constant mapping endpoint names to their literal paths
- Comments carrying the owner role
- No imports, no runtime code — types and constants only, so it compiles in
  any TS project

Verify it compiles (`npx tsc --noEmit grill/contract.ts`). If the stack is
not TypeScript, skip this step and note in CONTRACT.md that drift checking
is prose-only.

## Step 5 — hand off

Tell the host: commit both files, tell the team to pull, and from now on
anyone can run `check-contract` to find drift and `amend-contract` when the
contract itself needs correcting.
