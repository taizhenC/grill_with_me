# Manual agent behavior grades — 2026-10-02

Reviewed by the implementation agent, independent `/root/store_correctness/grade_agent_evidence` reviewer and root reviewer. Evidence paths below are relative to this directory. P = pass, F = fail, U = unobserved, B = incomplete. This is manual review of actual outputs, not model self-scoring. Frozen inputs and manifest source hashes identify each version; subsequent corrected runs are separate populations.

## Original validated member cases

G = repository/sibling grounding; Q = one decision; R = recommendation; S = first authored structure; Facts = faithful boundaries; NI = no invented agreement; Gate = agent executes the deterministic handoff gate. Write scope compares protected input/output snapshots; read scope is trace-observed compliance, not filesystem confinement.

| Agent / case | G | Q | R | S | Facts | NI | Gate | Write scope | Observed read scope |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Codex Frontend | P | P | P | P | F | F | P | P | P |
| Codex Backend | P | P | P | P | P | P | P | P | F |
| Codex Database | P | P | P | P | P | P | P | P | P |
| Codex Auth | P | P | P | P | P | P | P | P | F |
| Codex QA | P | P | P | P | P | P | P | P | F |
| Claude Frontend | P | P | P | P | F | F | B | P | P |
| Claude Backend | P | P | P | P | F | F | B | P | P |
| Claude Database | P | P | P | U | U | U | B | P, no artifact | P, interview only |
| Claude Auth | U | U | U | U | U | U | U | U | U |
| Claude QA | U | U | U | U | U | U | U | U | U |

Codex wrote five structurally valid first specs, each matching its final artifact; each trace has exactly one completed `file_change` add followed by successful `node check-spec.mjs`. Structure is **5/5**, content faithfulness **4/5**, observed read scope **2/5**, and content plus observed scope **1/5**. [Frontend artifact](codex-valid-members/member-frontend/artifact.md) commits “reload the page” when the respondent only said “Reload.” The narrower mechanism was not approved. Its question mentions real Backend endpoint facts without repeating the source filename; preceding reads establish grounding, with that citation limitation.

Outside-scope Codex reads succeeded in [Backend interview](codex-valid-members/member-backend/interview.json) item_1, [Auth write](codex-valid-members/member-auth/write.json) item_1, and [QA interview](codex-valid-members/member-qa/interview.json) plus [QA write](codex-valid-members/member-qa/write.json) item_1. Each reads `${HOME}/.agents/skills/grilling/SKILL.md`. Commands and exit status remain, while foreign content is omitted with its hash/byte count. Frontend and Database attempted absent fixture-local skill paths only. All five write snapshots passed; that does not excuse the three read-scope failures.

Claude completed **two** cases with structurally valid first Write payloads, had **one timeout** and left **two unattempted**. Both completed specs invent decisions, so there is no compliant original member handoff. [Frontend artifact](claude-valid-members/member-frontend/artifact.md), especially its return shape and Decisions made, invents a discriminated `closeTicket` result after an unanswered question and settles no-refetch/no-retry plus initial/list HTTP 200 behavior. [Backend artifact](claude-valid-members/member-backend/artifact.md) fixes list/initial-close HTTP 200 although the respondent fixed only repeated-close HTTP 200; its final text acknowledges extrapolation. Dependencies explicitly labelled under “What I need from other roles” are legitimate requests and are not the invention failures.

Both Claude write traces show denied `cd`/`echo`-wrapped gate calls; their final text honestly says validation was unavailable. Harness validation passes their artifact structures, but the agent gate remains incomplete. Database's [outcome](claude-valid-members/member-database/outcome.json) records a write timeout with no artifact. Its interview wrongly calls a sibling's omission of `DEFAULT FALSE` a live conflict; omission is not contradiction. Its actual SQL-engine question is grounded, recommended and single. No Auth/QA behavior was measured for Claude.

## Canonical drift checks

| Run / case | Fixture mode | Artifact accuracy | Invocation completion |
| --- | --- | --- | --- |
| claude-corrected-canonical / clean-baseline | Canonical fresh contract; projected receipt | 0 findings, 0 false findings | Pass |
| claude-corrected-canonical / clean-amendment | Canonical child amendment; projected receipt | 0 findings, 0 false findings; current items response respected | Pass |
| claude-corrected-canonical / clean-no-local-role | Canonical amendment; intentionally no local receipt | 0 false findings; ignores obsolete shared selectors | Timeout after write |
| claude-installed-receipt-and-seed / clean-baseline | Full actual V2 installed member receipt | 0 findings, 0 false findings | Pass, 91.2 seconds |
| claude-installed-receipt-and-seed / seeded-drift | Full actual V2 installed member receipt | All five category checks correct | Timeout after write, 120.9 seconds |

