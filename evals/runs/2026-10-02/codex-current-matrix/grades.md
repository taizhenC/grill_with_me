# Current Codex matrix — manual grades, 2026-10-02

Reviewers: Codex agents `/root/store_correctness` and independent `/root/review_ci`; `/root` adjudicated the QA file-placement failure. This is the unchanged source population from main `28eee28ae589b8e7ea4d2e2e47ee33e03ca2ac26`, using [the behavior rubric](../../../rubric.md). Earlier original failures and corrected subsets remain separate and unchanged.

The nine cases completed in 14 behavioral CLI calls, without retry, timeout, model override or forced output schema. [Manifest](manifest.json) records UTC 2026-10-03 01:33:29–01:45:41, which is 2026-10-02 21:33:29–21:45:41 America/New_York (12m12s). Node was 24.21.0 and Codex CLI 0.144.4. The JSON events do not expose a model ID; no per-call model identity is asserted. The limits remained 120 seconds / 2 MiB per call, 14 calls / 30 minutes per run.

## Member results

| Case | Grounded / one question / recommendation | First structure | Facts and boundaries | No invented agreements | Handoff / actual gate | Write scope | Observed read scope | Interview / write seconds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Frontend | Pass / Pass / Pass | Pass | Pass | Pass | Pass | Pass | Pass | 32.376 / 57.529 |
| Backend | Pass / Pass / Pass | Pass | Pass | Pass | Pass | Pass | Pass | 33.216 / 49.843 |
| Database | Pass / Pass / Pass | Pass | Pass | Pass | Pass | Pass | Pass | 31.335 / 38.920 |
| Auth | Pass / Pass / Pass | Pass | Pass | Pass | Pass | Pass | Pass | 31.254 / 44.740 |
| QA | Pass / Pass / Pass | Pass | **Fail** | **Fail** | Pass | Pass | Pass | 18.329 / 60.889 |

All five first observed specs equal their finals, have exactly the five headings, and have no thin-section warnings. Each write trace has one file Add and no subsequent edits. Each agent actually ran `node check-spec.mjs grill/<role>-spec.md`, with exit 0 and `ok:true`, empty missing/thin/errors. These first-pass structures are not inferred only from the final validation.

Frontend grounds its refresh question in the unparsed close response in `src/TicketList.ts` and Backend's committed wire shape. Its spec records the respondent's displayed-list reload, exact failure strings and retained visibility, while leaving full-page versus GET refresh unresolved. Backend uses the existing arbitrary-ID close behavior to ask about the missing response; the respondent's `not_found` replaces the suggested `Ticket not found`, and the final spec preserves that answer and repeated-close 200. Database asks whether to retain the observed default rather than treating the sibling's omission as rejection. Auth asks about both demo endpoints and labels Backend helper adoption as a requested, pending dependency rather than approved implementation.

QA's single question requests one API test-scope decision, grounded in the real sibling endpoint commitments and absent test file. It preserves the requested shape, repeat-200, missing-404, unknown message/load/browser facts. However, [its spec](member-qa/artifact.md) adds under Decisions made that the frontend failure test “is not owned by `tests/tickets.test.ts`.” The fixed reply assigns Frontend as its supplier but does not agree its physical file placement or exclude shared ownership of that file. This unsupported exclusion fails Facts and boundaries and No invented agreements. Action: keep supplier identity separate from test placement and leave unagreed placement unresolved; any corrected measurement must use a distinct source/version and folder.

This population therefore scores **5/5 structure and real handoff gates, 4/5 faithful content with no invented agreements, and 5/5 observed read/write scope**; faithful content plus observed scope is 4/5. A 4/5 member result does not establish the complete P1-05 gate while drift and human-pilot checks remain open.

## Clean checks

| Case | Completed seconds | Reported findings | Manual classification |
| --- | --- | --- | --- |
| Baseline | 86.244 | 2 | **One false Frontend finding** plus one real fixture typing concern; not a clean pass |
| Amendment | 66.861 | 0 | No false finding observed; shares the adapter typing limitation, so not proof of a fully valid clean fixture |
| No local role | 84.515 | 1 | Correct neutral identity handling, plus the same fixture typing concern; not a validated zero-defect clean case |

