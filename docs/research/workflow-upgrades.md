# Workflow and skill upgrade evidence

Research date: 2026-09-19. Scope: product workflow, pack contents, local agent instructions, spec/contract correctness. This is an upgrade recommendation, not an implementation or a claim that live agent evaluations passed. Repository paths and lines refer to the checkout inspected for this report.

## Recommendation

Prioritize proving and enforcing the existing host → member spec → merge → check → amend loop. Keep the local-agent, no-account, Git-transport architecture. The project already has the four useful skills and distribution plumbing; its missing evidence is whether independent agents produce trustworthy agreements and repeatable checks. `plan.md:5`, `plan.md:349`, `plan.md:383`, and `plan.md:468` explicitly leave those behavioral gates open.

Priority definitions in this report: **P0** blocks calling the workflow reliable; **P1** is required for a dependable outside-team beta; **P2** follows evidence from that beta; **P3** is optional expansion. These are current release priorities, distinct from the original plan's historical “P0 = before writing code” definition.

## P0 — Make the spec gate match the promise

**Evidence.** `lib/spec-format.ts:25` searches heading prefixes with `indexOf`, rather than parsing exact headings outside Markdown code fences. The separately maintained CLI validator does the same (`cli/grill.mjs:619`). A fully empty spec receives a success exit code and encouragement to commit (`cli/grill.mjs:691`, `cli/grill.mjs:703`); its test deliberately expects success (`tests/cli.test.ts:407`). The merge skill explicitly rejects a spec empty under every heading (`skills/merge-contract/SKILL.md:22`). The public promise is validation against the exact structure merge consumes (`README.md:49`). Current tests assert heading strings, not behavioral parity (`tests/cli.test.ts:432`).

**Reproduction performed.** Invoked the real CLI with four temporary spec files. Each returned exit code 0 and “Well-formed. Commit it”: (1) five headings with no content; (2) each required heading suffixed with `NOT AN EXACT HEADING`; (3) all required headings appearing only inside a fenced code block; (4) duplicate `## Scope` after the otherwise valid sections. Temporary files were removed. No source edits were needed.

**Upgrade.** Define a single executable spec-format contract usable by the zero-dependency CLI and app/build tests. A small local JavaScript parser can preserve the no-dependency CLI promise; a new runtime parser package is not inherently necessary. Require merge to run the validator before interpretation, then validate its output separately. Distinguish invalid, valid-but-thin, and ready. Keep semantic judgment with the agent, but make malformed documents a deterministic failure.

**Acceptance criteria.** Both entry points reject fenced-only headings, wrong heading suffixes, duplicates, reordered/missing sections, and all-empty specs. LF/CRLF and a heading at file start work. Partially empty specs follow one explicit policy with actionable file/section errors. A shared fixture corpus proves CLI/library agreement. The member prompt asks the agent to run `check-spec` after writing and correct formatting failures before handoff. A failing preflight leaves an existing contract intact.

## P0 — Execute the product's existing behavioral release gates

**Evidence.** Tests explicitly acknowledge that prompt behavior requires actual execution (`tests/skills.test.ts:41`), then check whether the skills contain phrases (`tests/skills.test.ts:108`, `tests/skills.test.ts:137`). Those tests are useful prompt regression guards but cannot establish interview fidelity, contradiction detection, ownership attribution, or false-positive rate. The original gates remain unchecked (`plan.md:346`–`plan.md:386`).

**Upgrade.** Check in a small evaluation kit: deterministic project/spec/code fixtures, scripted respondent facts, expected outcomes, a scoring rubric, and dated run records including tool/model version and relevant artifacts. Run the real locally authenticated agents in fresh sessions; no application-side LLM API or new account is necessary. Evaluate on at least Claude Code and one additional supported agent. Anthropic's own documentation distinguishes successful skill discovery from correct output and recommends realistic fresh-session comparisons against a baseline. [Claude skill evaluation guidance](https://code.claude.com/docs/en/skills#evaluate-and-iterate-on-a-skill).

**Acceptance criteria.** Meet the existing 4/5 well-formed member-spec gate and zero false findings in three clean runs. Record at least one question grounded in code and one grounded in a sibling spec, with no invented agreement. Add seeded cases for mismatched fields, conflicting ownership, a missing role, a malformed spec, missing implementation, an accepted finding, and an amendment that resolves prior drift. Require correct owner and verifiable evidence for every seeded drift finding. Publish actual counts and failures; do not infer success from unit tests. Repeat affected cases after prompt changes. Track a small number of real team pilots locally: time to first valid spec, integration mismatches found before versus during integration, and false reports accepted by mistake. Do not add telemetry to measure these initially.

## P1 — Give merge an explicit roster and host-side preflight

