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

```bash
npm install
npm run dev        # in-memory store; no credentials needed
npm test           # vitest
npm run typecheck
```

Against a dev server, point the CLI at it:

```bash
node cli/grill.mjs publish examples/grill-room.json --base http://localhost:3000
```

Production: set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`, apply
`supabase/migrations/0001_rooms.sql`, deploy to Vercel. Rooms expire after 30
days. If you deploy your own copy, the commands the app prints carry
`--base` automatically.