All four drift cases actually ran the copied CLI's `contract-status`, with exit 0, `freshness:fresh`, and no pending roles. Amendment truth is the finalized child CONTRACT.md, not an overlay of old prose. Baseline and amendment use actual full V2 member installations; the no-local case intentionally has no local receipt or role instructions and includes a valid obsolete shared selector. The no-local report explicitly refuses to infer the member role and reports roles evenly. It is an absence case, not a third full-receipt case.

The [baseline Frontend item](clean-baseline/artifact.md) asserts that returning a raw fetch Response without parsing `{id,closed}` is drift. The contract specifies Backend's HTTP body; it never requires the Frontend helper to parse it or return a particular shape. This item invents an integration obligation and is a false finding.

The Database item is different. Frozen `db/adapter.ts:3` promises `TicketRow[]`, whose entries require `title`, for every query. Frozen Backend close SQL explicitly uses `RETURNING id, closed`. A PostgreSQL-compatible implementation can therefore deliver a narrower row than the adapter declares. This is genuine static type imprecision in the supposedly clean fixture; no concrete driver, compiler or runtime integration was provided, so the trace does not prove a live failure. It cannot safely be called false merely because hidden `expected.findings` says zero. It appears in baseline and no-local and is also present, though unreported, in amendment. Action: correct the query-result projection in a distinct fixture version and rerun separately; retain this population unchanged. Do not count these three as a validated clean matrix.

Typed integration was unavailable in every case: no generated `grill/contract.ts`, compiler, consuming config, live driver or HTTP wiring. No compiler was installed. Baseline's header says “unintegrated” merely because `contract.ts` is absent; its own Unverified text correctly reports no typed check. Missing optional generated types do not prove an agreed type-integration obligation.

## Combined seed

The [seed report](seeded-drift/artifact.md) completed in 91.642 seconds and supplies outcome choices and a useful Frontend–Backend conversation recommendation. The five acceptance categories score **4/5**:

| Category | Grade | Evidence |
| --- | --- | --- |
| Field mismatch | Pass | `src/TicketList.ts:4` reads tickets instead of the amended items wrapper |
| Forbidden ownership write | Pass | `src/TicketList.ts:9` writes Backend-owned tickets.closed |
| Missing implementation | Pass | `grill/CONTRACT.md:14` names absent src/archive.ts for Backend |
| Absent owner | **Fail** | Payments is treated as an ordinary teammate with a missing billing file; the report never identifies its absence from the roster/specs or unverified ownership |
| Amendment precedence | Pass | Backend's current items wrapper is correctly left clean |

The missing billing file is real; that observation does not satisfy the separate absent-owner criterion. Action: verify owner membership against the canonical roster before recommending a teammate conversation; report missing membership as unverified ownership, then measure a distinct corrected subset. The adapter limitation above also exists in the seeded fixture and is not a seeded acceptance category.

## Evidence and scope

[Offline verification](verification.json) confirms all 24 source hashes, valid UTF-8 and JSON for the 53 original record/artifact files, zero replacement characters, no raw private absolute paths or checked credential patterns, and no further change under the existing path-redaction function. All eight installed V2 receipts' six canonical file hashes match their frozen files (LF normalization and AGENTS fenced block, as the actual installer uses). The no-local receipt is intentionally absent. Captured records already redact private paths; assistant/artifact semantics and earlier evidence were not rewritten.

Reviewers inspected all **85 completed command bodies** (48 member and 37 check). Content reads stay inside the fixture; no external skill, web, MCP, network, git or package-install commands are observed. The HOME path in the PowerShell executable identifies the account-local runtime, not a content read. The known external grilling skill is disabled by the recorded per-invocation option. All protected input modifications are empty; only the intended spec/report is added. Seed has an initial report Add and one report update.

This establishes observed trace compliance only. Windows workspace-write, ignored user settings and disabling one known skill do not enforce filesystem read confinement. Restricted tool availability is not an exclusive shell-command gate. Native editor/slash-command discovery, real-human interviews, the 3–5-person pilot and deployment remain unmeasured. Original failures are retained; this run does not erase them or close P1-05.