**Evidence.** The host path installs skills (`cli/grill.mjs:444`) and publishing saves connection/token config (`cli/grill.mjs:504`); neither renders `grill/PROJECT.md`. The documented next step is immediately to merge (`README.md:35`, `cli/grill.mjs:532`), while the merge skill requires `grill/PROJECT.md` (`skills/merge-contract/SKILL.md:12`). That file is produced by member packs (`lib/pack.ts:224`). It may arrive if a teammate commits it, but the documented member handoff only says to commit the spec (`README.md:45`). Furthermore, `PROJECT.md` renders project details without the room's role roster (`lib/pack.ts:46`), and merge scans only the specs that exist. This leaves no reliable comparison against expected roles, despite the missing-role gate (`plan.md:377`).

**Upgrade.** Establish one local shared manifest derived from the validated room, with project, expected role slugs, scope, and schema/room revision. Alternatively, let host merge read the existing `grill-room.json` as authoritative input and add its roster to the shared brief. Separate shared artifacts from the member-local role selection. Define how one person covers two roles and whether a dropped role must be explicitly waived. Do not use anonymous claim state as proof a usable spec exists.

The pack mixes shared files with checkout-specific `MY-ROLE.md`, `.room`, and a role-specific launcher (`lib/pack.ts:151`, `lib/pack.ts:224`). Document what is committed and what stays local, and preserve that split during joins, pulls, and role changes. Otherwise a teammate's committed role selection can change the scope another agent reads. This needs an explicit Git policy, not a new collaboration service.

The same onboarding work should cover both publishing paths. The browser host view prints `republishCommand(origin)` without the room key and says first-use `--token` saves the token (`app/r/[key]/host/page.tsx:90`), while the CLI requires a config/key (`cli/grill.mjs:541`) and does not save config during republish (`cli/grill.mjs:537`). A custom-deployment `host --base ...` also prints a subsequent publish command without that base (`cli/grill.mjs:479`). These are concrete broken handoffs to include in the fixture scenarios, alongside the CLI audit's other findings.

**Acceptance criteria.** A fresh host checkout following only documented host steps can merge committed role specs. A three-role room with only two specs reports the missing third role by name before generation; no silent success. Unknown/retired roles are surfaced. The single-person/two-role path produces two preserved specs. Git remains the only transport for team specs and contracts. No spec upload endpoint is needed.

Also run the browser-publish → first CLI republish path in a fresh checkout and the complete custom-base host → publish → join path. Every printed next command must work with the state created by the previous step. Pulling shared team artifacts must preserve each checkout's role selection.

## P1 — Unify contract revision, amendment authority, and stale-pack detection

**Evidence.** The pack stamp contains `roomKey`, one role, and `packVersion` (`lib/pack.ts:168`). `check-contract` compares this to a pack version in the newest amendment (`skills/check-contract/SKILL.md:12`), but the amendment format never records that field (`skills/amend-contract/SKILL.md:29`), so the intended warning has no reliable input. Republish bumps room content independently of contract edits. Amendments are declared authoritative (`skills/check-contract/SKILL.md:18`) while the amendment skill calls the edited contract the current truth (`skills/amend-contract/SKILL.md:38`). Re-running merge has no explicit policy for preserving the existing amendment history or current contract.

**Upgrade.** Model room/pack revision separately from contract revision. Include source spec hashes or Git commit references and a contract revision in the merge output; amendments record parent/new contract revision and changed agreement IDs. Define the canonical current agreement document, the append-only audit log, and a reconciliation rule if they disagree. A merge after amendment must detect existing state and preserve or explicitly reconcile it. Report “cannot verify freshness” when no current shared reference exists; do not manufacture certainty from a local stamp.

**Acceptance criteria.** A fresh pack, stale pack, unavailable reference, amended contract, and re-merge after amendment all produce distinct correct outcomes. Updating a pack does not falsely claim a contract amendment occurred. An agreed change updates prose and types together and removes the prior drift finding. An unagreed change remains visibly pending, consistent with the skill's existing policy. Conflicting amendment histories produce an actionable conflict rather than silently choosing the last prose paragraph.

## P1 — Prove type integration and correct its limits

**Evidence.** Merge verifies only `npx tsc --noEmit grill/contract.ts` (`skills/merge-contract/SKILL.md:88`); amend repeats that command (`skills/amend-contract/SKILL.md:42`). This shows at most that the generated file compiles under that invocation, not that producer/consumer code uses it. TypeScript documents that passing input files ignores `tsconfig.json`; checking the real project's command/config is therefore a separate requirement. [TypeScript CLI documentation](https://www.typescriptlang.org/docs/handbook/compiler-options.html).

The old plan's unconditional “False positives: Zero” and “the moment you save” claim (`plan.md:156`–`plan.md:164`) exceeds what types alone establish. TypeScript explicitly permits some unsound operations, and structural compatibility is not runtime response validation. [TypeScript type compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html).

**Upgrade.** Have merge discover the repo's existing typecheck/build workflow, verify the generated module within that configuration, and show minimal producer and consumer integration examples. Keep generated types dependency-light. Explain which constraints remain prose or runtime checks (auth, status/error behavior, numeric ranges, and untyped JSON boundaries). Do not automatically migrate the app to OpenAPI or a new validation framework just to improve this product.

