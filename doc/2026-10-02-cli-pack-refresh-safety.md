# CLI pack refresh safety — 2026-10-02

Completed locally as the install-state and refresh slice of P0-02. This feature
is submitted in one PR against `main`; merging and release publication are
separate actions.

## Scope and behavior

- Member receipts in `grill/.room` now contain a versioned schema, normalized
  origin, room key, role, pack version, and locally computed SHA-256 payload
  hashes. Local role reuse requires both the original origin and room. The
  downloaded pack's room, role, and version must agree with its downloaded
  stamp before any write.
- Host skill installations use a separate `.grill-with-me-host.json` receipt
  bound to origin. This is fixed local metadata, never a new remote manifest
  destination. Existing member and host receipts remain independent.
- An unchanged installed file can refresh automatically. Edited or deleted
  files stop the complete plan unless the user explicitly chooses `--force`.
  Content already identical to the desired payload can be adopted safely,
  including during retry. Legacy stamps without origin and hashes do not
  authorize overwrites or implicit role selection.
- AGENTS ownership covers only its complete fenced block. Personal content
  outside that block is preserved byte for byte. Removed owned blocks count
  as local edits. Duplicate, reversed, incomplete, or missing incoming fences
  fail safely, as do invalid local UTF-8 files, even under `--force`.
- The whole plan preflights payloads, receipts, `.gitignore`, and their fixed
  temporary paths before mutation. Files are written to exclusively created
  same-directory temporary files, synced, and renamed; existing private modes
  are not widened. The completed receipt is written last. Normal I/O failures
  clean up the temporary file and keep the previous receipt.
- Identical-payload retry completes an interrupted installation without a
  journal: already updated content matches the desired payload, while remaining
  old content still matches the previous receipt. Conflicting changed payloads
  stop for inspection. Stale temporary files also stop before any write.
- `.gitignore` receives local receipt and temporary-file rules. Ordinary member
  and host-skill installation still works in a plain folder without invoking
  Git. Dry-run performs planning only, with no directory, file, or claim writes.
  Specs and contracts remain outside the fixed install allowlist.

## Commits

1. `18007a6` — **Protect pack refreshes with origin-bound content receipts**:
   installer module, join/host integration, package inclusion, and 39 real CLI
   subprocess cases. The initial edited-file regression failed against the old
   implementation before the fix.
2. **Document pack recovery and verify every CLI suite in CI**: README migration
   and recovery guidance, this completion record, explicit archive helper checks,
   and the `tests/cli` filter for all current and future CLI suites in the
   Windows/Linux and Node 22/24 matrix.

All feature commits use `taizhenC <tzhcheung@gmail.com>` as both author and
committer, with detailed bodies and no co-author trailers.

## Validation

Local environment: Windows, Node **v22.15.0**.

- `npm ci --no-audit --no-fund` — passed from the branch lockfile.
- `npm test` — **273 passed, 8 skipped**, 13 test files. The eight skips are
  Unix-only cases on Windows. The new refresh suite has 39 cases, including
  actual Windows readonly-file rename failures, a final receipt-write failure,
  preserved sentinel content, safe identical retry, and refusal of changed
  payloads after interruption.
- `npm run typecheck` — passed.
- `node scripts/verify-cli-package.mjs` — passed: archive contents, installed
  command/version/help, and valid/invalid spec checks.
- A freshly packed CLI was installed offline into a separate consumer directory
  containing spaces. With `GRILL_CLI_TEST_BIN` pointing to that installed package,
  `vitest run tests/cli` passed **140 tests, 8 skipped**, across all three CLI
  suites. This exercises actual member/host installation and refresh against
  loopback HTTP fixture servers through the installed package.
- `git diff --check` — passed.

No hosted CI outcome, production deployment, npm publication, or real remote
mutation is claimed by this local completion record. CI is configured to run
the expanded CLI suites on both supported operating systems and Node versions.

## Recovery and remaining limitations

Resolve the reported filesystem failure, then retry the same pack. If a process
was killed mid-write, inspect and remove its reported `*.grill-tmp` before
retrying. If the server payload has changed and conflicts with partially updated
files, inspect/back up the files before choosing `--force` or restoring the
previous local contents. A malformed receipt must be inspected or moved aside;
`--force` does not make it trustworthy.

This provides atomic replacement per file, not a multi-file transaction,
automatic rollback, or a power-loss durability guarantee. Preflight checks do
not protect against a concurrent local process swapping paths. Receipts are
local ownership records, not signed attestations against a malicious local actor.

Ignore rules cannot untrack a receipt already committed to Git, and a nested
ignore file can override the new rules. The README documents checking and
untracking old receipts. The broader P1-03 role-layout issue remains open:
shared payload files such as `grill/MY-ROLE.md` can still be changed by a teammate's
commit. This feature does not claim to complete that migration.

Network response ceilings/deadlines and release publication remain separate
features. No runtime package dependency was added.
