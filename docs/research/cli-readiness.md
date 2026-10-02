# CLI readiness findings

Investigated 2026-09-19 (America/New_York), checkout `1e7bbca`. Goal: a reliable public beta. No application code was changed. Reproductions used the real CLI against a loopback HTTP stub and disposable directories; no external room was created or modified.

## P0: constrain downloaded packs and protect local files

`cli/grill.mjs:191` checks lexical containment with `resolve`/`relative`, but `writeInto` at line 208 follows filesystem links. Reproduction: create a temporary repo whose `grill/` is a Windows junction to a sibling temporary directory; serve the ordinary `grill/PROJECT.md` pack path; run `join --role backend --no-claim`. The CLI succeeds and writes the file outside its working directory.

The CLI also trusts arbitrary `files` from the chosen server (`cli/grill.mjs:364`). Reproduction: give the temporary repo a matching `.room` stamp and an existing `grill/CONTRACT.md`; serve that filename in the response. A re-join replaces the contract without `--force`. The canonical renderer does not currently send this path: this is a client trust-boundary failure for a malicious or compromised deployment, not evidence that a normal room upload can choose arbitrary filenames.

Upgrade:

- Validate the complete response before writing: protocol/version, file count, byte limits, string contents, exact permitted paths, duplicate/case-equivalent paths, and required files.
- Reject unsafe path forms, linked ancestors/targets, Windows alternate data streams, and paths outside the canonical repo root. Validate containment again at the write boundary; lexical normalization alone is insufficient. `--force` must not bypass these checks.
- Never accept spec/contract, source-code, credential, Git-internal, or executable-hook destinations from a pack. Keep a narrow manifest of tool-owned paths.
- Bind the installed manifest to the normalized deployment origin as well as room identity. Currently `sameRoom` compares only a short key (`cli/grill.mjs:308,336`), so unrelated deployments with the same key receive overwrite privileges.
- Track installed content hashes and preserve local modifications unless the user explicitly replaces them. Validate/preflight all writes, use atomic per-file replacement, and stamp successful completion last. Provide recoverable partial-failure behavior instead of claiming multi-file atomicity.

**Acceptance:** reproduce the junction case on Windows and symlink cases on Unix; every outside sentinel remains unchanged. Unexpected/duplicate paths fail before any write, even with `--force`. Re-joining an unchanged pack is idempotent; changed local instructions are preserved. Different origins cannot inherit one another's overwrite privileges.

Node documents that `realpath` resolves symbolic links and that `lstat` inspects the link itself; these are relevant primitives, not a complete race-free write algorithm. OWASP recommends early syntactic and semantic validation with allowlists. [Node filesystem API](https://nodejs.org/api/fs.html#fspromisesrealpathpath-options), [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html).

## P0: scope host credentials to their room and origin

`saveConfig` (`cli/grill.mjs:249`) writes the host token, then only updates `.gitignore` if it already exists. A real CLI publish against the local stub saved `.grill-with-me.json` without creating `.gitignore` in a fresh folder. This contradicts the README's unconditional gitignore promise.

`cmdRepublish` (`cli/grill.mjs:537`) independently picks the destination and saved token. Reproduction: save a config with `base: https://original.invalid` and a synthetic secret; run `republish --base <loopback-server>`. The new server receives the original saved bearer token. The destination override is explicit, but silent credential reuse across origins should not be its default effect.

Upgrade: bind saved credentials to `(normalized origin, room ID)`; reject saved-token reuse for mismatched destinations and require an explicitly supplied credential for that destination. Create ignore protection before saving a token; detect an already tracked config rather than assuming `.gitignore` untracks it. Use restrictive permissions where supported, avoid routine token printing, and define recovery after publish succeeds but local persistence fails. Do not assume POSIX modes provide equivalent Windows ACL protection.

**Acceptance:** new repos exclude the token from `git status`; already tracked configs produce an actionable error; cross-origin/room changes never send the old saved token. Token-bearing requests reject insecure remote transport; documented loopback development remains usable. Errors/logs do not disclose credentials.

## P1: complete the command contract and recovery paths

- `host --dry-run` is accepted by the global argument parser but writes files (`cli/grill.mjs:444`). Reproduced against the loopback stub. Either implement the flag per mutating command or reject it where unsupported; never silently ignore it.
- `request` consumes an unbounded response with no application deadline (`cli/grill.mjs:151`); the optional claim has no deadline either (`cli/grill.mjs:435`). Add bounded reads, cancellation, and clear HTTP/schema errors. Avoid automatic POST retries until idempotency is designed.
- `readIfExists` treats every filesystem error as absence (`cli/grill.mjs:200`); distinguish `ENOENT` from access/IO failures. Malformed `.room` should produce recovery guidance rather than a raw JSON error.
- Host install prints a publish command that drops a custom `--base` (`cli/grill.mjs:474`). Environment-selected defaults can also be omitted from commands copied to other machines (`joinLine`, line 43). Generate commands against a fixed canonical origin and consistently preserve noncanonical destinations.
- Browser host instructions omit `--key` and claim `republish --token` saves a token, but `cmdRepublish` neither infers the browser's room key nor persists credentials. Fix the actual browser-publish-to-CLI-republish path (`app/r/[key]/host/page.tsx:101`, `cli/grill.mjs:537`).
- The ZIP path says to unzip into the repo root (`app/r/[key]/role-list.tsx:165`) even though it includes a complete `AGENTS.md`. Archive extraction does not implement the CLI's fenced merge. Provide an explicit merge/import step or avoid claiming ZIP extraction preserves existing instructions.

**Acceptance:** test fresh and existing repos, custom origins, no TTY, failed network/body reads, malformed responses/stamps, permission failures, browser-originated rooms, and supported flags. Verify failed/dry-run commands leave files unchanged. Check generated commands in PowerShell and a POSIX shell.

## P1: make `check-spec` truthful

The real CLI accepted a fenced code block containing suffixed fake headings and exited 0 with “Well-formed. Commit it”. `validateSpec` uses prefix substring searches (`cli/grill.mjs:619`), not exact Markdown section recognition. This agrees with the independent [workflow audit](workflow-upgrades.md), which also tested empty and duplicate sections. Implement one versioned validation contract shared by the library, bundled CLI, skill instructions, and fixture tests.

## Validation baseline and limits

At this checkout: `npm test` passed 108/108 tests across seven files; `npm run typecheck` passed; `npm run build` passed on Node 22.15.0. These do not cover the adversarial CLI cases above. No live agent interview, authenticated deployment, or real Supabase concurrency test was run by this audit. Temporary reproduction output was kept outside the repository. Any implementation should add focused regression tests for these user-visible failures.
