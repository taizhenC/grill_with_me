# grill-with-me CLI

Install host skills, publish a project room, and install each member's role pack.
Interviews and contract checks run in your own AI editor. The CLI has no runtime
dependencies and supports Node 22.15+ within Node 22, or Node 24.

This source package is being prepared for its first public beta. Registry
publication remains pending. The default hosted service is live at
[grill-with-me.vercel.app](https://grill-with-me.vercel.app). Until a release is
published, install a locally packed archive or use the source CLI. The root
[README](https://github.com/taizhenC/grill_with_me#readme) explains setup against
the hosted service; the local-service example below is optional. The application
repository is
[taizhenC/grill_with_me](https://github.com/taizhenC/grill_with_me).

From the repository:

```sh
npm pack ./cli
```

Install the resulting archive in a separate checkout. Start the service using
the repository's local development instructions, then run:

```sh
npx --no grill-with-me host --base http://localhost:3000
# Ask your agent to run grill-host; it writes grill-room.json.
npx --no grill-with-me publish grill-room.json --base http://localhost:3000
```

Send the resulting room URL to your teammates. From a member's checkout:

```sh
npx --no grill-with-me join <room-url> --role <role-slug> --name <display-name>
# Ask your agent to read .grill-with-me/MY-ROLE.md and follow it.
npx --no grill-with-me check-spec
```

Commit each role spec. The host runs the merge-contract skill once the expected
specs are present. Members can then run check-contract or amend-contract.

The contract skills stage `grill/CONTRACT.next.md`, optional
`grill/contract.next.ts`, and `grill/CONTRACT-PROPOSAL.json`, then run
`contract-finalize`. Commit the current prose/types, both append-only histories,
and `CONTRACT-STATE.json` together. `contract-status` reports local contract
freshness separately from room pack versions, including offline uncertainty
and pending role agreements. Re-merges must preserve or explicitly reconcile
recorded amendments; existing unrecorded contracts require explicit adoption.

`contract-typecheck [tsconfig]` checks actual imports using project-installed
TypeScript and runs the consuming project's declared typecheck or installed
`tsc --noEmit -p`. Unused imports are unintegrated; missing tools or solution
configs are unknown. It never downloads a compiler. File finalization can
resume an identical interrupted proposal after an I/O error; altered outputs
stop for reconciliation. See the repository's
[contract revision guide](https://github.com/taizhenC/grill_with_me/blob/main/doc/contract-revisions.md)
for exact proposals, legacy adoption, and recovery.

```sh
npx --no grill-with-me status <room-url>
npx --no grill-with-me republish grill-room.json
npx --no grill-with-me delete <room-url>
```

Saved host credentials apply only to their original origin and room. Publishing
and republishing require HTTPS, except for loopback development. Publication creates
Git ignore protection before saving `.grill-with-me.json`; already tracked
credential files are rejected. Keep host tokens private. An explicit `--token`
or `GRILL_WITH_ME_TOKEN` applies to the destination you request for that call.

Before the first publication request, the CLI saves the origin, original JSON
and a private recovery capability in `.grill-with-me-publish.json` (ignored,
written with owner-only file mode where supported). Keep this file private like
the host token. A lost response can be recovered from a new terminal process:

```sh
npx --no grill-with-me publish --recover
```

Recovery resends the saved original body and destination, even if the source file
was edited. It returns the same room/token for up to 24 hours after issuance;
removed or expired rooms cannot be recreated by retry. A normal repeated `publish`
requires the exact same body and origin. Changed input/destination or expired
attempts stop without silently minting another capability. Existing acknowledged
attempts are retained too, preventing accidental duplicate publication.

After checking the original outcome, use `publish <file> --new-publication` to
explicitly replace the saved attempt and create a different room. This abandons
the previous local recovery capability and does not delete the previous room.
Use `republish` to update an existing room. `publish --dry-run` sends nothing and
writes no ignore, recovery or credential file. `--force` cannot bypass protection.

Recovery requires the server's publication-recovery migration/protocol; older
servers cannot acknowledge it. Git is required to verify host credential/recovery
storage, including untracked/ignored temporary files. A killed local write can
leave `.grill-with-me-publish.json.tmp`: inspect and remove that temporary file
before retrying. Do not print or commit its contents. This protects ordinary
process failures; it is not a lock against malicious concurrent filesystem edits
or a guarantee against disk/power failure.

`delete` requires an explicit room key/URL (or `--key`) and its host token. It
removes the shared database row before or after expiry, preserving local packs,
specs and saved credentials. Saved tokens cannot authorize another origin/room;
redirects and automatic retries are refused. Prefer `GRILL_WITH_ME_TOKEN` over
secret command arguments. After a lost response, reconcile server state; expired
reads also return 404 and cannot alone prove physical deletion.

`join` and `host` validate downloaded paths and inspect all installation targets.
They reject links, junctions, hardlinks, and unexpected pack files. Use `--dry-run`
to inspect an installation; `--force` never bypasses path safety. Keep your
checkout idle while installing. Consult the repository's current completion
reports for the exact release state and remaining recovery limitations.

Re-running `join` or `host` refreshes files that still match their local content
receipts. Edited or deleted files require inspection and explicit `--force`;
personal text outside the owned AGENTS fence is preserved. The member receipt
is `.grill-with-me/member.json`, bound to the origin and room, and a saved role
is reused only there. Local instructions live in `.grill-with-me/MY-ROLE.md`.
Shared AGENTS/command files are role-neutral. Legacy receipts require choosing
an explicit role once; old tracked `grill/.room` and `grill/MY-ROLE.md` stay
unchanged and inactive so edited notes can be reconciled before retirement.

Each file is replaced atomically and the completed receipt is written last.
After a filesystem failure, retry the same payload; conflicting changed payloads
stop for inspection. A killed process can leave `*.grill-tmp`: inspect and remove
that temporary file before retrying. The whole `.grill-with-me/` directory is
excluded from Git, preventing nested ignore negations from exposing selectors.
The CLI rejects tracked local state and never changes the Git index. Plain
folders need no Git executable; Git checkouts require it for verification.
Member hashes tolerate CRLF/LF conversion in shared files. Specs, project context,
contracts, and role-neutral adapters remain shared in Git.

Custom services retain `--base` in printed publish, republish, and join commands,
including when selected through `GRILL_WITH_ME_URL`.

After a verified beta is published, `npx grill-with-me@beta ...` selects that beta
tag. The stable onboarding command is enabled only after the release gates pass.

Report problems through the
[issue tracker](https://github.com/taizhenC/grill_with_me/issues).
