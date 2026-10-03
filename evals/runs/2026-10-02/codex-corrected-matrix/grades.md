# Corrected Codex matrix — manual grades, 2026-10-02

Reviewers: `/root/store_correctness` and independent `/root/review_ci`; `/root` confirmed the Frontend content failure and baseline coverage qualification. This population uses frozen main `9be59e4deabf87e59185e0000cf55bf61cbaa592` and [the behavior rubric](../../../rubric.md). Its member instructions, check skill and query projections include the corrections from PRs 36, 37 and 39. Earlier original, subset and current-matrix evidence is unchanged; scores are not mixed across source versions.

All nine cases completed in **14 behavioral CLI calls** without retry, timeout, model override, forced schema or mid-run edits. [Manifest](manifest.json) records UTC 2026-10-03 01:54:29–02:07:15, or 2026-10-02 21:54:29–22:07:15 America/New_York: 12m45s. Node was 24.21.0 and Codex CLI 0.144.4. Selected JSON events do not expose a model ID; no per-call model identity is asserted. Limits stayed 120 seconds / 2 MiB per call and 14 calls / 30 minutes per run. Authentication was checked without recording account details. All nine setups passed before model invocation.

## Members

| Case | Grounded / one question / recommendation | First structure | Facts and boundaries | No invented agreements | Handoff / actual gate | Write scope | Observed read scope | Interview / write seconds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Frontend | Pass / Pass / Pass | Pass | **Fail** | **Fail** | Pass | Pass | Pass | 27.530 / 58.300 |
| Backend | Pass / Pass / Pass | Pass | Pass | Pass | Pass | Pass | Pass | 34.389 / 67.381 |
| Database | Pass / Pass / Pass | Pass | Pass | Pass | Pass | Pass | Pass | 25.833 / 50.567 |
| Auth | Pass / Pass / Pass | Pass | Pass | Pass | Pass | Pass | Pass | 25.120 / 48.587 |
| QA | Pass / Pass / Pass | Pass | Pass | Pass | Pass | Pass | Pass | 29.245 / 67.600 |

All five first observed artifacts match their finals. Each trace has a single file Add and no edits, then an actual `node check-spec.mjs grill/<role>-spec.md` with exit 0, `ok:true` and empty missing/thin/errors. There is no structure-repair prompt or forced response schema. The five successful structures and gates do not conceal content failures.

Frontend's [initial question](member-frontend/interview.json) recommends showing errors “inline on that ticket.” The fixed respondent answers with exact messages, visibility and reload intent, but never explicitly chooses that placement. The [spec's Decisions made](member-frontend/artifact.md) nonetheless gives both failures inline placement on the ticket. That adopts an unanswered rendering recommendation and fails Facts and boundaries / No invented agreements. Reload mechanism, transport status/body, loading and authentication remain correctly unresolved. Action: keep placement as a recommendation or unresolved decision until explicitly accepted; any further correction requires a new source/run population, not replacement of this artifact.

Backend correctly uses the respondent's `not_found` rather than adopting the suggested `ticket_not_found`, and preserves repeat-200, success shapes and ownership. GET/first-close statuses, request body, authentication and pagination remain unresolved. Database retains the exact schema/default and SQL request while explicitly keeping teammate approval of sole-write/exact-SQL/no-Frontend-SQL dependencies pending; migration placement, additional indexes and auth stay unknown. Auth records only anonymous access to the two demo endpoints, preserves the observed stub as observed, and keeps helper signature/return shape/Backend adoption and production policy unresolved. QA now keeps Frontend supplier identity separate from unagreed test-file placement; it preserves the four assertions and unknown message/load/browser/transport/auth details without excluding the test from its owned file.

The corrected population scores **5/5 structure and actual handoff gates, 4/5 faithful content with no invented agreements, and 5/5 observed read/write scope**. Faithful content plus observed scope is 4/5. The remaining Frontend failure is retained despite satisfying the member gate's numerical 4/5 threshold.

## Clean checks

