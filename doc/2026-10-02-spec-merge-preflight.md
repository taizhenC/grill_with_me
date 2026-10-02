# Deterministic specs and merge preflight — 2026-10-02

Plan: P1-01. Branch: `codex/spec-merge-preflight`, based on `09938af`.

## Implemented

The library, member CLI, and host preflight execute one dependency-free spec
parser. Its five exact H2 headings must occur once, in order, outside backtick
or tilde fences and HTML comments. LF and CRLF work identically. Up to three
leading spaces and trailing whitespace are accepted. Duplicates, suffixed or
extra H2 headings, missing sections, and wholly empty specs fail. A partially
thin spec passes with warnings; the validator never invents agreements.
Literal HTML comment markers inside code examples remain content.

`npx grill-with-me merge-preflight [room-file]` defaults to the host's local
`grill-room.json`. It checks schema version, usable project context, distinct
bounded role slugs/names/descriptions, and the supported metadata shapes. It
returns normalized project context, the complete role roster, exact required
spec paths, sorted errors, and warnings as JSON. Every expected role needs its
own spec, even when one person covers several roles. Extra role-spec files
must be reconciled with the roster. A fresh host needs no member `PROJECT.md`
or personal pack. This local merge-input contract is deliberately narrower
than full server Zod validation; it is not a replacement for publish validation.

Preflight only reads files. The merge skill must run it before replacing
`CONTRACT.md`, `contract.ts`, or amendment history; an unavailable or failed
gate stops the merge. Member instructions also require `check-spec` before
committing the generated spec. The actual npm archive contains all helpers.

## Validation

- A 25-case corpus runs through the library, shared module, and real CLI
  subprocesses. Cases cover malformed/empty specs, LF/CRLF, duplicate and
  reordered headings, exact/suffixed headings, both fence types and closing
  rules, hidden comment headings, and literal fenced HTML comments.
- An isolated probe of `09938af` reproduced old library and CLI false success
  for wholly empty, duplicate, suffixed, and fenced specs. All four fail now.
- The 38 merge-input/preflight tests cover metadata bounds, missing rosters and
  specs, fresh hosts without member packs, multiple role files, stale extra
  specs, and preservation of existing contracts, types, history, and inputs.
- Windows Node 24.21.0: full suite passed **325 tests**, with seven existing
  skips; all 16 test files passed. Typecheck passed. Node 22.15.0 focused
  parser/CLI/pack tests passed **112 tests**, with four existing skips.
- Next 16.3.8 production build and production skill traces passed. Installed
  npm archive smoke passed on Node 22 and Node 24, including valid/invalid
  spec checks and the host merge gate. CI runs the new suites on Windows/Linux
  with Node 22/24 before merge.
- Independent code review found and resolved the fenced HTML comment edge
  case; no implementation blocker remained after the fix.

## Limits and follow-ups

This gate checks structure and local input completeness, not the truth or
quality of an agreement. Its thin-content threshold is a warning heuristic.
It reads the working checkout and does not prove specs were committed. A
read-only CLI cannot prevent an agent from ignoring instructions; real agent
and team evaluations remain P1-05. Contract revision/type consumption is P1-02.
No public npm publication, deployment, or live agent evaluation occurred here.
Hosted CI must pass before merge; this feature task has not merged its PR.

Fence handling follows the relevant opening/closing rules in the
[CommonMark specification](https://spec.commonmark.org/0.31.2/#fenced-code-blocks).
The parser intentionally enforces this project's narrower exact-heading policy;
it is not a complete Markdown renderer.