**Acceptance criteria.** A checked-in sample TS project imports the generated types on both sides; a seeded field mismatch fails its project typecheck, and the correct implementation passes. A contract file with zero consumers is reported as unintegrated, not “enforced.” The skill separates pre-existing type errors from contract-related errors. A representative non-TS fixture still completes the prose workflow. Documentation describes compile-time coverage accurately.

## P1 — Verify agent discovery and publish a compatibility matrix

**Evidence.** Packs write the member launcher to `.claude/commands/` and all skills to `.claude/skills/` (`lib/pack.ts:194`, `lib/pack.ts:233`), while the persistent contract instructions live only in `AGENTS.md` (`lib/pack.ts:121`). The README broadly promises Claude Code, Cursor, and whatever agent a member already uses (`README.md:14`). The existing plan explicitly leaves second-agent verification open (`plan.md:443`, `plan.md:468`). Its claim that `.claude/skills` cannot work in Cursor (`plan.md:130`) is now outdated: current Cursor documentation lists compatibility loading from that directory. [Cursor skill directories](https://cursor.com/docs/skills#skill-directories).

Claude Code still supports `.claude/commands` but recommends skills for new reusable workflows. Its current `AGENTS.md` support is version/configuration dependent: an existing project `CLAUDE.md` can take precedence; an `@AGENTS.md` import is the documented bridge where direct loading does not apply. These are reasons to test concrete installations, not to assert blanket incompatibility. [Claude skills](https://code.claude.com/docs/en/skills), [Claude project instructions](https://code.claude.com/docs/en/memory#agentsmd).

**Upgrade.** Retain `MY-ROLE.md` as the canonical member interview text. Add only thin agent-specific launch/discovery adapters where verified necessary. The Agent Skills standard already supports a `SKILL.md` with `name` and `description`; a member launcher skill can delegate to the same Markdown, without creating a second grilling implementation. Preserve existing instruction files when adding any adapter. [Agent Skills specification](https://agentskills.io/specification).

**Acceptance criteria.** Document tested agent versions and the exact working invocation for host, member, check, and amend. Test new repositories and repositories that already contain instruction files. Each claimed tool discovers or can explicitly read the intended skill and obeys the contract on a fresh session. Validate basic skill frontmatter. Keep the plain “read `grill/MY-ROLE.md` and follow it” fallback. Adapter installation must be idempotent and preserve user instructions. Cross-agent support is a measured claim, not an inference from a file extension.

## P2 — Make check reports stable and auditable

**Evidence.** The check skill carries forward accepted markings by comparing the previous Markdown report (`skills/check-contract/SKILL.md:69`), with no stable finding or agreement identity. Rephrasing a finding or shifting line numbers can make it appear new or lose its accepted status. Missing implementations are meant to be findings (`skills/check-contract/SKILL.md:34`), but every finding is also required to cite a readable implementation file and line (`skills/check-contract/SKILL.md:47`), which is impossible for an absent file. The template could accidentally suppress the useful missing-file result.

**Upgrade.** Assign stable agreement/finding IDs and separate evidence from triage disposition. A minimal machine-readable sidecar is sufficient if needed; keep the Markdown report human-readable. For absent files, cite the contract clause and the missing path. Revalidate an accepted finding when its agreement or evidence materially changes. Record check scope, unverified clauses, and commands run, so “no findings” cannot be mistaken for complete coverage.

**Acceptance criteria.** A line-number-only change keeps a prior accepted disposition; a different violation on the same line is new. An unchanged contract/check preserves IDs. A missing implementation is reported with contract evidence. The report distinguishes checked-clean from unverified. Add a deterministic local check command for structural gates before considering optional Git hooks or CI; no remote LLM service is needed.

## P3 — Optional expansion after the reliability evidence

- Stub/mock generation, non-TS schema generators, and richer room templates can follow repeated demand. They do not fix the current validator or evaluation gaps.
- A remote model-backed service, accounts, real-time spec collaboration, and analytics ingestion would change the explicit architecture (`plan.md:13`, `plan.md:35`, `plan.md:76`). They are not necessary upgrades for the stated product.
- Mandatory LLM pre-push/CI checks are premature until false-positive rate, privacy expectations, execution cost, and agent availability are measured. Deterministic local validation can ship earlier.

## Suggested sequence

1. Correct the spec gate and add the fixture corpus; prepare the behavioral evaluation fixtures in parallel.
2. Repair the host merge prerequisites and explicit roster; run the first clean/seeded end-to-end agent evaluations.
3. Correct amendment/revision semantics and actual TypeScript consumer checks; rerun affected evaluations.
4. Verify the second agent, document the supported matrix, and collect one real team pilot before optional product expansion.

The web/deployment/security/dependency audits are separate. This report does not certify deployment readiness or recommend postponing security blockers.