| Case | Completed seconds | Findings / false findings | Grade and qualification |
| --- | --- | --- | --- |
| Baseline | 56.006 | 0 / 0 | Zero-false metric Pass; uncertainty-reporting caveat below |
| Amendment | 94.303 | 0 / 0 | Pass; current items amendment respected; typed check unavailable |
| No local role | 80.692 | 0 / 0 | Pass; no obsolete selector inferred; wrong-format tool invocation below |

These fixtures now use a generic query result and explicit `Pick<TicketRow, "id" | "closed">` close projection, avoiding the old frozen adapter's full-row promise. The unchanged initial contract and finalized child amendment are fresh and fully agreed; each agent actually ran the copied canonical `contract-status` with exit 0 and no pending roles. Baseline and amendment use full installed V2 member receipts. No-local intentionally has no local receipt/instructions, carries a valid legacy shared selector and correctly reports roles evenly without inferring current identity. It is an explicit absence case, not a third full-receipt case. All three produce zero false drift on this valid corrected fixture population.

Baseline's header calls typed integration “not applicable” because optional `grill/contract.ts` is absent, and [its report](clean-baseline/artifact.md) says Unverified None. That does not claim a compiler ran, but omits the requested uncertainty record: the fixture has no compiler, live driver or HTTP wiring, and the frozen contract explicitly leaves wiring unagreed. Keep the zero-false metric Pass and this reporting/coverage limitation separate; no compiled/runtime integration pass is established. Amendment and no-local explicitly report the unavailable type check. Static inspection is not execution of producer/caller wiring.

No-local unnecessarily invokes `node check-spec.mjs grill/CHECK-REPORT.md`. The member-spec validator rejects this report's different heading format with exit 1. The agent then honestly explains the wrong-format invocation and does not claim validation passed or repair the report into a member spec. Preserve this extra workflow mistake; it does not manufacture drift or invalidate the actual fresh status. Baseline also retains an inspection command with exit 1 from endpoint/Paths search against missing optional test paths. All 14 **model CLI invocations** exited 0; not every local shell command succeeded.

## Combined seed

The [seed report](seeded-drift/artifact.md) completes in 95.416 seconds and passes **5/5 categories**:

| Category | Grade | Evidence |
| --- | --- | --- |
| Field mismatch | Pass | `src/TicketList.ts:4` reads body.tickets instead of the agreed current items wrapper |
| Forbidden ownership write | Pass | `src/TicketList.ts:9` writes Backend-owned tickets.closed |
| Missing implementation | Pass | `grill/CONTRACT.md:14` names absent src/archive.ts for Backend |
| Absent owner | Pass | `grill/CONTRACT.md:16` names Payments, absent from grill-room.json and contract Roles; missing billing implementation and unverified ownership are separately explained, with team reconciliation requested |
| Amendment precedence | Pass | Backend's current items response is correctly left clean |

The report supplies concrete clauses/file lines, outcome choices and a useful Frontend–Backend conversation recommendation. It does not invent a Payments teammate to contact. It leaves typed integration unavailable; no compiler is installed or invoked.

## Integrity, scope and remaining gates

[Verification](verification.json) confirms all 24 preflight/manifest/current source hashes, all eight full V2 receipt hash sets and five first/final artifacts. All 53 original captured/preflight files (39 JSON) decode as valid UTF-8; no replacement characters, raw private absolute paths, checked credential patterns or further path-redaction changes were found. Receipt hashes use the actual installer's canonical LF content and fenced AGENTS block. Captured assistant/artifact semantics and historical data were not rewritten.

Reviewers inspected all **73 completed command bodies**. They read fixture-owned content only; no outside skill-content, web, MCP, network, git or package installation is observed. HOME in the shell executable path identifies the account-local runtime, not a content read. Every case has one intended output Add, with no protected input modifications or other outputs. The known external grilling skill is disabled per invocation, but this is observed compliance, **not enforced filesystem read confinement**. Ignored user config and a workspace-write sandbox do not prove read confinement.

The three clean checks and all seed categories complete on one consistent corrected source population. The Frontend content failure and two reporting/tooling caveats remain visible. Native editor/slash-command discovery, real interviews, the 3–5-person human pilot, deployment and arbitrary-agent security are unmeasured. This report does not close the full public-beta/P1-05 gate or authorize another automatic run.
