# grill-with-me CLI

Install host skills, publish a project room, and install each member's role pack.
Interviews and contract checks run in your own AI editor. The CLI has no runtime
dependencies and supports Node 22.15+ and Node 24.

This source package is being prepared for its first public beta. Registry
publication and the default hosted service are pending verification. Until a
release is published, install a locally packed archive and use your own running
service. The application repository is
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
# Ask your agent to read grill/MY-ROLE.md and follow it.
npx --no grill-with-me check-spec
```

Commit each role spec. The host runs the merge-contract skill once the expected
specs are present. Members can then run check-contract or amend-contract.

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
is bound to the origin and room, and a saved role is reused only there. Legacy
receipts need an explicit role and matching files or `--force` for adoption.

Each file is replaced atomically and the completed receipt is written last.
After a filesystem failure, retry the same payload; conflicting changed payloads
stop for inspection. A killed process can leave `*.grill-tmp`: inspect and remove
that temporary file before retrying. Local receipts are added to `.gitignore`,
but already tracked receipts need untracking and nested ignore rules can override
the new rules. Shared role payload layout remains a separate migration.

After a verified beta is published, `npx grill-with-me@beta ...` selects that beta
tag. The stable onboarding command is enabled only after the release gates pass.

Report problems through the
[issue tracker](https://github.com/taizhenC/grill_with_me/issues).
