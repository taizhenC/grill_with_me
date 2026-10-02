# grill-with-me: public-beta upgrade plan

Prepared **2026-09-19**, against commit `1e7bbca`. Target confirmed by the project owner: **a reliable public beta**. This is a proposed implementation plan; the investigation changed documentation only.

The existing architecture fits the product: local agents conduct interviews, Git carries specs and contracts, and a small web service distributes packs. The next release should make that loop safe, dependable, and demonstrably useful. The most urgent work is dependency patching, local file protection, room access, database correctness, and making public onboarding available.

## Implementation progress — 2026-10-02

The first batch is implemented in separate PRs against `main`, pending review and merge. September dependency targets below describe the research snapshot; the security implementation uses the newer October-verified patches.

| Plan item | Pull request | Implemented scope |
|---|---|---|
| Planning record | [#3](https://github.com/taizhenC/grill_with_me/pull/3) | Priorities, acceptance criteria, research, and this progress record |
| P1-04 baseline | [#4](https://github.com/taizhenC/grill_with_me/pull/4) | Node 24 app CI, Node 22/24 Windows/Linux CLI checks, actual npm archive installation, and production skill tracing |
| P0-01 | [#5](https://github.com/taizhenC/grill_with_me/pull/5) | Next 16.3.8, sharp 0.35.5, and Vitest/matching modules 4.1.11; unrelated dependencies retain their compatible locked versions |
| P0-02 first slice | [#6](https://github.com/taizhenC/grill_with_me/pull/6) | Complete pack manifest validation, UTF-8 content bounds, linked destination rejection, whole-install preflight, and host dry-run |

Pre-merge evidence: the [combined hosted CI run](https://github.com/taizhenC/grill_with_me/actions/runs/37076910493) passed all five jobs. Linux passed **151/151 tests**, typecheck, production build, and skill traces. CLI tests and installed-package checks passed with Node 22 and 24 on both Windows and Linux. Windows skips four Unix-specific file-symlink cases, all of which passed on Linux; its real junction/hardlink sentinel cases passed. A local real Next server smoke also passed host → publish → join → claim/status → republish → rejoin with pack v2. The final dependency branch's clean install and full audit passed, with zero reported vulnerabilities at verification time.

Merge the CI baseline first so subsequent work has visible checks. All implementation commits use `taizhenC <tzhcheung@gmail.com>` as author and committer, have detailed bodies, and contain no co-author trailer. Each code PR has two focused commits; no implementation PR has been merged by this task.

P0-02 remains partly open: origin/room-bound credentials, installed hashes/local-edit preservation, bounded HTTP reads/deadlines, and recoverable partial-write behavior follow in separate features. P1-04's real database/browser coverage and audit-policy gate also remain open. Room access/abuse controls, atomic production storage, deployment/publication, and live-agent/team validation have not yet been implemented.

## Baseline and evidence

- `npm test`: **108 tests passed**, seven files.
- `npm run typecheck`: passed.
- `npm run build`: passed on the current Windows machine, Node 22.15.0.
- Additional local probes reproduced writes through a junction outside the CLI's working directory, acceptance of unexpected pack destinations, unignored saved credentials in fresh folders, cross-origin saved-token reuse, and invalid specs reported as valid.
- Actual `SupabaseStore` code exercised with a query double reproduced lost different-role claims and false republish acknowledgements. Real Postgres integration remains to be tested.
- Read-only public checks found the advertised npm package unavailable (404) and the default site returning `DEPLOYMENT_NOT_FOUND`. Other deployments or private release arrangements were not established.
- The existing tests do not demonstrate live interview quality, a real Supabase deployment, published-package installation, or browser interaction correctness.

Detailed evidence and official sources: [dependencies and release](docs/research/dependency-upgrades.md), [CLI safety](docs/research/cli-readiness.md), [service readiness](docs/research/service-readiness.md), [contract workflow](docs/research/workflow-upgrades.md). These notes distinguish reproduced failures, code observations, and unverified deployment conditions.

## Ranked backlog

These priorities supersede the *upgrade ordering* in the historical `plan.md`; its original “P0 = before writing code” definition no longer fits this built project. The ranking below is authoritative where the research notes use different local priorities.

**P0:** security, data integrity, or installation blockers; complete before public exposure. **P1:** complete and verify the core workflow before calling the beta reliable. **P2:** improve after pilot evidence. **P3:** defer until demand justifies it. The public-beta release gate includes all P0 and P1 acceptance criteria; these are ordering and risk categories, not permission to skip P1.

Effort is a planning estimate for one developer familiar with this repository, including focused regression tests: **S = half to one day; M = one to three days; L = three to five days**. Items overlap; these are not commitments.

| Rank | ID | Necessary upgrade | Reason for priority | Effort |
|---:|---|---|---|---|
| 1 | **P0-01** | Patch Next and the resolved production dependency tree | Locked versions have published critical/high advisories | S |
| 2 | **P0-02** | Make CLI installation and credential handling safe | Reproduced external writes, contract overwrite, and credential-boundary failures | L |
| 3 | **P0-03** | Strengthen room links and enforce shared abuse limits | Only 144,000 keys; public reads; process-local quotas and incomplete byte limits | M–L |
| 4 | **P0-04** | Require durable storage and atomic mutations | Silent memory fallback, lost claims, false successful republishes | M |
| 5 | **P0-05** | Deliver a working package and deployment | The documented default onboarding currently cannot work | M |
| 6 | **P1-01** | Make spec and merge validation deterministic | Invalid specs receive a success message; merge lacks a guaranteed role roster/context | M |
| 7 | **P1-02** | Define contract revisions and verify actual type integration | Staleness checks lack an input; standalone generated types do not enforce consumption | M |
| 8 | **P1-03** | Repair every documented onboarding and recovery path | Browser republish, custom origins, ZIP merging, and member-local state have gaps | M |
| 9 | **P1-04** | Add reproducible CI and realistic integration coverage | Current tests miss production storage, packaged CLI, browser, and platform behavior | M |
| 10 | **P1-05** | Run real agent evaluations and a small team pilot | Prompt-string tests cannot establish the product's central promise | L |
| 11 | **P1-06** | Make retention, privacy, and operations match the UI | Expired rooms are hidden, not deleted; recovery and operating evidence are incomplete | M |
| 12 | **P2-01** | Stabilize findings and accepted-drift tracking | Rewording/line movement can lose triage; changed agreements must invalidate acceptance | M |
| 13 | **P2-02** | Apply selected dependency maintenance and pilot-led UX improvements | Useful upkeep once correctness and release gates are stable | S–M |
| 14 | **P3-01** | Consider major tooling migrations | No established launch need for Zod 4, Vitest 5, or TypeScript 7 | Investigate later |
| 15 | **P3-02** | Consider product expansion | Templates, stubs, remote AI, accounts, and realtime features require demand evidence | Unestimated |

## P0 implementation and acceptance

### P0-01 — Patch the stack without a broad migration

Upgrade **Next 16.3.1 → 16.3.5**, the verified stable patch at investigation time, and ensure the lock resolves **sharp >=0.35.4**. Raise the manifest floor and regenerate the lock. Next's relevant fixes begin at 16.3.3; the Windows RCE advisory is specific to Windows-hosted applications. The AVIF vulnerability requires the affected image-processing path, which this audit did not establish as reachable in this app. Treat these as confirmed vulnerable dependency versions, not proof that the planned Vercel deployment is exploitable. [Next Windows advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), [AVIF advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), [sharp advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c).

**Done when:** a clean lockfile install, tests, typecheck, build, package/skill-download smoke checks, and fresh audit pass the reviewed release policy. Verify the resolved transitive versions. Avoid `npm audit fix --force` as a substitute for a reviewed patch.

### P0-02 — Protect the repo and its host credentials

Target: `cli/grill.mjs:151,191,249,306,537`; pack metadata in `lib/pack.ts`.

Validate the entire downloaded manifest before any mutation. Allow only the exact tool-owned paths; bound file counts and UTF-8 bytes; reject duplicate destinations, unsafe Windows path forms, and writes through symlinks/junctions. The official renderer already uses fixed paths, but the CLI currently trusts any server named by a room URL. A malicious/custom server can supply `grill/CONTRACT.md`, and a same-room rejoin overwrites it. The junction failure also works with the ordinary `grill/PROJECT.md` destination. Node's filesystem primitives distinguish lexical paths from resolved links. [Node filesystem reference](https://nodejs.org/api/fs.html#fspromisesrealpathpath-options).

Bind installed state to **origin + room identity**, track installed hashes, preserve user edits, and write the completion stamp last. Use atomic per-file replacement and recoverable multi-file failures. `--force` never overrides path safety. Scope saved host tokens to their original origin/room; never reuse them implicitly for a different `--base` or room. Create ignore protection before saving credentials, detect already tracked secrets, and use appropriate local file permissions.

**Done when:** Windows/Unix sentinel tests prove no writes escape the repo; unexpected pack files fail before any mutation; local instructions/specs/contracts survive joins; failed and dry-run operations preserve files; cross-origin/room requests never transmit the old saved token; new repos keep credentials out of Git. Add bounded network reads/deadlines and clear recovery errors while touching the request layer.

### P0-03 — Make room access and resource use appropriate for public traffic

Target: `lib/keys.ts`, `lib/rate-limit.ts`, room routes, `lib/schema.ts`, URL parsers, room pages.

The key generator has **40 × 40 × 90 = 144,000 possibilities**, about 17 bits. Use a random capability with at least 128 bits of entropy for reads/claims/downloads, retaining the readable name as a label if useful. This preserves account-free sharing. Add bounded unique-key collision retries. Migrate key validation, routes, CLI parsing, examples, and legacy-link policy together. The entropy target is a design recommendation informed by bearer-token guidance. [OWASP identifier guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Use shared atomic quotas or a verified hosting firewall for creation, reads, claims, and failed host writes. Account for teammates sharing an IP. Apply a bounded streaming byte reader to every mutation route; string length and `Content-Length` alone are insufficient. Add no-index/referrer/cache controls for capability-bearing pages and validate trusted origins before printing shell commands. These controls supplement strong links rather than replace them.

**Done when:** incorrect capabilities reveal no room data; forced collisions preserve existing rooms; limits hold across instances/restarts; absent/misleading length headers and multibyte payloads cannot exceed endpoint budgets; useful 413/429 responses reach both CLI and browser. Legacy links have an explicit transition instead of silently remaining a weak alternate entrance.

### P0-04 — Store rooms durably and acknowledge only committed changes

Target: `lib/store.ts:125–180,197`, `supabase/migrations/`, API error mapping.

Require valid Supabase configuration in production and select memory mode explicitly for development/tests. Make claims an atomic database update that preserves other roles. Make republish return the actual committed version, or an explicit conflict when compare-and-swap loses. Check authorization, expiry, and role existence at mutation time; define behavior when a republish removes a role. Retain server-mediated access and current RLS; adding accounts or replacing Supabase is unnecessary. Supabase documents both mutation return values and function privileges. [Supabase update](https://supabase.com/docs/reference/javascript/update), [database functions](https://supabase.com/docs/guides/database/functions).

**Done when:** a separate real test database passes simultaneous different-role claims and competing republishes; no response acknowledges uncommitted content; missing credentials fail clearly; rooms survive restarts; invalid tokens/expired rooms cannot mutate; anonymous database access is denied. Apply and verify migrations before routing beta traffic.

### P0-05 — Make the promised first command work

Target: `cli/package.json`, package documentation/license, deployment configuration, README.

Set up the intended live service and npm package after the safety fixes. The current default [service](https://grill-with-me.vercel.app) and [registry package](https://registry.npmjs.org/grill-with-me) failed read-only availability checks on the research date; verify ownership/access separately rather than assuming the name is available. Publish from `cli/`, since the root package is private. Include README, license text consistent with the declared MIT license, repository/support metadata, and synchronized release metadata.

**Done when:** install the actual tarball in a clean repo, then verify the published package through `npx` against the deployed service: **host → publish → join → status → republish → rejoin**. Confirm production packs include all skills, room state persists, and custom deployments keep their correct origin. Use a beta tag during staging; direct public onboarding to a tested stable release only after the complete release gate. Publication/deployment are future implementation actions, not actions taken by this plan.

## P1 implementation and acceptance

### P1-01 — Use one executable artifact contract

Unify the CLI/library validator and skill instructions. Parse exact ordered headings outside code fences; reject duplicate/missing/suffixed headings and wholly empty specs; distinguish thin specs from malformed ones. Require the merge skill to run this preflight before replacing an existing contract. Derive the expected role roster and project context from validated `grill-room.json` or one shared local manifest, so the host does not depend on a teammate committing their personal pack.

**Done when:** the same fixture corpus yields the same CLI/library results; a room with a missing role identifies it explicitly; a fresh host following the README can merge; invalid input leaves the previous contract intact. One member can cover two roles and retain both specs. Agent-written output must pass the same gate as hand-written input.

### P1-02 — Separate room revision from contract revision

Define the current contract, source-spec references/hashes, contract revision, and append-only amendment history. Preserve or explicitly reconcile amendments during a later merge. Fix the staleness check: it currently compares the pack stamp with a version that the amendment format never writes. Offline uncertainty should be reported as unverified freshness.

Verify generated types through the consuming project's real typecheck command and show producer/consumer examples. Compiling `contract.ts` alone cannot prove either side uses it; specifying input filenames also bypasses `tsconfig.json`. [TypeScript CLI documentation](https://www.typescriptlang.org/docs/handbook/compiler-options.html).

**Done when:** stale/fresh/unknown states are distinct; an amendment updates prose/types/history consistently; re-merge preserves agreed changes; a seeded field mismatch fails a sample project's typecheck while correct code passes. Unused types are reported as unintegrated. Keep the prose workflow working for non-TypeScript projects and document the limits of static types.

### P1-03 — Finish onboarding, portability, and failure recovery

Fix browser-created-room republishing (key and token setup), preservation of custom `--base`, accepted-but-ignored flags such as `host --dry-run`, browser claim takeover, and truthful network-failure messages. A lost publish response means the outcome is unknown; provide an idempotent recovery path instead of asserting no room exists. Make ZIP installation preserve existing `AGENTS.md`, or provide an explicit safe import/merge step.

Define which artifacts are shared in Git and which select the current member's role. Pulling a teammate's spec must not switch another checkout's role. Publish a tested agent/version/invocation matrix; use thin adapters to the same canonical Markdown only where needed. Existing conventions vary and evolve, so portability requires execution, not directory-name assumptions. [Claude skills](https://code.claude.com/docs/en/skills), [Cursor skills](https://cursor.com/docs/skills), [Agent Skills specification](https://agentskills.io/specification).

**Done when:** fresh host/member and existing-repo flows work in the supported agents; each printed command works using the preceding step's state; custom-origin, no-TTY, offline, malformed-response, and permission-error cases recover clearly. Browser file input, paste, copy, claim, and error states work with keyboard navigation and readable labels. No custom instruction file is overwritten.

### P1-04 — Establish CI early, expand it around actual failure modes

Begin this work alongside P0-01. Pin a current **Node 24 LTS** patch for the app/CI/hosting; decide and test the CLI's supported runtime range separately. Node 18/20 are EOL, while 22 and 24 remain supported at investigation time. Patch **Vitest 4.1.10 → 4.1.11**; its advisory concerns browser/dev-server mocking, which is not shown in this node-only test configuration. [Node support schedule](https://github.com/nodejs/Release#release-schedule), [Vitest advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9).

Add required `npm ci`, tests, typecheck, build, audit triage, tarball installation checks, Windows/Linux CLI regression tests, real Supabase integration, and a small browser smoke suite. Check production skill-file tracing with the built/deployed artifact. Add dependency update PRs. Prefer trusted npm publishing once ownership/bootstrap are set up; meet its npm/runtime requirements. [npm clean installs](https://docs.npmjs.com/cli/v11/commands/npm-ci/), [trusted publishing](https://docs.npmjs.com/trusted-publishers/).

**Done when:** a clean checkout can reproduce release checks, the newly reproduced failures fail their regression tests before fixes and pass after, and releases use the tested tarball/commit. Avoid adding test counts or generic coverage percentages as substitutes for these behaviors.

### P1-05 — Prove the skills work with real agents

Prepare evaluation fixtures while P0 work proceeds. Run fresh sessions with Claude Code and one additional supported agent, recording tool/model version, respondent facts, outputs, and scoring. Execute the old plan's unfinished gates: **at least 4/5 well-formed member specs**, questions grounded in the repo/sibling specs, no invented agreements, and **zero false drift findings across three clean runs**. After deterministic validation is installed, every handed-off artifact must pass that gate; the 4/5 measure tracks unaided first-pass prompt reliability.

Seed field mismatches, ownership contradictions, absent roles, missing implementations, and amendments. Require correct role attribution and evidence; missing implementations may cite the contract clause and absent path. Run at least one complete 3–5-person pilot, then target three teams before expanding promotion. Record onboarding time, valid-spec completion, false reports, and mismatches discovered before versus during integration locally.

**Done when:** dated run records demonstrate the gates and the pilot completes the whole loop without maintainer rescue. Any missed or invented agreement is triaged and rerun after correction. These are practical release evidence, not a statistical guarantee of model behavior. No server-side model API or telemetry platform is required.

### P1-06 — Operate what the UI promises

Correct deletion/privacy claims immediately. Implement monitored scheduled deletion of expired rooms with a documented purge window, and a host-authorized early-deletion path. Add concise disclosure of stored briefs/roles/names, capability-link visibility, and local-only specs/contracts. Add readiness checks, redacted structured errors, basic failure monitoring, and a runbook for database outages, migrations, bad deployments, and lost host tokens. Establish a practical recovery/export procedure appropriate to the chosen hosting tier rather than assuming managed backups exist.

**Done when:** expired data is physically purged on schedule, host deletion works, logs contain no credentials/briefs, and a failure drill demonstrates diagnosis and recovery. Keep access expiry and storage deletion as separate documented guarantees. [Supabase Cron](https://supabase.com/docs/guides/cron).

## P2 and P3 boundaries

**P2-01:** add stable agreement/finding IDs and a minimal triage sidecar if needed. Preserve acceptance across wording/line movement but invalidate it when the agreement or violation changes. Distinguish checked-clean from unverified scope. Add deterministic local checks to optional CI/hooks before considering mandatory model-based checks.

**P2-02:** consider React/React DOM 19.2.8 → 19.3.0 together, Supabase JS 2.112.3 → 2.116.0, and JSZip 3.10.1 → 3.10.2, all verified registry versions on the research date. Recheck releases when implementing. None was an audit blocker in this investigation. Let pilot evidence choose subsequent UX work, such as easier room recovery or repeat-team setup.

**P3-01:** defer Zod 4, Vitest 5, and TypeScript 7 migrations until a specific benefit and compatibility proof justify them. In particular, investigate TypeScript compiler/plugin integration instead of assuming a major compiler replacement works with the current Next plugin. [Zod migration guide](https://zod.dev/v4/changelog), [TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

**P3-02:** defer mock/stub generation, non-TS code generators, templates, analytics ingestion, accounts, live collaboration, and hosted AI. These can be valuable later; none repairs the demonstrated beta blockers. Hashing host secrets at rest and rotation can follow initial credential correctness, unless deployment risk raises their priority.

## Delivery sequence and release gate

| Wave | Work | Exit |
|---|---|---|
| 1: safety and data integrity | P0-01 through P0-04; start CI and evaluation fixtures in parallel | Patched build; safe CLI; strong room access; durable, concurrency-tested storage |
| 2: complete the existing product | P1-01 through P1-04 and P1-06; prepare package/staging deployment | Full deterministic workflow, truthful UI, supported-agent setup, realistic release checks |
| 3: prove and release | P1-05; finish P0-05 using the tested artifact | Behavioral gates and pilot pass; clean-machine `npx` works against production |
| 4: learn from usage | P2 items chosen from pilot results | Measurable reduction in repeat failures or integration friction |

For one developer, allow roughly **3–6 working weeks** including validation and pilot coordination; revise after the first safety/database changes. This estimate excludes delays obtaining npm/hosting access and assumes a deliberately small beta. The first implementation slice should be **the Next/sharp security patch plus a minimal CI baseline**, followed by **CLI safety regression cases** and **atomic storage**.

Release only when all P0/P1 criteria above are evidenced. A green unit-test run alone is insufficient. At present, production credentials/configuration, actual Supabase permissions, published npm ownership, live agent behavior, and real-team results remain unverified. The earlier `plan.md` remains useful design history; use this document for the next release's upgrade ordering.
