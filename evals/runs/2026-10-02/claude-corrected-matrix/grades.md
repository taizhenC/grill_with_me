# Corrected Claude population: partial manual grades — 2026-10-02

Reviewed by `/root/claude_current_matrix` and independently by `/root/review_ci`. This is review of frozen outputs and actual tools/results, not model self-scoring. P = pass; F = fail; U = unattempted. Artifact measurements remain distinct from a completed agent handoff.

**The runner stopped on a genuine account weekly quota failure at Database write, call 6/14. No retry, timeout increase, model substitution or quota workaround followed.** Frontend and Backend complete; Database writes and validates an artifact but exits 1 with an error result and no successful final handoff. Auth, QA and all four drift cases are unattempted. This partial population cannot replace a full corrected matrix.

## Source and setup

Literal checkout is `dd744649c044b306056e0899c52022e4c92a6aab`; its evaluated runtime/skills/fixtures are identical to source `9be59e4deabf87e59185e0000cf55bf61cbaa592`. [Preflight](preflight.json) and [manifest](manifest.json) establish all 24 exact source hashes matching the independently frozen corrected Codex population. Only the runner's materialization differed initially: this fresh checkout had 311 CRLF sequences while the existing Codex runner had LF. Before any agent call, normalized text equality was verified, that one file was converted to the verified LF bytes, all 24 hashes matched, and Git diff was empty. No semantic source, prompt, fixture or global Git configuration change was made; no source normalization occurred during the run.

All nine fixture setups succeeded: eight actual installed receipts, and all four drift revision statuses fresh with zero pending roles. Corrected drift code uses a generic injected query driver and `Pick<TicketRow, "id" | "closed">` for the close projection. The real consumer regression in the focused setup checks passes; no clean/drift agent invocation was reached in this batch. Focused fixture/process/sanitizer checks: 17 passed, one optional alternate-drive skip.

Account-local environment: Windows, Node 24.21.0, Claude Code 2.1.274, existing first-party Max authentication. No model override; runtime init/assistant events identify `claude-opus-5[1m]` / `claude-opus-5`. UTC interval 2026-10-03 01:59:23.029–02:05:39.678 (October 2 local), 6 minutes 16.649 seconds. Unchanged ceilings: 14 calls / 30 minutes, 120 seconds / 2 MiB per call, Claude estimated USD 1 per call.

## Member criteria

G = real repository/sibling grounding; One = one decision requested; R = concrete recommendation; First = first authored structure; Facts = explicit respondent commitments/boundaries; NI = no invented agreement; Gate = actual exact local deterministic gate. Scope means observed compliance, not filesystem confinement.

| Case | G | One | R | First | Facts | NI | Gate | Write scope | Observed read scope | Completed handoff |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Frontend | P | P | P | P | P | P | P | P | P | P |
| Backend | P | P | P | P | P | P | P | P | P | P |
| Database, partial | P | P | P | P | P, provenance caveat | P | P | P | P | F, weekly quota |
| Auth | U | U | U | U | U | U | U | U | U | U |
| QA | U | U | U | U | U | U | U | U | U | U |

Three first Write payloads equal their final artifacts and pass `validateSpec`; each is exactly one Write with no Edit/repair. Each actual `node check-spec.mjs grill/<role>-spec.md` returns `ok: true`, no missing/thin sections and no errors. **Completed compliant member cases: 2/5 planned. Three passing authored artifact/gate observations do not establish three completed handoffs.**

- [Frontend interview](member-frontend/interview.json) asks one grounded module-scope decision, with a concrete data-access-only recommendation. Its [spec](member-frontend/artifact.md) keeps that unanswered recommendation, rendering/message placement, refresh mechanism and function return shape unresolved. Respondent reload, exact failure messages, visible failed ticket and Backend/Database boundaries remain. Body/query omissions are observed with source paths or pending Backend requests. Later wording about the precise ownership/fate of existing files is imprecise, but does not invent an approved change.
- [Backend interview](member-backend/interview.json) asks one close-write-boundary decision. Its [spec](member-backend/artifact.md) preserves endpoint response shapes, missing-ticket 404, repeated-close 200 and file ownership. GET success status, initial-close status, request body and pagination are explicitly unresolved; no-body/no-argument call sites are labelled observed. The unanswered direct-SQL recommendation remains unresolved, and Database/Frontend requests retain pending approval. This complete corrected case addresses the original Backend transport invention without replacing that failure record.
- [Database interview](member-database/interview.json) asks one default decision and correctly treats Backend's omitted default as omission. The [partial spec](member-database/artifact.md) preserves the exact table/default, Backend-only write, exact `$1` UPDATE, schema/migration ownership and unknown indexes/auth. Its provenance statement that `$1`/`TRUE`/`BOOLEAN` came from the question and were carried into the answer is inaccurate: the interview asked about `DEFAULT FALSE`; the exact UPDATE came directly from the fixed respondent. Some line citations are also imprecise. This is a provenance caveat, not an invented agreement or evidence of a completed handoff. The [write trace](member-database/write.json) proves the exact gate succeeded before the account quota error; result `isError: true`, process exit 1 and no final success remain.

The independent reviewer inspected all six attempted phase traces. Retained file tools and shell bodies stay within the fixture; no external content, global skill, MCP, network, package installation or credential reads were observed. Each protected input snapshot is unchanged and only its intended spec is added. One Frontend readonly shell inspection is denied and file reads follow; the denial remains. Requested tools are not claimed as an exclusive OS security gate. Absent member contract-status is honestly unknown.

## Unattempted work and privacy

Auth, QA, clean baseline, clean amendment, clean no-local-role and seeded drift received **no agent invocation** in this corrected Claude population. Prior versions and Codex are separate populations. Neither older clean observations nor successful corrected Frontend/Backend may fill these six cells. No native editor discovery or human pilot was measured.

[Verification](verification.json) records five successful invocations, one weekly-quota error, three first/final artifacts, actual successful gate outputs and all 24 matching frozen source hashes. A stopped-run scan of 23 files including preflight found zero U+FFFD, zero private paths/account identifiers and zero private quota-reset timing. Reasoning/signatures and account-init/auth/rate-limit metadata are omitted. Three occurrences of the account failure text are replaced with a weekly-limit marker omitting reset details; the selected record's pre-redaction SHA256 and byte count remain, as do tool calls, failure category, exit status and invocation incompleteness. Original populations were not edited.

Estimated runtime costs total USD 1.645177, including work before the failed call; this is not a claim about subscription billing. The account quota failure is actual, not inferred from cost estimation or timing. No further model calls were made.

P1-05 remains open until a complete same-source, independently graded matrix reaches the remaining roles and valid three-clean/seed checks. Future quota availability is not authorization to silently resume or retry this stopped record. Keep a new bounded population and preserve this failure. The consenting 3–5-person pilot, native editor portability, package publication and production deployment remain separate open gates.
