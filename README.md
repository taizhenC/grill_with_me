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
not saved. Publishing and republishing require an HTTPS origin; HTTP is allowed for
`localhost`, IPv4 loopback, and `::1` development servers. Redirects are refused.

Browser hosts must retain the displayed token. The result and host pages print a
republish command with that room's `--key`, a `YOUR_HOST_TOKEN` placeholder, and
the current service origin. Replace the placeholder; explicit tokens apply only
to that invocation. Publishing again creates a new room. An interrupted response
can leave publication uncertain; the app does not claim that no room was created.

Keep the current `grill-room.json` with the host's checkout and share it in Git.
When every role's spec is committed, run `npx grill-with-me merge-preflight`.
It checks the project context, expected roles, and every role spec, and names
missing or malformed inputs. It reads files without changing the prior contract.
Then tell your agent: *run the merge-contract skill*; it must pass the same gate
before writing. A fresh host uses this local room file and needs no member pack.
`grill/CONTRACT.md` lands in the repo. Commit it.

Contract skills stage prose/types and finalize one hash-linked revision with
append-only history. Commit current prose, optional generated types, both
histories, and state together. `contract-status` distinguishes fresh, stale,
and offline unknown sources independently of room pack versions, while pending
role agreement remains visible. Re-merges must explicitly preserve or reconcile
amendments. TypeScript projects run `contract-typecheck` against real importing
producer/caller code and their installed project compiler; unused generated
types are unintegrated. See [the revision and recovery guide](doc/contract-revisions.md)
and [the producer/consumer example](examples/type-integration/).

## Each member — ten minutes

```bash
npx grill-with-me join <room-key>     # or paste the whole link
```

Run it from your repo root. Then run `/grill-my-role` in your editor — or tell
your agent: *read `.grill-with-me/MY-ROLE.md` and follow it*. Answer the questions;
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

`check-spec` and `merge-preflight` share one validator. It requires the five
exact ordered H2 sections outside code fences and HTML comments; duplicates,
suffixed headings, and wholly empty specs fail. Partially thin specs warn and
pass, so the team can resolve undecided sections explicitly. One person can
cover two roles by retaining both `grill/<role>-spec.md` files.

Re-running `join` or `host` updates files whose contents still match the last
successful installation. Local edits and deletions stop the whole installation
before it writes anything; inspect or back up those files before choosing
`--force`. Personal text outside the owned `AGENTS.md` fence is preserved exactly.
Malformed or duplicate fences and invalid local UTF-8 stop installation even
with `--force`. Specs and contracts are never installation targets.

The member receipt, `.grill-with-me/member.json`, records the normalized server
origin, room, role, version, and installed content hashes. Its role instructions
live beside it in `.grill-with-me/MY-ROLE.md`. A saved role is reused only for that
same origin and room. Member hashes normalize CRLF/LF differences so ordinary Git
checkout conversion does not look like an edit. Host skills retain a separate
origin-bound receipt, `.grill-with-me-host.json`.

The CLI excludes the entire `/.grill-with-me/` directory in `.gitignore` and
checks that Git neither tracks it nor overrides that directory exclusion.
Nested ignore rules cannot reinclude files below an excluded parent directory.
Plain folders still work without Git; inside a Git checkout, the Git executable
is required to verify local state. `--force` cannot bypass tracked-local-state
rejection. Back up an accidentally tracked local directory, remove it from the
index, and rejoin with an explicit `--role` after inspecting its contents.

Migration requires choosing `--role` once. Old `grill/.room` and
`grill/MY-ROLE.md` are retained unchanged as inactive files, including tracked
files and edited notes. They never select the current member's role. Compare
old notes with the new local role instructions before retiring them from Git.
A valid old receipt can verify unchanged shared pack files during migration;
unverified differences still require inspection and explicit `--force`.
Commit the updated role-neutral AGENTS block, command adapter, and ignore rules
with shared project/spec/contract artifacts. Each teammate runs `join` locally.

`join` and `host` validate the complete downloaded file set before installation.
Only the standard pack paths are accepted, with at most 256 KiB of UTF-8 content
per file and 1 MiB total. They check all destinations before writing and reject
symlinks, junctions, hard-linked files, and incompatible directories inside the
checkout. `--force` cannot bypass these checks; `--dry-run` previews either
installation without writing or recording claims. Each file is replaced by a
same-directory atomic rename, and the completed receipt is written last.
After an I/O failure, resolve the reported filesystem problem and retry the
same pack: already updated files are recognized, and remaining old files can
finish. A changed payload that conflicts with a partial update stops for
inspection. A process killed mid-write can leave `*.grill-tmp`; inspect and
remove that temporary file before retrying. Keep the checkout idle: this is not
a multi-file transaction or protection against concurrent local path changes.

## During the build — anyone, repeatedly

The browser ZIP fallback stages `grill-with-me-pack/pack.json` and `IMPORT.md`.
Extraction does not install files in your checkout. Use the join command for
validated installation, or have your local agent prepare a reviewed import using
the instructions; preserve existing instruction fences and edited files. The
manual path is not the CLI's deterministic installer and requires review.

- **`check-contract`** — compares the repo against the contract and reports
  drift by role, with a `file:line` for every finding.
- **`amend-contract`** — for when the *contract* is what's wrong. Amendments
  land in `grill/CONTRACT-CHANGES.md` and override the original.

Both ship in every member's pack. See `examples/` for a real `grill-room.json`,
the contract it leads to, and a check report.

## What lands in your repo

