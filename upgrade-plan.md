# grill-with-me: public-beta upgrade plan

Originally prepared **2026-09-19**, against commit `1e7bbca`. Target confirmed by the project owner: **a reliable public beta**. The original investigation and baseline below are historical; implementation progress is recorded separately. The ranked backlog and acceptance criteria remain the release contract.

The existing architecture fits the product: local agents conduct interviews, Git carries specs and contracts, and a small web service distributes packs. The next release should make that loop safe, dependable, and demonstrably useful. The most urgent work is dependency patching, local file protection, room access, database correctness, and making public onboarding available.

## Implementation progress — 2026-10-02

The implementation below is merged into `main` through `0215e0ab8b3f3b1d87cd0a321c6537f214d769da`. September dependency targets and failure descriptions below describe the research snapshot; the security implementation uses the newer October-verified patches. Completion reports for finished features are in `doc/`. Merged code and test evidence do not complete the deployment, agent-quality, or pilot gates.

| Plan item | Pull request | Implemented scope |
|---|---|---|
| Planning record | [#3](https://github.com/taizhenC/grill_with_me/pull/3) | Priorities, acceptance criteria, research, and this progress record |
| P1-04 baseline | [#4](https://github.com/taizhenC/grill_with_me/pull/4) | Node 24 app CI, Node 22/24 Windows/Linux CLI checks, actual npm archive installation, and production skill tracing |
| P0-01 | [#5](https://github.com/taizhenC/grill_with_me/pull/5) | Next 16.3.8, sharp 0.35.5, and Vitest/matching modules 4.1.11; unrelated dependencies retain their compatible locked versions |
| P0-02 first slice | [#6](https://github.com/taizhenC/grill_with_me/pull/6) | Complete pack manifest validation, UTF-8 content bounds, linked destination rejection, whole-install preflight, and host dry-run |
| P0-03 body limits | [#9](https://github.com/taizhenC/grill_with_me/pull/9), [#12](https://github.com/taizhenC/grill_with_me/pull/12) | Received-byte limits, bounded reads, strict UTF-8, and abort handling |
| P0-03 capability links | [#10](https://github.com/taizhenC/grill_with_me/pull/10) | Strong random room keys, collision handling, access headers, and legacy expiry policy |
| P0-02 credentials | [#11](https://github.com/taizhenC/grill_with_me/pull/11) | Origin/room-bound tokens, protected local storage, and secret-safe output |
| P0-04 | [#13](https://github.com/taizhenC/grill_with_me/pull/13) | Explicit durable configuration, atomic claim/republish RPCs, and real PostgreSQL concurrency checks |
| P0-05 preparation | [#14](https://github.com/taizhenC/grill_with_me/pull/14) | Beta metadata, legal/readme archive contents, and release runbook; publication remains open |
| P0-02 transport | [#15](https://github.com/taizhenC/grill_with_me/pull/15) | Bounded response bytes/deadlines, cancellation, and uncertain mutation outcomes |
| P0-02 refresh | [#16](https://github.com/taizhenC/grill_with_me/pull/16) | Installed hashes, local-edit preservation, atomic per-file replacement, and convergent retry |
| P1-01 | [#17](https://github.com/taizhenC/grill_with_me/pull/17) | Shared exact spec parser, required role roster/context, and read-only merge preflight |
| P0-03 shared quotas | [#18](https://github.com/taizhenC/grill_with_me/pull/18) | Shared database client/global budgets, trusted ingress, page protection, and compiled runtime regression checks |
| P1-03 browser/ZIP; P1-04 browser CI | [#20](https://github.com/taizhenC/grill_with_me/pull/20) | Browser publish/republish setup, safe ZIP staging, bounded requests and replies, keyboard/copy/claim flows, and compiled Chromium checks |
| P0-03 public origins | [#21](https://github.com/taizhenC/grill_with_me/pull/21) | Validated canonical or ingress origins before rendering links and CLI commands; forwarded headers require explicit proxy trust |
| P1-03 member-local state | [#22](https://github.com/taizhenC/grill_with_me/pull/22) | Ignored member selectors and role instructions, safe legacy migration, two-checkout Git preservation, and custom CLI origin propagation |
| P1-06 retention/privacy | [#23](https://github.com/taizhenC/grill_with_me/pull/23) | Host-authorized physical deletion, bounded purge RPC/maintenance route, retention disclosure, and operator runbook |
| P1-04 Linux regression fixture | [#24](https://github.com/taizhenC/grill_with_me/pull/24) | Create the local selector parent before the Linux symlink fixture; retain rejection assertions |
| P1-03 browser publication recovery | [#25](https://github.com/taizhenC/grill_with_me/pull/25) | Persist the original request/capability before POST, recover across lost replies/reloads, and require explicit abandonment before a new publication |
| P0-04/P1-03 publication backend | [#26](https://github.com/taizhenC/grill_with_me/pull/26) | Atomic publication ledger, request/origin binding, identical replay credentials, bounded recovery expiry, and deletion/expiry tombstones |
| P1-04 recovery browser fixtures | [#27](https://github.com/taizhenC/grill_with_me/pull/27) | Integrate browser fixtures with the saved-capability recovery protocol |
| P1-02 contract revisions/types | [#28](https://github.com/taizhenC/grill_with_me/pull/28) | Source/artifact hashes, fresh/stale/unknown status, amendment preservation, recoverable finalization, and consuming-project TypeScript integration checks |
| P0-04/P1-06 storage failures | [#29](https://github.com/taizhenC/grill_with_me/pull/29) | Five-second storage deadlines, safe cross-bundle 503 mapping, redacted operator events, and restoration drill |
| P1-03 CLI publication recovery | [#30](https://github.com/taizhenC/grill_with_me/pull/30) | Protected recovery state before send, replay after process restart or credential-write failure, and validated acknowledgements |
| P1-04 compiled failure verification | [#31](https://github.com/taizhenC/grill_with_me/pull/31) | Actual built Next route/page failures, private headers, redacted diagnostics, and preserved 403/404/410 domain outcomes |
| Progress/release instructions | [#32](https://github.com/taizhenC/grill_with_me/pull/32) | Historical baseline, merged-feature progress, exact-main evidence, and complete runtime/browser/database release checks |
| P1-05 evaluation kit/prompt correction | [#33](https://github.com/taizhenC/grill_with_me/pull/33) | Reproducible installed-pack fixtures, bounded real-agent runs, preserved first/final artifacts and failures, manual grades, safer evidence sanitization, corrected agreement prompts, and pilot worksheet; quality gate remains open |
| P1-05 evidence file identity | [#34](https://github.com/taizhenC/grill_with_me/pull/34) | Independent pathname/descriptor snapshots support observed Windows Node 22 stat behavior while preserving device/inode/link checks; actual sanitizer regressions pass on Node 22/24 |
| P1-04/P1-05 evaluation runtime CI | [#35](https://github.com/taizhenC/grill_with_me/pull/35) | Add evaluation/sanitizer regressions to six CLI matrix jobs covering Node 22.15.0, 22 and 24 on Windows/Linux; nine total jobs including app, browser and database |
| P1-05 member transport provenance | [#36](https://github.com/taizhenC/grill_with_me/pull/36) | Require explicit provenance for status, body and pagination claims in every spec section; preserve the failing frozen Backend artifact and measure correction separately |
| P1-05 contract-check evidence | [#37](https://github.com/taizhenC/grill_with_me/pull/37) | Require an agreed clause and incompatible code behavior; mark absent owners unverified; correct future SQL projection fixtures with an actual TypeScript consumer regression |
| P1-05 frozen current Codex matrix | [#38](https://github.com/taizhenC/grill_with_me/pull/38) | Preserve all nine completed cases and independently graded content/scope, including the QA exclusion, false Frontend check, fixture limitation and missed absent-owner category |
| P1-05 questions/supplied-input scope | [#39](https://github.com/taizhenC/grill_with_me/pull/39) | Defer setup/next-topic/meta questions; supplying a test does not decide or exclude its file placement; retain both failing populations and measure the correction separately |
| P1-05 frozen current Claude matrix | [#40](https://github.com/taizhenC/grill_with_me/pull/40) | Preserve the complete nine-case population: five real gates, Backend invention and QA interview failures, fixture-qualified clean observations, and all seed detections with a routing caveat |
| P1-04 publication concurrency verification | [#41](https://github.com/taizhenC/grill_with_me/pull/41) | Reproduce safe stops by both real publishers, preserve one durable capability, and verify recovery creates one room; require expected process exits |
| P1-05 separately accepted clauses | [#42](https://github.com/taizhenC/grill_with_me/pull/42) | Error messages and visibility do not decide placement or retry; preserve the full-matrix Frontend failure and measure a fresh targeted subset separately |
| P1-05 corrected full Codex matrix | [#43](https://github.com/taizhenC/grill_with_me/pull/43) | Complete all nine cases: 4/5 faithful members, five actual gates, three clean zero-false reports, and all seeded categories; retain remaining Frontend and reporting caveats |
| P1-05 quota-stopped corrected Claude matrix | [#44](https://github.com/taizhenC/grill_with_me/pull/44) | Preserve two completed roles and a gate-valid Database artifact followed by quota-failed handoff; six cases unattempted, without retry or workaround |
| P1-04 canonical publication fixture paths | [#45](https://github.com/taizhenC/grill_with_me/pull/45) | Use the CLI's asynchronous realpath API in test hooks; reproduce and correct Windows short-path scheduling bypass without changing production behavior |
| P1-05 targeted Frontend clause measurement | [#46](https://github.com/taizhenC/grill_with_me/pull/46) | Preserve a separate two-call pass after the clause correction, with unanswered placement/reload mechanisms unresolved; full-matrix failures remain unchanged |
| P1-04 bounded integration-test lifecycle | [#47](https://github.com/taizhenC/grill_with_me/pull/47) | Bound actual CLI children at ten seconds and cases at twenty; killed/signaled processes fail rather than satisfy expected rejection; product deadlines/assertions are unchanged |

The final source checkpoint is exact main `0215e0ab8b3f3b1d87cd0a321c6537f214d769da`: sequential Node 24 checks passed **553 tests / 8 Windows skips**, 33 files, plus typecheck; sequential expanded Node 22.15 checks passed **308 tests / 8 Windows skips**. The actual alternate C-to-D-drive sanitizer case was enabled in both. [Hosted run 37089418245](https://github.com/taizhenC/grill_with_me/actions/runs/37089418245) passed all **nine jobs** on that exact revision: six Windows/Linux Node 22.15.0/current 22/24 CLI/evaluation/sanitizer/archive jobs, app build/typecheck/runtime/traces/audit with zero reported vulnerabilities, 12 Chromium flows, and four PostgreSQL suites. These are source-checkpoint results; the later documentation-only integration receives its own hosted verification.

[Hosted run 37089074350](https://github.com/taizhenC/grill_with_me/actions/runs/37089074350) passed eight jobs and every controlled-publication case, but the Windows current-22 join test exceeded Vitest's five-second default. Its real child-process helper had no deadline; [PR #47's test-only lifecycle correction](doc/2026-10-02-cli-integration-deadlines.md) bounds cases/children and rethrows killed/signaled children. Focused checks passed 68 tests / 4 Windows skips on Node 24 and 22.15 plus typecheck, before the complete passing source checkpoint above. PR #46 changes only evidence/documentation; source/tests are unchanged from `fe2d737` to `cedf92f`. Earlier checkpoints retain their actual revisions.

Combined evidence before the latest prompt/fixture corrections, on exact main `28eee28ae589b8e7ea4d2e2e47ee33e03ca2ac26`: sequential local Node 24 checks passed **551 tests / 8 Windows skips**, 33 files, plus typecheck; expanded Node 22 CLI/evaluation/sanitizer checks passed **306 tests / 8 Windows skips**, 14 files. The actual alternate-drive sentinel was enabled in both runs. [Hosted run 37086224022](https://github.com/taizhenC/grill_with_me/actions/runs/37086224022) passed all **seven jobs** on the same revision, including build/typecheck/runtime/traces/audit, Chromium, installed archives and four PostgreSQL suites. Earlier local compiled application checks on `24bb491` passed the build, all four traces, runtime, **12 Chromium flows**, installed archives and full audit with zero vulnerabilities; app/CLI/skill/dependency sources are unchanged through `28eee28`. See [the integration record](doc/2026-10-02-main-integration.md) for exact revisions and retained failures.

PR #35 changes only CI and its documentation; runtime/test sources are unchanged from `28eee28` to `4ba38a1`. [Hosted run 37086605610](https://github.com/taizhenC/grill_with_me/actions/runs/37086605610) passed all **nine jobs** on exact main `4ba38a194569c934626def144c1aa8df96a648e7`, including the expanded evaluation/sanitizer filter and installed archives on Windows/Linux with Node 22.15.0, current 22, and 24, plus app, Chromium and four PostgreSQL suites. [The runtime CI record](doc/2026-10-02-evaluation-runtime-ci.md) explains compatibility-floor coverage separately from the app's Node 24 requirement.

PRs #36 and #37 are separate corrections prompted by independent grading of the current frozen matrices. [The member record](doc/2026-10-02-member-transport-agreements.md) retains invented transport defaults; [the check record](doc/2026-10-02-contract-check-evidence.md) distinguishes unsupported Frontend drift, the old clean fixture's real SQL projection imprecision, and an absent-owner attribution failure. New prompt/fixture behavior is measured separately; old outputs are preserved. The post-PR #37 main `4561081` local Node 24 suite passed **552 tests / 8 Windows skips** across 33 files, including the actual SQL projection consumer regression, plus typecheck.

[PR #39's shared member correction](doc/2026-10-02-member-question-scope.md) addresses a bundled Claude QA sequencing question and an unagreed Codex QA file exclusion. Post-merge `9be59e4` focused pack/fixture checks passed 29 tests plus typecheck; expanded Node 22 checks passed **307 tests / 8 Windows skips**. The complete corrected Codex nine-case run and attempted, quota-stopped Claude run are recorded separately from earlier matrices. Literal checkouts were `9be59e4` and `dd744649`, with all 24 evaluated source hashes matching.

[Hosted run 37087701038](https://github.com/taizhenC/grill_with_me/actions/runs/37087701038) on `9be59e4` had eight successful jobs and an app-test failure: the concurrent-publication test expected an immediately successful publisher. The Linux suite reported 555 passed / 1 failed / 4 skipped. [Run 37088074910](https://github.com/taizhenC/grill_with_me/actions/runs/37088074910) on `dd744649` failed the same assertion in the Linux Node 22 CLI job while eight jobs passed. [PR #41's controlled real-CLI regression](doc/2026-10-02-publication-concurrency-verification.md) reproduced a permitted ordering where both processes stop safely before POST, preserve one recovery capability, and later recover one room. It corrects the test's success assumption; the original hosted stderr was unavailable, so this is not proof of the original schedule.

The controlled regression's [main run 37088662568](https://github.com/taizhenC/grill_with_me/actions/runs/37088662568) on `d4d7f7e` passed Linux, app, browser and database jobs but failed all three Windows CLI jobs. [PR #45's record](doc/2026-10-02-publication-fixture-canonical-root.md) retains actual Windows 8.3 diagnostics: literal and synchronous root spellings bypassed the scheduling hooks; the same asynchronous realpath API as the CLI restored both specific safe stops, zero initial POSTs and durable recovery. Only the test fixture changes. All failed checkpoints remain visible.

PR #34 resolved the earlier expanded Node 22 **303 passed / 1 failed / 8 skipped** result: pathname and opened-descriptor device metadata differed on an ordinary contained file. Independent exact snapshots preserve device/inode/link checks; nine sanitizer tests and 62 focused tests passed on each runtime. The first combined `28eee28` attempt overlapped Node 24/22 suites and hit subprocess timeouts and busy cleanup. The successful sequential repeats above used unchanged five-second limits and no functional patch; the failed attempt remains recorded separately.

Earlier exact main `19feaa414578d5cd968534633df7ddca7c83bd82` passed 534 Node 24 tests and 289 Node 22 CLI checks with eight Windows skips each. Its local **four PostgreSQL 17.10 suites** passed; those SQL/migration and fixture sources are unchanged at `4ba38a1`. [Hosted run 37083259153](https://github.com/taizhenC/grill_with_me/actions/runs/37083259153) passed seven jobs on that earlier revision. Older local database evidence is separate from later hosted execution.

Historical wave evidence: [pre-merge run 37076910493](https://github.com/taizhenC/grill_with_me/actions/runs/37076910493) passed five jobs with 151 Linux tests; [post-merge run 37077465585](https://github.com/taizhenC/grill_with_me/actions/runs/37077465585) passed five jobs on `eb737f461a7c2e27b016c08abea2848d129a72c1`. Later main `8419bcd17109c7ba1420a13b87612a35f261d2d1` passed 411 Node 24 tests with eight Windows skips and the checks documented in [the safety-wave completion record](doc/2026-10-02-safety-wave-completion.md). These records describe earlier checkpoints, not the current totals.

The ownership audit of the **198 upgrade-range commits in `9cc8cf5..0215e0a`** found exact author and committer `taizhenC <tzhcheung@gmail.com>` and no co-author trailers. This claim is scoped to the upgrade work, not older repository history.

P1-05 has measured evidence, but remains **open**. [Original grades](evals/runs/2026-10-02/grades.md) and [the evaluation record](doc/2026-10-02-live-agent-evaluation.md) retain scope failures, invented decisions, timeouts and unattempted cases. The separate [corrected full Codex population](evals/runs/2026-10-02/codex-corrected-matrix/grades.md), frozen on `9be59e4`, completed all 14 invocations. Its **5/5 first-pass structures** meet the numerical well-formed threshold, with five actual gates and compliant observed scopes. Faithful content is **4/5**, and Frontend's unagreed inline placement means the full population **fails the no-invented-agreement condition**. Separately, **three completed clean reports with zero false findings** and **all five completed seeded categories** pass on corrected fixtures. Baseline's missing integration uncertainty and no-local's wrong report gate remain reporting caveats; zero false findings does not establish compiled/runtime integration.

The [corrected Claude population](evals/runs/2026-10-02/claude-corrected-matrix/grades.md), with matching evaluated source hashes, completed Frontend and Backend. Database passed its actual gate before a genuine weekly quota error ended the write invocation without successful handoff; its provenance imprecision remains recorded. Auth, QA, three clean checks and seed were unattempted. No retry or quota workaround occurred. After PR #42, [a separately authorized two-call Codex Frontend subset](evals/runs/2026-10-02/codex-decision-clauses-rerun/grades.md) on `ce9415f` independently passed, keeping unanswered placement/presentation and reload mechanics unresolved and adopting no retry action. It does not replace the full-matrix failure or create a new full-matrix numerator.

Release gates still open:

- **P0-05:** verify npm ownership/publishing access and the actual Vercel service, publish the tested beta archive, then execute the registry-installed host → publish → join → status → republish → rejoin flow against that deployment.
- **P0-04/P1-06 deployment verification:** apply all migrations to the intended Supabase project; verify actual RLS/RPC grants, restart persistence, publication recovery, deletion and scheduled purge execution; record redacted monitoring, provider/backup policy, and recovery evidence. Disposable PostgreSQL tests and a local restoration drill do not verify the hosted account.
- **P1-05 and P1-03 agent portability:** establish the complete current-source no-invented-agreement condition without replacing Codex's failing full-population grade with its targeted pass; a single corrected case does not demonstrate full-matrix reliability. Finish the corrected Claude member/three-clean/seed matrix in a separately recorded, authorized bounded population when account access permits. Codex's well-formed first-pass, three-clean and seed measures pass with the limitations above; successful cases from different versions are not combined. Verify native editor discovery/invocation separately from explicit CLI instruction-path behavior. Execute the consenting human 3–5-person complete-loop pilot; the worksheet is preparation only. No complete passing matrix for both agents or completed team pilot is claimed. Three teams remain the promotion target.

P2/P3 remain deferred as originally ranked. P1-02's stable agreement blocks support amendment preservation; the P2 findings/accepted-drift triage feature remains deferred. Passing local or hosted checks does not establish these unexecuted release gates.

## Historical baseline and evidence — 2026-09-19

These observations describe commit `1e7bbca` at the original investigation, before the merged fixes and expanded checks above. They are not current test totals or a current defect list.

- `npm test`: **108 tests passed**, seven files.
- `npm run typecheck`: passed.
- `npm run build`: passed on the then-tested Windows machine, Node 22.15.0.
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

Original delivery estimate (2026-09-19): roughly **3–6 working weeks** for one developer, including validation and pilot coordination. This historical estimate excluded delays obtaining npm/hosting access and assumed a deliberately small beta. The proposed first slices were **the Next/sharp security patch plus a minimal CI baseline**, **CLI safety regression cases**, and **atomic storage**; their merged implementations are recorded above.

Release only when all P0/P1 criteria above are evidenced. A green unit-test run alone is insufficient. Actual npm/Vercel/Supabase release verification, passing agent-quality gates, and real-team results remain open as recorded above. The earlier `plan.md` remains useful design history; use this document for the next release's upgrade ordering.
