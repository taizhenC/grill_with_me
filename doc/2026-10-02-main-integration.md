# Main integration record — 2026-10-02

The upgrade work targets a reliable public beta. Implementation is integrated at
main `0215e0ab8b3f3b1d87cd0a321c6537f214d769da`. Sequential Node 24 checks passed
553 tests / 8 Windows skips across 33 files plus typecheck on that exact main,
with the alternate C-to-D-drive case enabled. Expanded Node 22 checks passed
308 tests / 8 skips on the same revision with the alternate-drive case enabled.
Hosted run 37089418245 passed all nine jobs on this exact source checkpoint.
The later documentation-only merge receives independent hosted verification.
Earlier combined Node 22/24 and seven-job checks retain `28eee28`; the expanded
hosted matrix passed on `4ba38a1`.
Earlier local compiled application checks remain explicitly on `24bb491`.
This record does not declare all beta gates passed.

## Integrated feature groups

Individual PR links and acceptance criteria are in [the upgrade plan](../upgrade-plan.md).
The implementation was delivered as separate feature PRs.

| Group | Implemented behavior | Feature/verification PRs |
|---|---|---|
| Dependencies and CI | Patched Next/sharp/Vitest, Windows/Linux Node 22.15.0/22/24 CLI/evaluation matrix, archive installation, production traces, Chromium, real PostgreSQL, controlled publication regressions and bounded test lifecycle | #4, #5, #20, #24, #27, #31, #35, #41, #45, #47 |
| CLI repository and credentials | Validated whole-pack preflight, bounded transport, safe destinations/refresh, edit preservation, protected origin-bound host credentials | #6, #11, #15, #16 |
| Public access and ingress | Strong capability keys, collision safety, bounded UTF-8 mutation bodies, shared quotas, private headers, validated origins | #9, #10, #12, #18, #21 |
| Durable rooms and publication recovery | Atomic claims/republishes, committed versions, bounded recovery ledger, replay after lost replies, browser/CLI recovery state before send | #13, #25, #26, #30 |
| Local workflow | Exact shared spec gate, merge roster/context preflight, contract revisions/source hashes, amendment preservation, consuming TypeScript checks, evidence-based drift attribution | #17, #28, #37 |
| Onboarding and member scope | Browser publish/republish/claim/copy flows, safe ZIP staging, ignored member-local selectors, custom origins, two-checkout role preservation | #20, #22 |
| Retention and operations | Host deletion, bounded purge, privacy disclosure, finite storage deadlines, safe 503/events, restoration and compiled failure checks | #23, #29, #31 |
| Release and evaluation preparation | Beta archive metadata/runbook, updated progress, installed-pack evaluation fixtures, bounded real-agent populations and clause corrections, pilot worksheet, cross-runtime evidence identity protection | #14, #32, #33, #34, #36, #37, #38, #39, #40, #42, #43, #44, #46 |

Feature commits are focused and detailed, with exact author and committer
`taizhenC <tzhcheung@gmail.com>` and no co-author trailers. The ownership audit
covers **198 commits in `9cc8cf5..0215e0a`**, including local integration commits;
it does not describe older repository history. Features received focused checks
before merge. Following the owner's later integration instruction, feature PRs
were merged to main before the combined validation below. Hosted CI is recorded
as evidence, not an additional user-approval requirement.

## Tested revisions and execution evidence

