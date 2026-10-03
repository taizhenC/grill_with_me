# P1-02 contract revisions and consuming TypeScript integration

Prepared 2026-10-02 on `codex/contract-revisions`, based on integrated main
`3809689`. Feature PR: [#28](https://github.com/taizhenC/grill_with_me/pull/28). No merge is performed
by this feature branch; combined main validation follows the requested merges.

## Delivered behavior

- Separate deterministic contract IDs from room `packVersion`. Current prose,
  optional types, human-readable history, JSONL hash-linked history and state
  are bound together. Source metadata records normalized host context plus
  each validated role spec's path/role/content hash.
- `contract-status` distinguishes locally fresh, stale and unknown source
  hashes, with visible pending role agreement independent of freshness.
  A missing host roster in an offline member checkout stays unknown.
- `contract-finalize` publishes staged outputs against their exact parent.
  Stable agreement blocks, explicit legacy adoption/history acknowledgment,
  and required preservation/reconciliation of every amendment prevent silent
  replacement. Pending approvals require a later explicit resolving record.
  Prose-only contracts remain supported; existing types cannot silently vanish.
- Exclusive lock/journal acquisition rechecks the original snapshot. Incomplete
  mixed writes stay unknown and resume only with identical proposals/staged
  output. Journal contents must match revision hashes and history/state tip.
  Preview is read-only; force bypass is rejected.
- `contract-typecheck` finds actual bound imports/usages with project-installed
  or workspace-hoisted TypeScript, runs the real declared typecheck (or local
  project compiler), and enforces selected-config diagnostics. Unused and
  side-effect imports remain unintegrated; missing tools/solution configs unknown.
  No compiler download or ambient NODE_PATH/global fallback is allowed.
- Merge/amend/check skills require these gates, preserve canonical member-local
  selection, and explain interrupted recovery. [The guide](contract-revisions.md)
  contains executable metadata; `examples/type-integration/` demonstrates both
  producer and consumer imports and a seeded field mismatch.

## Validation and review

Clean `npm ci --no-audit --no-fund` passed after integration with main. On Windows:

- Verified Node 24.21.0 full Vitest run: **503 passed, 8 platform skips**. After
  final compiler-lookup hardening, **85 focused revision/type/record/skill/pack
  tests** passed on Node 24; repository typecheck passed.
- Node 22.15.0 broad CLI/parser/preflight/record matrix: **273 passed, 8 platform
  skips**. Final **42** revision/type/record tests and typecheck passed afterward.
- Real independent CLI processes prove stale plans cannot replace a competing
  completed revision. Windows readonly destination failures prove recovery;
  tampered journal payloads fail before canonical writes. These two readonly
  cases are intentionally Windows-only, not claimed as Unix fault injection.
- Correct importing producer/consumer code passes its declared npm project
  check; seeded `shadeRating` fails TS2339 against `shadeScore`. Absent, unused
  and side-effect imports report unintegrated even when compilation succeeds.
- Node 24 production build and both pack-serving route traces include all four
  skills. Actual installed offline beta archives passed on Node 22 and 24,
  including the new contract commands; `git diff --check` passed.

Independent root review found and resolved the paused-before-lock snapshot gap
and incomplete journal-output binding. Revised core and consuming-type gate
reviews reported no blocker. Four-platform CLI CI includes record coverage;
hosted evidence supplements local checks and is not a mandatory approval gate.
All feature commits are authored and committed solely by
`taizhenC <tzhcheung@gmail.com>`, without co-author trailers.

## Limits

Hash bookkeeping is neither a signature nor proof of human approval, semantic
agreement, or runtime payload validity. The gate proves some static usage;
the example explicitly proves both producer and consumer. Custom import-type
expressions/compiler pipelines and reference graphs are not exhaustive;
select consuming leaf configs and inspect boundaries. Arbitrary concurrent
editors and power-loss transactions are outside the finalizer's lock contract.
Killed processes can leave inspected lock/temp cleanup before identical retry.
Deterministic tests and prompt assertions do not fabricate live agent evaluation
or team-pilot outcomes; those belong to the separate evaluation work.
