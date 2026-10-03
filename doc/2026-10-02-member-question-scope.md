# Member questions and supplied-input scope — 2026-10-02

The current Claude QA interview requested a unit/HTTP/both testing choice and then asked whether runner selection should be another question. Root and an independent reviewer mark the second sequencing request as a bundled decision, despite the final spec correctly leaving runner selection unresolved.

The current Codex QA spec put a file exclusion under Decisions made: the user-visible failure test was declared outside `tests/tickets.test.ts`. The respondent said Frontend supplies the test after wording is agreed; they did not decide its file placement. Supplying a test and owning/excluding a file are different commitments, so this is preserved as a content failure.

The shared installed member instructions now make the recommendation a statement followed by one requested decision, deferring setup/next-topic/meta questions to later turns. They also keep supplied-input file placement unresolved unless explicitly agreed. Existing five headings, exact artifact validation and user control of decisions are retained.

No old artifact, interview or grade is repaired. This correction is a separate feature PR with focused source/documentation commits. Root verifies generated packs after main integration and measures fresh bounded QA handoffs separately on the corrected prompt; completion and source populations remain visible in the final integration report. Deterministic checks alone do not establish factual or conversational quality.
