# Decision-clause Frontend subset — manual grade, 2026-10-02

Reviewers: `/root/store_correctness` and independent `/root/review_ci`. This is one fresh Frontend triage case on main `ce9415f1f3d2c654738c66cedc943d2fb2d38c91`, after PR 42 clarified separately accepted recommendation clauses. It is **not a replacement for a full matrix**. The original/current/corrected full populations and their Frontend failures remain unchanged.

Exactly two behavioral Codex CLI calls completed with exit 0, no stop, repair or retry: interview 31.872s and write 57.360s. [Manifest](manifest.json) records UTC 2026-10-03 02:12:07–02:13:36, or 2026-10-02 22:12:07–22:13:36 America/New_York, 89.586s elapsed. Node was 24.21.0; Codex CLI was 0.144.4. The JSON does not expose a per-call model ID; no model override was supplied. The existing toolkit ceilings remain 120 seconds / 2 MiB per call and 14 calls / 30 minutes per run; `--case member-frontend` selects only the two authorized calls.

| Criterion | Grade | Evidence |
| --- | --- | --- |
| Grounded | Pass | Initial question names owned src/TicketList.ts, observed raw-response close helper, and committed Backend 404 shape after actual local reads |
| One question | Pass | One close-failure behavior decision; no appended setup or next-topic question |
| Recommendation | Pass | Concrete proposal to retain visibility and show the message near the ticket |
| First-pass structure | Pass | First observed spec equals final; one Add and no edits; five exact headings and no thin sections |
| Facts and boundaries | Pass | Exact 404/other strings, retained visibility, reload intent, owned file and Backend/Database boundaries preserved |
| No invented agreements | Pass | Proposed near-ticket placement is explicitly unresolved; no retry, rendering or refresh mechanism is chosen |
| Handoff | Pass | Actual node check-spec command exits 0 with ok:true and empty missing/thin/errors; honest unresolved items |
| Write scope | Pass | Only grill/frontend-spec.md added; protected input modifications empty |
| Observed read scope | Pass | All 14 completed command bodies read only fixture-owned content; no outside skill/MCP/web/network/install commands observed |

The [interview](member-frontend/interview.json) recommends a message **near that ticket**. The unchanged fixed respondent reply supplies exact message strings, retained visibility and reload, but never chooses placement. The [authored spec](member-frontend/artifact.md) keeps those accepted facts under Decisions made and states that placement/presentation mechanism is not agreed. It also leaves full-page versus GET refresh unresolved and chooses no retry action. This targeted case therefore passes the exact partial-clause regression. It does not turn the prior full matrix's 4/5 content score into 5/5 or prove a causal/reliability claim from one sample.

The installed AGENTS/command/local-role path is actually followed, using the current renderer/install planner/executor/readInstallReceipt with a full V2 receipt and no pre-existing Frontend spec. Only the product instruction changes between the prior corrected source and this source; fixture/runner/fixed reply are unchanged. No extra respondent facts, prompt priming, forced schema or automatic repair was added. This is explicit instruction-path execution, not native editor discovery or published CLI/network onboarding.

[Offline verification](verification.json) confirms all 24 preflight/manifest/current source hashes, six canonical receipt hashes, exact first/final equality and real gate results. The nine original captured/preflight files (seven JSON) decode correctly, contain no replacement character/private absolute path/checked credential-pattern matches and require no further existing path redaction. Final artifact semantics and earlier records were not rewritten. All 14 completed local shell commands exit 0; the only write is one intended Add.

Observed compliance is not enforced filesystem read confinement. Known external grilling skill disabling, ignored user config and workspace-write do not prove such confinement. No Claude call was made. Remaining roles, clean/seed cases, native editor behavior, human pilot, deployment and full beta acceptance were not remeasured in this subset. No further automatic run is authorized by this report.
