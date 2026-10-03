# Corrected Claude evaluation completion — 2026-10-02

The explicitly authorized corrected Claude matrix stopped on a real weekly account quota error at Database write, call 6/14. **No retry or quota workaround was attempted.** Frontend and Backend complete and pass the reviewed member criteria. Database writes and passes its actual gate, but exits 1 without a successful final handoff. Auth, QA and all four drift checks remain unattempted, so the release-quality gate stays open.

## Delivered evidence

The separate [corrected population and grades](../evals/runs/2026-10-02/claude-corrected-matrix/grades.md) preserves exact prompts, frozen inputs/source hashes, selected tool/results/assistant events, three first/final artifacts, actual gates and deterministic outcomes. [Preflight](../evals/runs/2026-10-02/claude-corrected-matrix/preflight.json) records all nine successful setups, eight installed receipts and four fresh/no-pending canonical statuses. [Verification](../evals/runs/2026-10-02/claude-corrected-matrix/verification.json) distinguishes five successful invocations from one failed invocation. The [previous full current matrix](2026-10-02-claude-current-matrix.md) and older evidence are unchanged.

Literal checkout `dd744649c044b306056e0899c52022e4c92a6aab` has evaluated sources identical to `9be59e4deabf87e59185e0000cf55bf61cbaa592`. All 24 exact hashes match the independently frozen corrected Codex population. Before any call, one runner file's 311 CRLF sequences were aligned to verified LF bytes; normalized code and Git diff were identical. This materialization note is preserved, with no semantic source/prompt/fixture or global Git configuration change and no mid-run normalization.

Environment: Windows, Node 24.21.0 and Claude Code 2.1.274 with existing first-party Max authentication. Runtime events identify `claude-opus-5[1m]` / `claude-opus-5`; no model was selected by the runner. Duration was 6 minutes 16.649 seconds, October 3 01:59:23.029–02:05:39.678 UTC / October 2 local. Unchanged limits were 120 seconds / 2 MiB per call, 14 calls / 30 minutes and estimated USD 1 per Claude call. Runtime cost estimate totals USD 1.645177; this is not subscription-billing evidence.

## Observed result and limitation

| Measurement | Corrected Claude result |
| --- | --- |
| Completed member cases | Frontend and Backend, 2/5 planned |
| Authored first/final structures and real gates | 3/3 observed, including incomplete Database |
| Database final invocation | Weekly quota error after gate success; exit 1, no successful final handoff |
| Other cases | Auth, QA, three clean checks and seed unattempted |
| Protected files / observed read scope | All six attempted traces fixture-local, protected inputs unchanged |

Frontend keeps module scope, placement, reload mechanism and return shape unresolved while preserving respondent behavior. Backend now leaves GET status, initial-close status, request body and pagination unresolved; observed code and unanswered direct-SQL recommendation do not become approvals. Pending requests remain separate from teammate agreement.

Database's partial artifact preserves the table/default, exact UPDATE, write ownership, migrations and unknown indexes/auth. A provenance sentence incorrectly attributes `$1`/`TRUE`/`BOOLEAN` to its interview question; the actual UPDATE was supplied by the respondent. Retain that caveat and inaccurate citations rather than treating a structural pass as a perfect content or completed-handoff claim. Its exact Node gate returned `ok: true` before the genuine quota failure.

Corrected drift fixtures use accurate projected row typing verified by a real consuming TypeScript regression during setup. No Claude clean/seed call reached them in this batch. Older frozen defective clean fixtures cannot supply the corrected clean numerator, and separate Codex results cannot substitute for this agent's missing cases.

## Validation and follow-up

Focused fixture/process/sanitizer setup checks passed (17 passed, one optional alternate-drive skip), and TypeScript typecheck passed after drafting the report. All nine fixture constructions succeed and all 24 source hashes remain frozen. The new stopped evidence was sanitized; 23 files including preflight were scanned with zero U+FFFD, private paths/account IDs or private quota-reset timing. Actual weekly-limit category and failed invocation remain with pre-redaction hash/byte provenance. The independent reviewer inspected all six attempted traces. This measures observed fixture compliance, not OS confinement, native editor discovery or public HTTP onboarding.

Resume evaluation only as a separately recorded bounded population when account access permits and a new run is authorized; never silently continue or overwrite this stopped record. A complete same-source role/clean/seed matrix, the consenting 3–5-person pilot and actual publication/deployment remain open. This completion document records the finished measurement and its external quota limitation in literal `doc/`.
