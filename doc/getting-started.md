# Getting started and technical guide

For the product overview, read the [README](../README.md).
This guide covers installation, the host/member workflow and service development.

Grill With Me helps a team agree on what each person is building before their
code has to work together. Each teammate uses their own AI agent to answer
questions about their role. The team turns those answers into a shared contract,
then checks the implementation against it.

For example, if the frontend expects `user.name` while the backend returns
`first_name`, the contract makes the expected response and its owner explicit.
A later check reports the mismatch with evidence from the code.

**[Open the hosted app](https://grill-with-me.vercel.app)** to publish a project
brief or open a room link. The service is live on Vercel with Supabase storage.
The CLI's `0.3.0-beta.1` package is prepared but **not published to npm**; use the
local archive instructions below. See the
[deployment report](2026-10-02-cloud-deployment.md) and
[release runbook](beta-release-runbook.md) for verification and remaining
beta release gates.

## How it works

| Step | What the team does | What it produces |
|---|---|---|
| 1. Define the project | The host's agent interviews the host about the goal, scope, stack and roles. | `grill-room.json`: a project brief and role roster |
| 2. Share a room | The host publishes the brief; teammates open the link and select a role. | Role-specific instructions and reusable agent skills |
| 3. Agree on each layer | Each member's agent interviews them about ownership, interfaces and dependencies. Members commit their specs. | `grill/<role>-spec.md` |
| 4. Make a shared contract | The host's agent reads every role spec and surfaces disagreements for the team to resolve. | `grill/CONTRACT.md`, revision history and optional TypeScript types |
| 5. Build and review | Members check real code against the contract and record agreed changes. | `grill/CHECK-REPORT.md` and recorded contract amendments |

A **room** distributes the published project context and role packs. A **pack**
is a set of local Markdown instructions, skills and project context. A
**contract** records concrete agreements such as endpoint paths, request/response
shapes, data models and who owns each boundary.

The web app stores room data and serves packs. The CLI installs files, validates
spec structure and records contract revisions. Interviews, merging role specs
and reviewing code happen in your own AI agent. The contract merge combines
agreements from the specs; Git remains how teammates share those files.

## Get started

You need Git, Node.js 22.15+ within Node 22 or Node 24, and an AI coding agent
that can read files in your checkout. This application requires no user account
or model API key; your agent uses its own configured provider.

### Install the CLI from this repository

Until npm publication, create and install the local archive:

```sh
git clone https://github.com/taizhenC/grill_with_me.git
cd grill_with_me
npm pack ./cli
npm install --global ./grill-with-me-0.3.0-beta.1.tgz
grill-with-me --version
```

Then change into **your team's project checkout**. Keep this tool's source
checkout separate from the project you are interviewing.

You can also run the CLI directly, without installing it, by replacing
`grill-with-me` in the examples with
`node "/absolute/path/to/grill_with_me/cli/grill.mjs"`. Quote paths with spaces.
The CLI has no runtime package dependencies; running the hosted workflow does
not require installing or starting the Next.js application.

The app and skills currently print `npx grill-with-me ...` commands intended
for registry onboarding. Until publication, use the installed `grill-with-me`
command above, or the source CLI, for those same arguments.

### Host: define and publish the project

From your team's repo root:

```sh
grill-with-me host
```

Ask your agent: **"Read .claude/skills/grill-host/SKILL.md and follow it."**
It interviews you about the product, proposes roles and writes
`grill-room.json`. Review that file, then publish it:

```sh
grill-with-me publish grill-room.json
```

Share the room link with your teammates. The CLI saves the host token locally
and protects its files with Git ignore rules. Keep the token private: it
authorizes updates and deletion.

You can also upload or paste `grill-room.json` in the
[hosted app](https://grill-with-me.vercel.app). If you publish in the browser,
retain the displayed host token. Commit the reviewed `grill-room.json` so the
host's checkout has the role roster needed for the contract merge.

### Member: choose a role and write a spec

From your own checkout of the team's project, use the full link the host sent:

```sh
grill-with-me join <room-url> --role frontend --name "Alex"
```

Replace `frontend` with a role slug from your room. Omit `--role` or `--name`
to use the interactive prompts.

Ask your agent: **"Read .grill-with-me/MY-ROLE.md and follow it."** In editors
supporting the installed command adapter, you can use `/grill-my-role`.
Answer the role-specific questions and review the generated spec:

```sh
grill-with-me check-spec grill/frontend-spec.md
```

Commit your spec and the shared project/agent files. Every teammate runs
`join` locally; personal role selection and receipts stay ignored. Pull the
other members' committed specs before the host merges them.

The browser's ZIP download contains staging `pack.json` and `IMPORT.md`.
Extracting it does not install a pack in your checkout. Use the CLI for
validated installation, or ask your local agent to prepare a reviewed import
following `IMPORT.md`.

`check-spec` checks the document's structure. It does not establish that
teammates agree or that the implementation is correct. Unresolved questions
should remain visible in the spec.

### Host: turn the specs into a contract

Once every expected role spec is present in the host's checkout:

```sh
grill-with-me merge-preflight grill-room.json
```

Ask your agent: **"Read .claude/skills/merge-contract/SKILL.md and follow it."**
It reads the specs, surfaces contradictions and stages the shared contract.
The skill uses `contract-finalize` to record one revision and its history.

Commit these finalized files together, then ask the team to pull them:

- `grill/CONTRACT.md`
- `grill/contract.ts`, when generated for a TypeScript project
- `grill/CONTRACT-CHANGES.md`
- `grill/CONTRACT-HISTORY.jsonl`
- `grill/CONTRACT-STATE.json`

Human agreement, spec freshness and file integrity are separate checks.
`grill-with-me contract-status` reports the current revision and pending role
agreements. See [contract revisions](contract-revisions.md) for details.

### During the build: check and amend agreements

Member packs install two more skills:

- Ask your agent to read `.claude/skills/check-contract/SKILL.md` to compare
  real code with the contract. It writes `grill/CHECK-REPORT.md`, with
  findings attributed to roles and evidence from files and lines.
- Ask it to read `.claude/skills/amend-contract/SKILL.md` when the agreement
  needs to change. It updates the current contract through a recorded revision
  and keeps pending approval visible.

These are **AI skills**, not CLI subcommands. Review their output with the team.
For TypeScript projects, import the generated types into real producer/caller
code, then run:

```sh
grill-with-me contract-typecheck tsconfig.json
```

This uses your project's installed TypeScript compiler and typecheck command.
Unused generated types do not count as integration. The
[type integration example](../examples/type-integration/) shows a producer and caller.

## Files in your project

```text
grill-room.json                  Shared project brief and role roster
AGENTS.md                        Shared instructions in a preserved fenced block
.claude/skills/                  Installed host or member skills
.claude/commands/grill-my-role.md Member command adapter
grill/
  PROJECT.md                     Shared project context from the room
  frontend-spec.md               Example member spec; one file per role
  CONTRACT.md                    Current finalized agreement
  contract.ts                    Optional shared TypeScript types
  CONTRACT-CHANGES.md             Human-readable amendment history
  CONTRACT-HISTORY.jsonl          Append-only revision records
  CONTRACT-STATE.json             Current revision and integrity metadata
  CHECK-REPORT.md                 Agent's implementation review
.grill-with-me/                  Ignored local role instructions and receipt
.grill-with-me.json              Ignored host credentials
.grill-with-me-host.json         Ignored host skill receipt
.grill-with-me-publish.json      Ignored publication recovery state
```

Re-running `join` or `host` refreshes unchanged installed files. Local edits
or deletions stop installation for inspection; `--dry-run` previews changes.
Use `--force` only after reviewing the affected files. It cannot bypass
unsafe paths or tracked private state. Specs and contracts are not overwritten
by pack installation. See the [CLI guide](../cli/README.md) for recovery and migration.

## Room commands and privacy

| Command | Purpose |
|---|---|
| `status <room-url>` | Show informational role claims |
| `republish grill-room.json` | Update an existing room using its host token |
| `publish --recover` | Retry the saved original publication after a lost response |
| `publish grill-room.json --new-publication` | Explicitly create another room |
| `delete <room-url>` | Remove the shared room using its host token |

A repeated saved publication can recover the same room for up to 24 hours;
use `republish` to change that room's content. Republishing increments its
pack version, which is separate from the local contract revision. Members
re-run `join` to refresh their packs.

Publishing uploads the project brief and role definitions. Submitted display
names are stored as informational claims. The service has no upload endpoint
for source code, role specs, contracts or AI conversations; agent work runs
through your own editor/provider.

Anyone with a room link can read the brief, download packs and submit claims.
Room claims are not authenticated accounts. Room access expires 30 days after
creation; republishing does not extend it. Configured maintenance removes
expired server data, while deletion preserves local checkouts and downloaded
files. Read [privacy and retention](privacy-and-retention.md) for the exact
stored data, access and deletion behavior.

## Develop or host your own service

Use **Node.js 24** for the web application. From this repository:

```sh
npm ci
```

Copy `.env.example` to `.env.local` (`cp .env.example .env.local` in a POSIX
shell, or `Copy-Item .env.example .env.local` in PowerShell), then run:

```sh
npm run dev
```

The example environment explicitly selects in-memory development storage.
Open `http://localhost:3000`. Point the CLI at that service:

```sh
node cli/grill.mjs host --base http://localhost:3000
node cli/grill.mjs publish examples/grill-room.json --base http://localhost:3000
```

For production, configure `GRILL_STORE=supabase`, server-only `SUPABASE_URL`
and `SUPABASE_SERVICE_KEY`, a canonical `GRILL_PUBLIC_ORIGIN`, and
`CRON_SECRET` for maintenance. Apply **all** migrations in
`supabase/migrations/` in filename order, including
`0006_explicit_room_privileges.sql`. Production rejects memory storage and
returns 503 when required storage configuration is missing.

Follow the [release runbook](beta-release-runbook.md) and
[operations runbook](operations-retention-runbook.md) to verify database
permissions, deployment, cleanup and recovery. Use `--base <your-service-url>`
for another deployment.

## Verification and repository map

```sh
npm test
npm run typecheck
npm run build
npm run test:runtime
node scripts/verify-skill-traces.mjs
node scripts/verify-cli-package.mjs
```

CI also runs Chromium onboarding and all four PostgreSQL suites, plus CLI
checks on Windows and Linux with Node 22 and 24. Browser checks require the
matching Playwright Chromium installation. Database checks require an empty,
disposable PostgreSQL database; see the release runbook before running
`npm run test:db`. Agent evaluations and team pilots are separate release gates.

| Path | Contents |
|---|---|
| `skills/` | The four reusable AI workflows |
| `app/`, `lib/` | Next.js web app, pack rendering and room storage |
| `cli/` | CLI and installation/revision helpers |
| `supabase/migrations/` | Durable rooms, atomic mutations, quotas and retention |
| `tests/`, `scripts/`, `evals/` | Automated checks and agent evaluation tooling |
| `examples/` | Sample room, contract, report and TypeScript integration |
| `doc/` | Guides and dated completion reports |

See [the original design](../plan.md) and
[the upgrade plan](../upgrade-plan.md) for project decisions and priorities.
Report problems through the
[issue tracker](https://github.com/taizhenC/grill_with_me/issues).
