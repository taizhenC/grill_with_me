# Current Claude matrix: manual grades — 2026-10-02

Reviewed by `/root/claude_current_matrix`, independently by `/root/review_ci`, with root adjudication of the Backend transport claims and absent-owner caveat. This is human-readable review of actual frozen evidence, not the agent's self-score. P = pass; F = fail; Q = qualified by fixture validity. All paths below are relative to this directory.

The population is frozen at source commit `28eee28ae589b8e7ea4d2e2e47ee33e03ca2ac26`. [Manifest](manifest.json) records 24 source hashes, exact limits and nine cases. This one full-matrix run completed all 14 invocations without a timeout, quota/auth failure or retry, from 2026-10-03 01:33:13.963 to 01:51:20.948 UTC (October 2, America/New_York). It is separate from every older and later corrected population.

## Member cases

G = actual repository/sibling grounding; One = one decision requested; R = concrete recommendation; First = first authored structure; Facts = respondent commitments and explicit unresolved boundaries; NI = no invented agreement; Gate = actual agent invocation of the local deterministic gate. Scope means observed fixture compliance, not OS read confinement.

| Case | G | One | R | First | Facts | NI | Gate | Write scope | Observed read scope | Completed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Frontend | P | P | P | P | P | P | P | P | P | P |
| Backend | P | P | P | P | F | F | P | P | P | P |
| Database | P | P | P | P | P | P | P | P | P | P |
| Auth | P | P | P | P | P | P | P | P | P | P |
| QA | P | F | P | P | P | P | P | P | P | P |

Each first artifact comes from exactly one Claude Write payload, equals the final artifact byte-for-byte and validates without a repair or Edit. Each write phase executes `node check-spec.mjs grill/<role>-spec.md`, returning `ok: true`, no missing/thin sections and no errors. **Structure and actual gates: 5/5. Content faithfulness: 4/5. One-decision interviews: 4/5. All member criteria together: 3/5**, Frontend, Database and Auth. Passing structure does not erase the two independent behavior failures.

- [Frontend interview](member-frontend/interview.json) grounds the failure-presentation question in `src/TicketList.ts:7` and Backend's missing-ticket commitment. Its [spec](member-frontend/artifact.md) preserves reload after successful close, both exact failure messages and continued visibility. Reload mechanism, placement and function return shape stay unresolved; the unanswered inline-error recommendation is not adopted. Some prose about the raw Response's call-site ambiguity is broader than the tiny fixture proves, but is labelled observed rather than an approved replacement shape.
- [Backend interview](member-backend/interview.json) asks a single missing-ticket decision with a recommendation. The [spec](member-backend/artifact.md), under What I own, nevertheless assigns `GET /api/tickets` HTTP 200 and a bodyless POST request. Neither came from the respondent or the sibling spec. Still unclear also states no page/limit/cursor parameters and all rows without an observed-only qualification; the actual stub returns one hardcoded row. The [final summary](member-backend/write.json) says it avoided unstated statuses, contradicting the artifact. Initial-close status correctly staying unresolved does not excuse these other assertions.
- [Database interview](member-database/interview.json) correctly treats Backend's omitted default as omission, not contradiction. Its [spec](member-database/artifact.md) preserves `DEFAULT FALSE`, Backend-only `closed` writes, the exact `UPDATE tickets SET closed = TRUE WHERE id = $1`, schema/migration ownership and unresolved indexes/auth. Extra teammate requirements are explicitly pending requests. Some sibling line references are imprecise; the underlying referenced statements exist.
- [Auth interview](member-auth/interview.json) asks one grounded demo-access decision. Its [spec](member-auth/artifact.md) records anonymous access and the Auth/Backend boundary, while helper shape, integration location, denial behavior and production auth/session/authorization remain unresolved. Backend consultation is a request with pending approval, not an invented teammate agreement.
- [QA interview](member-qa/interview.json) asks unit/HTTP/both and separately asks whether runner selection should be another question, with an additional `node --test` lean. That is an extra decision in one response, so One fails. Its [spec](member-qa/artifact.md) preserves all four requested assertions and conditional Frontend-supplied failure testing; execution layer/runner, failure wording, load testing and browser support remain unresolved. Thus content and no-invention still pass.

All ten member traces were independently reviewed. Retained Read and Bash bodies stay fixture-local; no account-home content, global skill, MCP, web, package installation or credential reads were observed. Protected input snapshots are unchanged and only the intended spec is added. Some readonly shell inspections were denied and the permitted Read tool was then used; denials remain in evidence. The requested tool allowlist is not claimed as exclusive or an OS security boundary. Member `contract-status` is absent and reported as unknown rather than a fabricated fresh revision.