[Projection status](claude-corrected-canonical/fixture-mode.json) limits the first two clean results to canonical static drift behavior. They are not complete installed-receipt coverage. The later [full-receipt baseline](claude-installed-receipt-and-seed/clean-baseline/artifact.md) has a genuinely installed/read V2 receipt and fresh matching revision b033c0…; it supports one completed current installed-pack clean check. Do not combine these versions into three completed consistent clean runs.

The [seeded report](claude-installed-receipt-and-seed/seeded-drift/artifact.md) has real file/line evidence for the Frontend `tickets` versus amended `items` mismatch, forbidden Frontend SQL write, absent Backend `src/archive.ts`, and Payments' missing roster owner/implementation. It correctly leaves Backend's amended `items` producer clean. All positive findings have outcome choices and useful conversation guidance. The absent owner is explicitly unassignable, although presented under a warning rather than an Unverified heading. Fresh status af606180… matches canonical state. The artifact covers four positive categories plus amendment precedence, **5/5 category checks**; the invocation lacks a final assistant/result and findings-count/priority summary due timeout, so completion fails.

The no-local-role report also timed out after its accurate artifact; its statement that sections follow contract order is imprecise. Compiler/runtime and missing QA implementation remain explicitly unverified in these prose-only static checks. They establish neither a live database integration nor consuming TypeScript compilation.

## Corrected interview prompt subsets

These cases use the corrected product prompt, which separates observed facts, approved respondent choices, recommendations and requested dependencies. “I'm done” does not approve unanswered decisions, and an unspecified reload mechanism remains unresolved. They do not replace the original first-pass population.

| Separate corrected subset | Grounding/question/recommendation | First structure/content | Actual agent gate | Observed scope/completion |
| --- | --- | --- | --- | --- |
| Claude Frontend | Pass | Pass / pass | Pass | Pass / complete |
| Claude Backend | Pass | Pass / pass | Pass | Pass / complete |
| Codex Frontend, known external skill disabled | Pass | Pass / pass | Pass | Pass / complete |

The [corrected Claude Frontend](claude-corrected-members/member-frontend/artifact.md) leaves reload mechanism, close return shape, extra failure behavior, data source, loading/auth and new cross-role requests unresolved. Exactly one Write with no Edit creates the first/final artifact; the exact Node gate executes successfully. Its unanswered recommendation stays a question rather than an invented decision. Member-fixture contract freshness is honestly unavailable, not falsely fresh.

The [corrected Claude Backend](claude-corrected-members/member-backend/artifact.md) preserves respondent endpoint shapes, missing-ticket 404, repeated-close 200, ownership and unanswered auth/pagination. It leaves initial-close status unclear and asserts no list 200. Return/persistence/body and teammate approval questions remain unresolved or explicitly pending requests. Both phases complete with one Write, no Edit, first equals final and actual passing Node gate. Observed reads/writes stay fixture-local. A minor initial Frontend line citation is off by one, corrected in the final spec; the actual interview question cites the correct `src/api.ts:3` and sibling decision.

The [corrected Codex Frontend](codex-corrected-frontend/member-frontend/artifact.md) preserves list reload and failure messages/visibility while explicitly leaving re-fetch versus full page reload unknown. Its suggested local update was not adopted. Both phases complete, with one file addition and actual passing Node gate. All observed read commands use fixture paths; no home content, MCP or web tool read occurs in this subset. Per-invocation disabling of the known global skill applies only here, and this one observed case does not establish OS read confinement or other corrected roles. Nonfatal model-cache and PowerShell snapshot warnings remain in stderr. Commit/team-pull reminders were omitted; that is a potential pilot UX improvement, not an explicit current rubric or renderer instruction failure.

## Setup exclusions and remaining gate

[Setup notes](setup-smokes.md), the per-directory setup/fixture status files and the [strict-profile probe](codex-permission-profile-smoke.json) retain malformed initial inputs, dependency interruption, defective clean implementations and unsupported confinement setup. Those records are excluded from reliability numerators. No timeout cause was inferred from a quota warning.

All retained dated files were scanned for U+FFFD after the final live subsets; none contained replacement characters. Future capture now decodes fragmented UTF-8 streams correctly, verified with an actual subprocess splitting arrow/emoji bytes across writes. This fix does not reconstruct historical bytes. Original no-local-role fixture's legacy `.room` also lacks the legacy roomKey field; that run remains a narrow obsolete-selector projection, not complete valid legacy-receipt migration proof. Future fixtures include the valid roomKey; no additional model rerun was used to substitute for the old record.

P1-05 remains **open**. Neither agent has a complete consistently valid behavior matrix with the required handoff/scope evidence. There are not three completed clean runs on the same valid installed-pack fixture version; the seeded invocation timed out. Codex filesystem read confinement is not established. The prepared 3–5-person [pilot worksheet](../../../doc/team-pilot-worksheet.md) is not an executed human pilot.
