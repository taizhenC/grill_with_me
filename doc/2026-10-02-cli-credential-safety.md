# CLI credential safety — completion record

Completed locally on 2026-10-02 as the credential-handling slice of P0-02. This feature is intended for one PR against `main`; merging is a separate action.

## Delivered behavior

- A saved host token is reused only for its original normalized origin and exact room key. An origin or room override cannot silently transmit that token elsewhere. Room URLs contribute their origin to republish requests.
- `--token` and `GRILL_WITH_ME_TOKEN` are explicit credentials for the requested destination. They apply to that invocation and are not persisted by republish.
- Credential operations accept HTTPS origins, plus HTTP for `localhost`, IPv4 loopback, and `::1` development. URL credentials, base paths/queries/fragments, and room path escapes are rejected. POST redirects are refused.
- Publish prepares `.gitignore` before contacting the server. Both `.grill-with-me.json` and its temporary file are ignored, including when the directory has not yet been initialized with Git. Existing ignore rules are preserved; Git verifies the effective rules inside a checkout.
- Tracked credential paths are rejected without changing the index or sending the saved token. Git state is checked against the current checkout rather than inherited `GIT_DIR` or index overrides.
- Config, temporary-file, and ignore destinations receive filesystem preflight checks. Links, junctions, hardlinks, and incompatible file types are rejected. Config reads distinguish absence from malformed data and other failures.
- A new config is created through an ignored temporary file with mode `0600` and atomically renamed over the previous config. Storage conflicts preserve the old config. A failure after the server response reports that room creation may have succeeded.
- Publish no longer prints the host token. Authenticated error responses redact a literal echoed token. The CLI remains free of runtime npm dependencies, and the helper is included in the published archive.

## Commits

1. `8b0fc6e` — `fix(cli): bind saved host tokens to their origin and room`. Adds origin/room binding, explicit overrides, transport validation, redirect refusal, error redaction, and subprocess regressions.
2. `fix(cli): protect host credential persistence before publishing`. Adds Git protection and filesystem checks, atomic config replacement, safe output/recovery messages, storage regressions, README guidance, and this completion record. This record is included in that commit, so it does not embed its own hash.

Both commits use `taizhenC <tzhcheung@gmail.com>` as author and committer and have no co-author trailers.

## Verification

These results were obtained locally on Windows. They do not claim hosted CI results.

| Check | Result |
|---|---|
| Clean `npm ci` | Passed; zero audit findings reported during installation |
| `npm test` | 182 passed, 7 platform-specific tests skipped, 189 total across 8 files |
| `npm run typecheck` | Passed |
| `git diff --check` | Passed |
| Actual npm archive installed offline into a consumer directory with spaces | Passed; installed CLI reported version 0.2.0 |
| Both CLI subprocess suites run against that installed executable | 97 passed, 7 platform-specific tests skipped, 104 total |
| `node scripts/verify-cli-package.mjs` | Passed archive/install, command, help, and valid/invalid spec checks |

The seven Windows skips are the four existing Unix file-symlink tests, two credential file-symlink tests, and one Unix permission-mode test. Real Windows junction/hardlink tests and an unwritable-ignore-file test ran successfully. The new credential suite covers distinct local server origins, different rooms, equivalent origin normalization, explicit flag/environment overrides, unsafe origins and room paths, redirects, error redaction, fresh Git/non-Git directories, ignore negations, tracked config rejection, linked destinations, malformed config, and a storage conflict injected between request and response.

Regression-first checks reproduced cross-origin token reuse and missing ignore protection before their fixes. The root agent independently reviewed destination selection, prepare-before-publish ordering, Git protection, storage replacement, redirect policy, and token output; no blocking finding was identified within this feature's scope.

## Limits and follow-up work

- Git must be installed to verify and persist host credentials. The CLI supports a folder outside Git by provisioning ignore rules for a future repository.
- Unix mode `0600` is requested for new credential files. Windows access still depends on the user's directory ACLs; this feature does not create Windows ACL rules or an OS keychain integration.
- Filesystem preflight does not defend against another local process replacing paths concurrently. There is no transaction spanning the remote publish and local save. A network/storage failure can leave an orphaned room, and an interrupted temporary file may require inspection before retrying. Ignore-rule updates intentionally remain in place even if publication fails.
- The CLI does not rewrite Git history, untrack files automatically, or rotate/revoke server tokens. Previously committed tokens require separate remediation.
- Explicit republish credentials remain per-invocation; browser onboarding persistence is a separate feature. HTTP response byte limits/deadlines, installed pack hashes, local-edit preservation, and general multi-file recovery remain outside this PR.