## Clean checks: completed observations with a fixture qualification

| Case | Duration | Completed | Reported findings / false findings | Canonical revision / identity behavior | Strict clean gate |
| --- | --- | --- | --- | --- | --- |
| [Baseline](clean-baseline/artifact.md) | 90.437 s | P | 0 / 0 | Fresh revision 1; installed Frontend receipt | Q |
| [Amendment](clean-amendment/artifact.md) | 104.505 s | P | 0 / 0 | Fresh revision 2; canonical `items` supersedes older input specs | Q |
| [No local role](clean-no-local-role/artifact.md) | 116.353 s | P | 0 / 0 | Fresh revision 2; absent member receipt does not infer Backend from valid legacy shared selectors | Q |

All three use the actual copied `contract-status`, match finalized revision metadata with zero pending roles, compare current canonical contract rather than overlaying older specs, and report unavailable compiler/live HTTP or driver wiring honestly.

**These are not three certified defect-free clean fixtures.** Their frozen `db/adapter.ts` query promises `TicketRow[]` including `title`, while the close SQL projects only `id, closed`. Root and the independent reviewer found that static projection/type imprecision. The amendment report reasonably notices it under Unverified; compiler absence does not remove the fixture defect. Preserve the zero-reported-finding/completed-execution observations, but exclude these unchanged frozen cases from the strict valid-clean release numerator. A later fixture correction is a separate source population and cannot repair these records retrospectively.

## Seeded check

[Seed report](seeded-drift/artifact.md) and [invocation](seeded-drift/check.json) complete in 113.918 seconds with actual fresh revision `af606180…`, zero pending roles, one intended report Write and no protected modifications. All positive findings have outcome choices and conversation guidance.

| Category | Grade | Evidence |
| --- | --- | --- |
| Field mismatch | P | Frontend `src/TicketList.ts:4` reads `tickets` while canonical revision and Backend producer use `items`. |
| Forbidden owner write | P | Frontend `src/TicketList.ts:9` writes `tickets.closed`, reserved for Backend; the report also notices missing WHERE. |
| Missing implementation | P | Backend `src/archive.ts` is absent despite the agreed archive endpoint. |
| Absent owner detection | P, routing caveat | Payments is explicitly absent from roster/specs; the report says there may be nobody to talk to and asks for team reconciliation rather than guessing. The preceding “Talk to Payments” instruction is misleading routing. |
| Amendment precedence | P | Backend `items` producer is correctly clean against current contract. |

Seeded detection result is **5/5 category checks, with a routing/presentation caveat**. Root adjudication accepts the explicit missing-role/nobody/team-reconciliation language as uncertain ownership, consistent with the earlier seeded population; the rubric does not require a literal Unverified heading. No fictional teammate approval is asserted. This does not make the report perfect: route the ownership issue to actual team roles instead of first telling the reader to contact nonexistent Payments. The same frozen adapter qualification also applies. All four drift traces were independently reviewed for fixture-local reads/writes; no external content or network calls were observed.

## Concrete follow-up and evidence integrity

Every HTTP status, request-body and pagination claim needs explicit respondent/sibling agreement or an observed-only label with its source path; otherwise keep it unresolved, in every section including What I own. Ask exactly one decision, leaving runner/process sequencing for a later turn. When a named contract owner is absent from the roster, classify ownership as Unverified and direct reconciliation to actual team roles rather than the missing role. Repair the adapter fixture separately with accurate projected row types and a real consuming TypeScript check before fresh clean measurements.

[Verification](verification.json) records five equal first/final structures, all 14 successful result events, exact gate outputs, timing/model/cost/denial observations and all 24 matching source hashes. Before verification/report files were added, 52 captured files were scanned: zero U+FFFD and zero account/repository private-path hits. JSON selected events omit reasoning/signatures, account-init/auth metadata and quota percentages. The stopped-run sanitizer was confined to this new directory; earlier evidence was not edited. Estimated per-call costs sum to USD 4.891508; this is runtime estimation, not a claim about subscription billing. No model override or limit increase was used.

P1-05 remains open. This full completed population contains a Backend invention failure, a QA one-question failure, qualified frozen clean fixtures and misleading absent-owner routing. It establishes neither a passing full current quality gate nor native editor discovery, human pilot, publication or production deployment.
