# grill-with-me

Grill a whole team about their project — each member in their own CLI, with
their own AI — then hold everyone to the contract that comes out of it.

Teams building in parallel fail for one reason above all others: **nobody
wrote down the contract between them.** Frontend expects `user.name`, backend
returns `first_name`, and nobody finds out until integration at hour 20.
grill-with-me extracts that contract by interviewing each person about their
layer, merges it into one `CONTRACT.md` (plus importable `contract.ts` types
on TypeScript stacks), and checks the real code against it — with drift
attributed to a *role*, so you know who to go talk to.

**No API keys. No accounts.** Every model call runs on a team member's own
agent — Claude Code, Cursor, whatever they already use. The web app only
hands out packs; your specs and your contract never leave your repo.

## Host — ten minutes, once

The public beta is being prepared. On 2026-10-02, the default service and npm
package both returned 404. Until publication is verified, use the source CLI or
a locally packed archive with a running custom service; see
[the release runbook](doc/beta-release-runbook.md). The `npx` examples below
describe onboarding after publication. Package metadata currently selects the
`beta` tag and supports Node 22.15+ within Node 22, or Node 24.

```bash
npx grill-with-me host            # installs grill-host + merge-contract here
```

Then tell your agent: *run the grill-host skill*. It grills you about the
project, proposes roles, and writes `grill-room.json`.

```bash
npx grill-with-me publish grill-room.json
```

You get a room link to share, a host view to watch, and your host token saved
to `.grill-with-me.json` (and gitignored). Prefer a browser? Drop the file on
the web app instead — same result.

CLI publishing requires Git to verify that credential files are untracked. It
creates or updates `.gitignore` before publishing, including in a folder that
has not run `git init` yet. Credentials are saved by replacing an ignored
temporary file, with owner-only permissions on Unix. The token is not printed.
Tracked credential files and linked config/ignore paths cause an error before
publishing; remove exposed credentials from tracking and rotate them first.

Saved tokens work only for their original normalized origin and room. Changing
`--base` or `--key` requires an explicit `--token` or `GRILL_WITH_ME_TOKEN` for
that destination. Explicit republish tokens apply to that invocation and are
not saved. Host operations require an HTTPS origin; HTTP is allowed for
`localhost`, IPv4 loopback, and `::1` development servers. Redirects are refused.

When every spec is committed, tell your agent: *run the merge-contract skill*.
`grill/CONTRACT.md` lands in the repo. Commit it.

## Each member — ten minutes

```bash
npx grill-with-me join <room-key>     # or paste the whole link
```

Run it from your repo root. Then run `/grill-my-role` in your editor — or tell
your agent: *read `grill/MY-ROLE.md` and follow it*. Answer the questions;
commit the spec it writes. Nothing to install, no browser needed after the
link.

Room links are bearer access: anyone with the link can read the brief, download
packs, and record role claims. New room keys are `r_` followed by 32 lowercase
hexadecimal characters, generated from 128 random bits. Share the full link.
Existing word-word-number links remain valid until their original 30-day expiry;
republishing does not extend that expiry or strengthen an old key. To replace a
legacy link, publish a new room and share its new link. New rooms have no legacy
alias. Room pages and APIs send no-index, no-referrer, and private no-store headers.

Not sure the spec came out right? `npx grill-with-me check-spec` validates it
against the exact structure `merge-contract` parses — thirty seconds after the
grill, instead of hours later on your host's machine.

Re-running `join` is safe: it updates the pack in place, keeps your own
`AGENTS.md` content, and never touches your spec.

`join` and `host` validate the complete downloaded file set before installation.
Only the standard pack paths are accepted, with at most 256 KiB of UTF-8 content
per file and 1 MiB total. They check all destinations before writing and reject
symlinks, junctions, hard-linked files, and incompatible directories inside the
checkout. `--force` cannot bypass these checks; `--dry-run` previews either
installation without writing. Keep the checkout idle during installation:
preflight does not prevent another process from changing paths concurrently or
roll back an installation interrupted by an I/O failure.

## During the build — anyone, repeatedly

- **`check-contract`** — compares the repo against the contract and reports
  drift by role, with a `file:line` for every finding.
- **`amend-contract`** — for when the *contract* is what's wrong. Amendments
  land in `grill/CONTRACT-CHANGES.md` and override the original.

