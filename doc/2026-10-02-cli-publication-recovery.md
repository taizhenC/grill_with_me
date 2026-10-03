# CLI publication recovery completion

Scope: P1-03 client recovery on top of the atomic publication backend delivered
in [PR #26](https://github.com/taizhenC/grill_with_me/pull/26). Browser recovery is
a separate feature. This change retains the CLI's zero runtime dependencies.

## Behavior

Before the first POST, `publish` safely persists the normalized origin, exact
original body, its SHA-256 hash and a cryptographically random immutable capability
in `.grill-with-me-publish.json`. The file and its temporary sibling share existing
credential safeguards: Git tracking rejection, ignore checks, filesystem link
preflight and exclusive temporary-file replacement with owner-only mode where
supported. Compare-before-rename prevents competing first publishers that read an
old/absent file from silently replacing each other's pending capability.

Normal retries require the same origin and raw body. `publish --recover` resends
the saved original request after process restart, even if the source file changed.
Changed destinations, expired windows and deleted rooms never automatically mint
another capability. `--new-publication` explicitly abandons the prior local attempt
and permits another room; it does not delete the old room. Acknowledged attempts
remain saved to prevent accidental duplicates. `--dry-run` writes and sends nothing.

Acknowledgements must have the generated strong room-key format, a 32-character
base64url host token, the exact recovery expiry and a boolean replay flag. A late
committed response can still be accepted just after expiry. Invalid responses and
credential-save failures retain recovery state. Server-echoed capabilities are
redacted. No capability or host token is printed or placed in a command/URL.

## Commits

- `cf2232c` — ignored recovery persistence, binding and replay, CLI options,
  packaged helpers, actual lost-response/process/filesystem regressions and docs.
- `f799794` — integrate the already merged backend/browser and fixture changes.
- `0651a71` — reject malformed publication credentials after independent review,
  preserve recovery on failure, and add default repository ignores.
- Completion commit — this validation record.
- Final integration commit — preserve all 18 packaged helpers while integrating
  contract revision commands from main `6091f0e`; repeat source/archive checks.

All feature commits use author and committer `taizhenC <tzhcheung@gmail.com>` and
contain no coauthor trailers.

## Executed validation

Local Windows, Node 22.15.0. No public service or registry was mutated.

- `npm ci --no-audit --no-fund` passed before implementation.
- Final integrated source suite: **528 passed, 8 skipped**, 29 test files.
- Final `npm run typecheck` and `git diff --check` passed.
- Next 16.3.8 production build passed on the integrated backend/browser baseline;
  the later CLI-only acknowledgement tightening was covered by the final tests
  and typecheck rather than another application build.
- Package verifier passed archive contents, installed version/help, spec checks
  and merge gate. New helper modules are explicitly included; private recovery
  files are excluded.
- Fresh `npm pack`, offline install into a consumer directory containing spaces,
  then `tests/cli`, spec-format and merge-preflight suites through
  `GRILL_CLI_TEST_BIN`: **247 passed, 8 skipped**, 9 test files. CLI subprocesses
  use the installed archive; pure format tests retain their source imports.
- After integrating the newer contract commands, another fresh installed archive
  passed **34 publication/contract/type-integration tests** across three files.
  The updated package smoke passed archive, version/help, spec/merge and contract
  revision gates, verifying that neither feature lost its helpers or commands.
- The 15 recovery cases exercise the actual API handler behind loopback HTTP:
  lost reply and new process, changed local body, same-request replay, explicit
  new room, different destination, expiry, deletion, post-commit local I/O failure,
  invalid acknowledgement, echoed-secret redaction, ignore/tracking checks,
  hardlink sentinel, malformed saved state, dry-run and competing publishers.
- The lost-response test failed before implementation because no recovery state
  existed before send. The malformed-token regression failed with false success
  before the acknowledgement fix.

One archive run performed concurrently with the source suite reported a generic
connection failure instead of `too large` in the unchanged HTTP oversized-response
fixture (246 passed, 1 failed, 8 skipped). The exact installed archive passed that
test alone and then the complete sequential suite above. The cause was not proven;
no assertion, timeout or network safeguard was weakened. Platform-specific skips
remain as previously configured.

Parent independent review found the acknowledgement gap described above; it was
fixed and retested. Hosted CI is pending at PR creation and is not claimed here.

## Limits

Migration 0005/server recovery support is required before using this client.
Recovery ends 24 hours after capability issuance and requires synchronized clocks.
Development memory storage cannot survive a service restart. A local process crash
can leave a temporary file that requires inspection before retry; this feature
does not promise power-loss durability or defeat malicious concurrent filesystem
changes. Windows file modes do not replace Windows ACL management. The local body
and capability remain private retained state until explicit replacement/removal;
ignores do not erase earlier copies or force-added history. Browser session behavior,
hosted deployment/grants, registry publication and agent compatibility are outside
this CLI completion claim.