```
AGENTS.md                                  # a fenced block; your own content is kept
.grill-with-me/                            # ignored; never commit
  MY-ROLE.md                               # this checkout's role and interview
  member.json                              # local origin/room/role/version + hashes
grill/
  PROJECT.md                               # shared: the brief from the host grill
.claude/
  commands/grill-my-role.md                # shared adapter; reads local role instructions
  skills/check-contract/SKILL.md
  skills/amend-contract/SKILL.md
```

## CLI

| Command | Who | Does |
|---|---|---|
| `join <key\|url>` | member | writes your role's pack into this repo |
| `check-spec [file]` | member | is the spec you just wrote well-formed? |
| `merge-preflight [room-file]` | host | validates project context, complete role roster, and specs before merge |
| `host` | host | installs `grill-host` + `merge-contract` here |
| `publish <file>` | host | publishes `grill-room.json`, prints the link |
| `republish [file]` | host | replaces the room content, bumps the version |
| `delete <key\|url>` | host | physically removes the shared room with its host token |
| `status [key\|url]` | anyone | who has claimed what |

Useful flags: `--role <slug>`, `--name <name>`, `--dry-run`, `--force`,
`--base <url>` (a different deployment), `--token <host-token>`.

## Repo layout

| Path | What |
|---|---|
| `skills/` | The product: `grill-host`, `merge-contract`, `check-contract`, `amend-contract` |
| `app/`, `lib/` | The pack-serving web app (Next.js; Supabase or in-memory store) |
| `cli/` | The zero-dependency `npx grill-with-me` CLI |
| `supabase/migrations/` | Rooms, request counters, atomic mutations and cleanup |
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
Room access expires 30 days after creation; physical removal requires a successful
configured purge. Hosts can run `node cli/grill.mjs delete <room-url>` before or
after expiry with that room's token. Local packs, specs and credentials remain.
See [privacy and retention](doc/privacy-and-retention.md) and
[the operations runbook](doc/operations-retention-runbook.md) for setup/recovery.
The daily `vercel.json` declaration needs an actual production deployment and
server-only `CRON_SECRET`; it is not proof of an active schedule.
If you deploy your own copy, the commands the app prints carry
`--base` automatically.

Set `GRILL_PUBLIC_ORIGIN=https://your-service.example` on a public deployment to
pin printed links and commands to its canonical origin. Otherwise they use the
validated request Host, infer HTTPS for public hosts, and allow HTTP only for
literal loopback development. Forwarded host/protocol headers are ignored unless
`GRILL_TRUST_PROXY=1`; enable that only when your ingress replaces all incoming
forwarded identity/origin headers. Malformed origins fail without echoing their
contents. Printed origins contain normalized DNS/IP names and ports, not shell
expressions, credentials, paths, or query fragments.

## Release checks

CI runs the full test suite, typecheck, and production build on Linux with
Node.js 24. It also runs the CLI tests and installs the actual npm tarball on
Windows and Linux with Node.js 22 and 24. These checks need no API keys or
deployment credentials. Dependency security updates are reviewed separately
from this functional baseline; the app job blocks moderate, high, and critical
findings with `npm audit --audit-level=moderate`. Review an advisory's impact and
update the lock; do not use broad forced upgrades to clear the check.

Chromium onboarding tests run the compiled application with explicit temporary
in-memory test storage. They exercise file input, paste, clipboard, keyboard role
claims/takeover, printed browser-host republishing through the actual CLI, staged
ZIP downloads, and interrupted/malformed/oversized responses. This fixture server
does not validate a hosted Supabase project or a deployed browser session.

```bash
npx --no-install playwright install --only-shell chromium
npm run build
npm run test:browser
```

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

Room APIs, skill downloads, and join/host pages share durable request budgets.
Limits use fixed, aligned one-hour windows:

| Operation | Per client IP | Global per deployment database |
|---|---:|---:|
| Create | 20 | 500 |
| Read / download / room page | 1,000 | 10,000 |
| Claim | 120 | 1,000 |
| Republish / delete (shared) | 60 | 500 |

Vercel supplies sanitized client-IP forwarding headers, so `VERCEL=1` enables
per-IP budgeting there. On other hosts, requests share one conservative
unknown-client bucket unless `GRILL_TRUST_PROXY=1` is explicitly enabled for
an ingress that **overwrites incoming `X-Forwarded-For`**. Arbitrary caller
forwarding headers are ignored. Only service-key-HMAC client identifiers are
stored in quota rows; raw IPs and room tokens are absent.
[Vercel request headers](https://vercel.com/docs/headers/request-headers#x-forwarded-for)

Exhausted budgets return HTTP 429 with `Retry-After`; unavailable quota storage
returns 503 instead of falling back to instance-local limits. Denied budgets
do not charge the other counter, and global exhaustion creates no new client
rows. This is a fixed-window limiter: a burst immediately before and after a
window boundary can consume both windows' budgets. Shared networks use one
IP budget. Counters older than their expired window plus one hour are removed
in batches of 128 on subsequent traffic for that operation. Configured maintenance
also removes idle stale client rows across operations.

Run `npm run test:runtime` after `npm run build` to verify the actual compiled
API and page proxy responses, including 429, cross-bundle backend 503, host
token 403, expired/missing room 404, and invalid production storage 503. These
checks use controlled HTTP RPC responses; `npm run test:db` separately proves
real PostgreSQL quota concurrency and persistence across an application restart.
Apply migration `0003_shared_request_quotas.sql` before deploying this version.
Host deletion and retention also require `0004_retention_and_room_deletion.sql`.
Database checks include physical deletion, concurrent bounded cleanup, rollback
and browser-role denial; compiled checks cover host DELETE and maintenance GET/POST.