Both ship in every member's pack. See `examples/` for a real `grill-room.json`,
the contract it leads to, and a check report.

## What lands in your repo

```
AGENTS.md                                  # a fenced block; your own content is kept
grill/
  PROJECT.md                               # shared: the brief from the host grill
  MY-ROLE.md                               # yours: scope, and the grill itself
  .room                                    # room key, role, pack version
.claude/
  commands/grill-my-role.md                # so /grill-my-role just works
  skills/check-contract/SKILL.md
  skills/amend-contract/SKILL.md
```

## CLI

| Command | Who | Does |
|---|---|---|
| `join <key\|url>` | member | writes your role's pack into this repo |
| `check-spec [file]` | member | is the spec you just wrote well-formed? |
| `host` | host | installs `grill-host` + `merge-contract` here |
| `publish <file>` | host | publishes `grill-room.json`, prints the link |
| `republish [file]` | host | replaces the room content, bumps the version |
| `status [key\|url]` | anyone | who has claimed what |

Useful flags: `--role <slug>`, `--name <name>`, `--dry-run`, `--force`,
`--base <url>` (a different deployment), `--token <host-token>`.

## Repo layout

| Path | What |
|---|---|
| `skills/` | The product: `grill-host`, `merge-contract`, `check-contract`, `amend-contract` |
| `app/`, `lib/` | The pack-serving web app (Next.js; Supabase or in-memory store) |
| `cli/` | The zero-dependency `npx grill-with-me` CLI |
| `supabase/migrations/` | One table |
| `plan.md` | The full design, decision log, and delivery plan |

## Running the web app

Use Node.js 24 LTS with npm for development (`.node-version` records the
major version used by CI). Install the committed dependency versions:

```bash
npm ci
cp .env.example .env.local  # explicit in-memory development mode
npm run dev
npm test           # vitest
npm run typecheck
```

Against a dev server, point the CLI at it:

```bash
node cli/grill.mjs publish examples/grill-room.json --base http://localhost:3000
```

Production: use `GRILL_STORE=supabase` (the default), set `SUPABASE_URL` and
`SUPABASE_SERVICE_KEY`, apply every file in `supabase/migrations/` in order,
then deploy to Vercel. Missing or partial credentials reject room API requests
with HTTP 503 instead of creating temporary rooms. Builds need no secrets.
`GRILL_STORE=memory` is accepted only in development or tests; production
rejects it. Never expose the service key to a browser.
`SUPABASE_URL` requires HTTPS; HTTP is permitted only for loopback endpoints
in development or tests.
Rooms expire after 30 days. If you deploy your own copy, the commands the app prints carry
`--base` automatically.

## Release checks

CI runs the full test suite, typecheck, and production build on Linux with
Node.js 24. It also runs the CLI tests and installs the actual npm tarball on
Windows and Linux with Node.js 22 and 24. These checks need no API keys or
deployment credentials. Dependency security updates are reviewed separately
from this functional baseline.

Run the distribution checks locally after `npm ci`:

```bash
node scripts/verify-cli-package.mjs
npm run build
node scripts/verify-skill-traces.mjs
```

The package check uses a temporary installation, verifies the installed
command and package version, and tests valid and invalid spec input. The
trace check ensures both pack-serving routes include all four skill files
in the production bundle. Neither command publishes a package or deploys the
app.

Persistence checks run against a disposable PostgreSQL 17 database in CI.
Run them locally with `GRILL_TEST_DATABASE_URL` pointing to an **empty** admin
database named `grill_test` or `grill_test_*`, then `npm run test:db`. The
fixture applies the real migrations, creates Supabase-style test roles, and
checks contended claims, committed versions, expiry after lock waits, role
removal, authorization, RPC privileges, and RLS. It removes its table and
functions when finished; use a temporary database because the fixture roles
remain in the cluster. The `pg` driver is a development dependency only.

Claims for different roles survive concurrent updates; claims for the same
role retain the existing last-write-wins behavior. Concurrent authorized
republishes are serialized, each returns its actual committed version, and
the last committed content wins. Removing a role also removes its claim.
Apply migration `0002_atomic_room_mutations.sql` before deploying this server
version. Vanilla PostgreSQL checks do not replace a deployment smoke test
against the configured Supabase project's API and service credentials.