| Revision / environment | Executed result |
|---|---|
| `0215e0a`, local Windows, Node 24.21.0, sequential | 553 passed / 8 platform skips across 33 files; typecheck passed; actual alternate C-to-D-drive case enabled |
| `0215e0a`, local Windows, Node 22.15.0, sequential | Expanded CLI/evaluation/sanitizer suite: 308 passed / 8 platform skips; actual alternate-drive case enabled |
| `0215e0a`, hosted run [37089418245](https://github.com/taizhenC/grill_with_me/actions/runs/37089418245) | All nine jobs successful: six Windows/Linux Node 22.15.0/current 22/24 CLI/evaluation/sanitizer/installed-archive jobs; app build/typecheck/runtime/four skill traces/audit; 12 Chromium flows; four PostgreSQL suites |
| PR #47 feature head `25da315`, local Windows, Node 24.21 and 22.15 | Focused real-CLI checks: 68 passed / 4 platform skips on each runtime; typecheck passed |
| `fe2d737`, local Windows, Node 24.21.0, sequential | 553 passed / 8 platform skips across 33 files; typecheck passed; actual alternate C-to-D-drive case enabled |
| `fe2d737`, local Windows, Node 22.15.0, sequential | Expanded CLI/evaluation/sanitizer suite: 308 passed / 8 platform skips; actual alternate-drive case enabled |
| `fe2d737`, hosted run [37089074350](https://github.com/taizhenC/grill_with_me/actions/runs/37089074350) | Eight successful jobs; Windows current-22 CLI join case exceeded Vitest's default five seconds; every controlled-publication case passed |
| PR #45 feature head `80985c2`, local Windows | 45 publication/pack/evaluation checks passed on Node 24.21; controlled case passed on Node 22.15; actual short-path diagnostics passed on both runtimes |
| `d4d7f7e`, hosted run [37088662568](https://github.com/taizhenC/grill_with_me/actions/runs/37088662568) | Six successful Linux/app/browser/database jobs; three Windows CLI jobs failed controlled scheduling because fixture root spelling differed from the CLI |
| `d4d7f7e`, local Windows, Node 24.21.0 | 552 passed / 9 platform skips across 33 files plus typecheck; alternate-drive environment was absent in this run |
| PR #41 feature head `05befee`, local Windows, Node 24.21 and 22.15 | All 16 publication cases passed on each runtime plus typecheck, including deterministic safe stops and durable recovery |
| `dd744649`, hosted run [37088074910](https://github.com/taizhenC/grill_with_me/actions/runs/37088074910) | Eight successful jobs; Linux Node 22 CLI job failed the same immediate-publication-success assertion |
| `9be59e4`, hosted run [37087701038](https://github.com/taizhenC/grill_with_me/actions/runs/37087701038) | Eight successful jobs; app job failed the concurrent-first-publication immediate-success assertion. Linux suite: 555 passed / 1 failed / 4 skipped; retained for diagnosis |
| `9be59e4`, local Windows | Focused pack/fixture checks: 29 passed on Node 24 plus typecheck; expanded Node 22 suite: 307 passed / 8 platform skips |
| `4561081`, local Windows, Node 24.21.0 | 552 passed / 8 platform skips across 33 test files, including the actual SQL projection consumer regression; typecheck passed |
| `4ba38a1`, hosted run [37086605610](https://github.com/taizhenC/grill_with_me/actions/runs/37086605610) | All nine jobs successful: six Windows/Linux Node 22.15.0/current 22/24 CLI/evaluation/sanitizer/archive jobs, app, Chromium and the four PostgreSQL fixture suites |
| `28eee28`, local Windows, Node 24.21.0, sequential | 551 passed / 8 platform skips across 33 test files; typecheck passed; actual alternate C-to-D-drive sanitizer test enabled |
| `28eee28`, local Windows, Node 22.15.0, sequential | Expanded CLI/evaluation/sanitizer suite: 306 passed / 8 platform skips across 14 files; actual alternate-drive test enabled |
| `28eee28`, hosted run [37086224022](https://github.com/taizhenC/grill_with_me/actions/runs/37086224022) | All seven jobs successful: app build/typecheck/runtime/traces/audit, Chromium, four PostgreSQL fixture suites, and Node 22/24 Windows/Linux CLI/archive checks |
| `24bb491`, local Windows, Node 24.21.0 | 549 passed / 8 platform skips across 33 test files; typecheck, production build, all four skill traces, compiled runtime checks, 12 Chromium flows, and installed-archive verification passed |
| `24bb491`, full npm audit | Zero reported vulnerabilities at verification time |
| `24bb491`, hosted run [37085442416](https://github.com/taizhenC/grill_with_me/actions/runs/37085442416) | All seven jobs successful: app, Chromium, four PostgreSQL fixture suites, and Node 22/24 CLI on Windows/Linux |
| `24bb491`, additional local Windows, Node 22.15.0 | Expanded CLI/evaluation/sanitizer checks: 303 passed / 1 failed / 8 skipped; pathname/descriptor device discrepancy subsequently resolved by PR #34 |
| PR #34 feature head `88b44eb`, local Windows, Node 22.15.0 and Node 24.21.0 | Nine sanitizer tests and 62 focused fixture/pack/spec/sanitizer tests across four files passed on each runtime; Node 24 typecheck passed |
| `19feaa4`, older local PostgreSQL 17.10 | All four real mutation/quota/retention/publication fixture suites passed; SQL/migrations and these fixture scripts are unchanged through `0215e0a` |

On the final `0215e0a` hosted checkpoint, the Linux app suite reports 557 passed /
4 skipped, and npm audit reports zero vulnerabilities. Each Linux CLI runtime
reports 312 passed / 4 skipped; each Windows CLI runtime reports 307 passed /
9 skipped. Hosted Windows does not enable the alternate-drive environment used
by the local 308 / 8 run. These environment-specific counts are separate.

The older local PostgreSQL run is not relabelled as current local execution.
The `28eee28`, `4ba38a1` and `0215e0a` hosted PostgreSQL jobs each execute the four suites
against a disposable service. These results do not verify the intended Supabase account,
production grants, schedules, backup policy or restart behavior.
Final local cleanup stopped only the task-owned PostgreSQL process after
canonical task/data/executable checks and `pg_ctl status`; fixture data was
retained. No shared or production service was stopped.

The earlier seven-job hosted Node 22 runs used the core CLI filter. The additional local run
expanded it to evaluation/sanitizer tests and exposed different device metadata
from pathname `lstat` and opened-descriptor `stat` on Windows Node 22.15.0.
[PR #34's record](2026-10-02-evaluation-file-identity.md) explains the observed
values and fix: compare each channel to its independent exact snapshot, retaining
device/inode/link checks and validation before writes. This is an observed local
compatibility correction, not a claim about an upstream release history.

The first post-merge `28eee28` attempt overlapped Node 24 and expanded Node 22
suites: Node 24 had 549 passes / 2 timeouts / 8 skips; Node 22 had 301 passes /
5 timeouts / 8 skips. Five-second subprocess fixture/CLI limits fired and timed-out
fixture cleanup encountered `EBUSY`; all sanitizer tests passed. These failed
attempts remain visible. The successful sequential repeats above kept the same
five-second limits, with no functional patch. Passing repeats establish repeat
success; overlap alone does not establish the cause of the earlier failures.

[PR #41's diagnosis](2026-10-02-publication-concurrency-verification.md) reproduces
an allowed concurrent publication ordering using two real CLI processes and
temporary preload hooks: one saves its durable capability, a contender's
temporary file makes it stop, then the contender sees changed state and also
stops. Both specific errors occur before POST; one validated recovery record
remains, and recovery creates exactly one room. The test now permits each
initial process's expected 0/1 outcome and checks durability, uniqueness and
recovery. Original hosted stderr was not captured, so the controlled ordering
does not prove the exact original failure schedule. Production behavior is unchanged.

The next hosted run exposed a Windows-only fixture mismatch. An actual 8.3
short-path launch reproduced bypassed scheduling hooks and an initial POST
with literal root spelling. A synchronous realpath candidate still bypassed;
the CLI's exact awaited `fs.promises.realpath(process.cwd())` API restored the
two intended safe stops, zero initial POSTs and one durable capability on both
Node 22.15 and 24.21. [PR #45](2026-10-02-publication-fixture-canonical-root.md)
changes only the preload fixture root and records the failed attempts.

The `fe2d737` matrix passed all controlled-publication cases, but a Windows
current-22 join case exceeded Vitest's default five-second test limit. No
production request/protocol error was recorded, so a runner timeout is not
described as a confirmed installation regression. Its actual-process helper
previously lacked a child deadline. [PR #47's reviewed test-only correction](2026-10-02-cli-integration-deadlines.md) allows
20 seconds per real-process case, bounds each child at 10 seconds, and rethrows
killed/signaled children so expected rejection cannot accept a timeout. Product
deadlines, pure-unit budgets and functional assertions are unchanged. The complete
post-fix hosted matrix on `0215e0a` passed all nine jobs; the failed run is retained.

Application, CLI, skill and dependency sources are unchanged between `24bb491`
and `28eee28`. The local build/runtime/browser/archive/audit results retain their
actual earlier revision; the new hosted run independently repeats those jobs.

[PR #35](2026-10-02-evaluation-runtime-ci.md) changes only CI/documentation,
leaving source/tests unchanged from `28eee28` to `4ba38a1`. Its six CLI jobs add
evaluation/sanitizer tests and cover Windows/Linux with Node 22.15.0, current
22, and 24; app, browser and PostgreSQL bring the total to nine jobs. The older
22.15.0 case verifies the observed compatibility floor. The app still requires
Node 24. The expanded run on exact `4ba38a1` passed all nine jobs.

## Agent quality is measured, still open

[Manual grades](../evals/runs/2026-10-02/grades.md) preserve original and corrected
populations separately. Original Codex first structures passed 5/5, content
faithfulness 4/5, and observed read scope 2/5; content plus scope passed 1/5.
Original Claude completed two invented-decision cases, timed out on one, and
left two unattempted. Corrected Claude Frontend/Backend and Codex Frontend subsets
passed their reviewed rubric, including actual artifact gates. They do not
replace original failures or establish a complete passing matrix.

In the original population, two projected-selector clean checks and one full installed-receipt clean check
completed accurately on different fixture versions. They are not three completed
consistent installed-pack clean runs. The full-receipt seeded artifact correctly
covers all five category checks, but its invocation timed out after writing.
Accurate artifacts and completed invocations are separate results. See
[the evaluation report](2026-10-02-live-agent-evaluation.md) for versions, setup
exclusions, sanitizer/source records, scope failures and timeout limits.

Two current matrices use frozen inputs from `28eee28`; subsequent fixes do not
rewrite those inputs or outputs. [PR #36's member correction](2026-10-02-member-transport-agreements.md)
requires provenance for transport claims in every section after an unapproved
GET status, request body and pagination policy appeared in a Backend spec.
[PR #37's check correction](2026-10-02-contract-check-evidence.md) requires an
agreed clause and incompatible behavior, keeping absent roster owners unverified.
It also fixes future clean fixtures whose adapter promised a title on a close
query that selects only id/closed; an installed-TypeScript consumer regression
checks both projections. That old fixture imprecision is a limit on the clean
population, not evidence that every reported Database item was false.
Separately bounded corrected runs retain their own source version and outcomes.

[The frozen current Codex matrix](../evals/runs/2026-10-02/codex-current-matrix/grades.md)
completed all nine cases in 14 invocations: first/final structure, actual gates
and observed read/write scope passed 5/5; faithful content passed 4/5, with an
unagreed QA file exclusion. Its baseline had one unsupported Frontend finding
plus the adapter concern. Its seed detected four of five categories, missing
absent-owner handling. These records do not replace original failures.
[PR #39's correction](2026-10-02-member-question-scope.md) distinguishes who
supplies a test from its file placement and defers second setup/meta questions.
One nine-case run was authorized for each agent on frozen corrected sources.
Codex completed it; Claude's quota-stopped partial result is recorded below.
Successful cases from different populations are not combined.

[The frozen current Claude matrix](../evals/runs/2026-10-02/claude-current-matrix/grades.md)
also completed nine cases in 14 invocations. Structures, actual gates and observed
scope passed 5/5. Content passed 4/5, while all member criteria together passed
3/5 because of Backend transport invention and QA's additional sequencing
question. Its three zero-finding clean reports remain qualified by the same
adapter defect. Seed detection passed all five categories; its explicit missing
Payments/nobody-to-contact caveat establishes uncertain ownership, but the
initial "Talk to Payments" instruction remains misleading routing.
PR #40 adds evidence only; evaluated runtime/fixture sources remain identical
from `9be59e4` to `dd744649`. Corrected population records retain their actual
checkout IDs and matched source hashes.

[The corrected full Codex population](../evals/runs/2026-10-02/codex-corrected-matrix/grades.md)
ran all nine cases and 14 invocations on frozen `9be59e4`, with no retry, model
override or source/fixture change. All five first/final structures, actual gates
and observed scopes pass. Five of five first-pass structures meet the numerical
well-formed threshold. Faithful content is 4/5; Frontend still adopts unanswered
inline placement, so the full population fails the no-invented-agreement
condition. All three corrected-fixture clean checks complete with zero false
findings, and the completed seed detects all five categories, including
unverified ownership for absent Payments. Earlier populations remain unchanged.

Zero false findings is a bounded measure: baseline omits unavailable compiler,
live driver and HTTP wiring from Unverified; no-local erroneously invokes the
member-spec gate on CHECK-REPORT, gets exit 1, and honestly explains it. All
model processes complete successfully, which does not mean every local shell
command succeeded. [PR #43's record](2026-10-02-codex-corrected-matrix.md) retains
these coverage/workflow caveats, 24 frozen hashes, eight receipt hash sets,
unchanged first/final artifacts and the remaining Frontend failure.

[The corrected Claude population](../evals/runs/2026-10-02/claude-corrected-matrix/grades.md)
uses literal `dd744649` with all 24 evaluated source hashes matching Codex's
`9be59e4`. A verified LF materialization before invocation is documented, with
no semantic or mid-run source change. Frontend and Backend complete and pass.
Database writes an unchanged first/final artifact and passes its actual gate,
then weekly quota ends call 6/14 with exit 1 and no successful handoff. Its
sentence attributing respondent-supplied SQL details to the interview question
is a provenance caveat. Auth, QA, three cleans and seed are unattempted; no retry,
quota workaround or cross-agent substitution occurred. [PR #44's record](2026-10-02-claude-corrected-matrix.md)
keeps the failed completion distinct from the gate-valid artifact.

[PR #42's clause correction](2026-10-02-member-decision-clauses.md) addresses
the retained full Codex Frontend failure. A separately authorized two-call
Frontend subset on `ce9415f` passes independent review: the recommendation
proposed a message near the ticket, but the fixed reply settled only messages,
visibility and reload. Identical first/final specs leave placement/presentation
and reload mechanism unresolved and adopt no retry action. Both invocations
exit 0; one Add, no repair, and the actual gate returns ok with no thin sections
or errors. All 14 completed commands are fixture-local with no outside content
reads observed. This is targeted triage evidence, not a substituted full-matrix
score, a full current-source reliability measurement or a native editor test.
[PR #46's record](2026-10-02-codex-decision-clauses-rerun.md)
and [independent grade](../evals/runs/2026-10-02/codex-decision-clauses-rerun/grades.md)
preserve the result. Source/tests are unchanged from `fe2d737` to `cedf92f`;
the evidence merge does not relabel earlier functional execution.

## Remaining release gates

- Establish the complete current-source no-invented-agreement condition; Codex's
  frozen full population retains its failure despite the separately passing
  targeted correction. Complete Claude's corrected member/three-clean/seed matrix
  when account access permits, as a separately authorized bounded population.
  Codex's well-formed first-pass, three completed clean zero-false and seeded
  measures pass, with the caveats above. Successful cases from different sources
  or agents are not blended. Verify native editor discovery/invocation;
  explicit CLI instruction-path behavior does not establish it. Read-scope
  compliance is observed, not an OS confinement guarantee.
- Execute the consenting human 3–5-person complete-loop pilot using
  [the worksheet](team-pilot-worksheet.md), recording timing, rescue and findings.
  Three teams remain the promotion target.
- Verify actual npm ownership/publication, Vercel service and intended Supabase
  migrations/grants/persistence/recovery/deletion/purge/monitoring; execute the
  registry-installed onboarding loop against that deployment using
  [the release runbook](beta-release-runbook.md).

P2 findings/accepted-drift triage, selected maintenance and pilot-led UX remain
deferred; P3 major migrations and product expansion remain deferred. No package
publication, production deployment or executed human pilot is claimed.

## Documentation checks

This documentation feature changes the progress record and this integration
report only. Relative links, unchanged authoritative ranking/P2/P3 boundaries,
merged PR references, exact hosted revision/jobs, unchanged database sources and
commit ownership were checked. `git diff --check` passed. Functional results above
are the implementation team's combined main runs, not suites rerun for these
documentation changes. This feature is delivered in two focused owner-only commits
through a separate documentation PR. The later documentation-only main head is
verified independently after review and merge; source-checkpoint results are not
relabelled as that later execution.
