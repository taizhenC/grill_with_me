# Member-local role state and CLI origin guidance — 2026-10-02

Completed locally as a focused P1-03 feature. This PR covers local role selection,
migration, shared adapters, and CLI commands that retain a custom origin. It
does not complete browser ZIP import, publish idempotency, or agent portability.

## Artifact ownership

| Artifact | Ownership and purpose |
| --- | --- |
| `.grill-with-me/member.json` | Local receipt: origin, room, role, pack version, and installed hashes |
| `.grill-with-me/MY-ROLE.md` | Local role scope and interview instructions |
| `grill/PROJECT.md` | Shared project context from the pack |
| `grill-room.json` | Host-authored project and role roster for shared merge preflight |
| `grill/*-spec.md`, contracts, amendments, and contract types | Shared team agreements; never pack install targets |
| AGENTS owned block, slash-command adapter, and installed skills | Shared instructions; no selected member role embedded in the adapter |
| Old `grill/.room` and `grill/MY-ROLE.md` | Preserved inactive migration inputs/notes; never current role selectors |

Each checkout selects a role with `join --role` and keeps it in the local
directory. The v2 receipt is bound to normalized origin plus room. Member hashes
normalize CRLF/LF differences, allowing ordinary Git checkout conversion of
shared files without treating it as a content edit. Other edits retain the
existing hash-based refusal and explicit-force behavior.

## Migration and Git checks

Migration requires one explicit role choice. Valid old hashes may verify
unchanged shared content; old role notes, including user edits, remain untouched.
The CLI reports that the old files are inactive. Existing modern local state
takes precedence even if a later pull changes or corrupts those old files.

The entire `/.grill-with-me/` directory is excluded at the end of the root ignore
rules and checked before local writes. The CLI rejects any tracked entry inside
that directory, including with `--force`, and ignores `GIT_*` overrides while
checking the actual checkout. It never edits the index. Excluding a parent
directory prevents nested negation rules from reincluding its children; ignore
rules alone do not affect already tracked files. These are the relevant
[Git ignore semantics](https://git-scm.com/docs/gitignore).

Plain folders still work without Git. An existing Git checkout requires the Git
executable so index state can be verified. A force-added local directory requires
backup, explicit untracking, inspection, and explicit role selection by the user.

The main regression creates a bare remote and two real clones from tracked
legacy selectors, with nested ignore negations. Members select opposite roles,
exchange committed specs and a contract in both directions, and also commit
changes to the old selectors. Neither local receipt or role switches. The test
also verifies that ordinary `git add -A` does not stage local role files.

## Printed commands

Host-to-publish, publish-to-republish, and published/re-published join guidance
retain custom `--base` values. Choosing the service through `GRILL_WITH_ME_URL`
does not hide the origin from commands copied to another environment. Only the
canonical public origin omits the otherwise necessary flag.

## Commits

1. `b1a8d0b` — **Keep member roles local across Git updates**: local directory,
   receipt migration, Git protection, role-neutral rendering, canonical selector
   references, custom-origin guidance, regression tests, and scoped test bounds.
2. **Document member-local migration and archive verification**: README/package
   instructions, exclusion of local member state from archives, and this record.

Both use `taizhenC <tzhcheung@gmail.com>` as author and committer with detailed
messages and no co-author trailer.

## Validation

Windows, Node **v22.15.0**, beta package **0.3.0-beta.1**:

- `npm ci --no-audit --no-fund` passed.
- `npm run typecheck` passed.
- `npm test`: **419 passed, 8 skipped**, 22 files. The skips are Unix-specific
  cases on Windows.
- `npm run build` passed; `verify-skill-traces.mjs` confirmed all four skills in
  both production pack-serving routes.
- `verify-cli-package.mjs` passed archive inclusion/exclusion, installed command,
  version, help, spec checks, and merge preflight.
- A fresh tarball installed offline in a consumer path containing spaces.
  Running `tests/cli`, spec-format, and merge-preflight with
  `GRILL_CLI_TEST_BIN` pointing to that package passed **227 tests, 8 skipped**;
  CLI subprocess tests, including the two-clone workflow, used the installed
  package.
- Independent implementation review found no blocker in receipt migration,
  index checks, ignore precedence, or the retained path-safety boundary.
- `git diff --check` passed.

The initial Git-migration and custom-origin regressions failed against the prior
implementation before the fixes. No hosted pass, deployment, npm publication,
or successful live session in Claude Code, Cursor, or another agent is claimed.

## Windows CI timeout evidence

[Main run 37080182570](https://github.com/taizhenC/grill_with_me/actions/runs/37080182570)
failed only the Windows/Node 22 refresh case for a late temporary-file collision:
it exceeded the default 5,000 ms test timeout at 5,009 ms. That case performs an
initial real CLI installation with synced file writes, then another CLI attempt.
No assertion failure identified a product behavior regression; neighboring I/O
cases passed in 712–2,003 ms. The log cannot identify the precise scheduling or
filesystem stall that consumed the budget.

The two refresh suites now have a finite **20-second per-test** allowance and
their child processes have **10-second** limits. The new Git integration suite
also uses finite subprocess bounds and a specific 30-second allowance for its
two-clone workflow. No global timeout, retry policy, HTTP limit, or production
network deadline was relaxed. Current local full/installed selections pass;
hosted verification of this candidate remains separate evidence.

## Remaining boundaries

This is an explicit layout change in the unpublished beta: release the app and
CLI together. Older CLI/server manifest combinations are not claimed compatible.
Browser ZIP staging/import and publish idempotency remain separate work.

Git and filesystem checks are preflight guards, not repository locks. A user who
force-adds local state after installation or concurrently changes paths can
invalidate the storage assumptions; the next CLI operation refuses tracked
state. Retiring old tracked selectors from history is a team migration choice,
not an automatic destructive action. Agent/version compatibility still requires
executed live-agent tests; this feature proves CLI, filesystem, and Git behavior.
