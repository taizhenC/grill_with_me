# Evaluation runtime regression CI — 2026-10-02

The Windows/Linux CLI matrix now runs the evaluation-fixture and evidence-sanitizer regressions alongside its existing CLI/spec/contract checks. It covers Node 22.15.0, the current Node 22 patch and Node 24. The added older patch records a runtime on which pathname and descriptor device values differed, so the compatibility behavior from PR #34 receives an automatic regression check.

This expands hosted CI from seven to nine jobs: six runtime/platform jobs, app checks, browser onboarding and PostgreSQL mutations. Every runtime/platform job retains installed-archive verification. The deterministic evaluation tests create synthetic fixtures and subprocesses; they do not invoke authenticated agents, test native editor discovery or establish filesystem confinement.

Before this workflow change, root ran the expanded filter sequentially on exact main `28eee28ae589b8e7ea4d2e2e47ee33e03ca2ac26`: Node 22.15.0 passed 306 checks with eight Windows skips; Node 24.21.0 passed the full 551-test suite with eight skips and typecheck. The available C-to-D-drive sanitizer case was enabled in both local runs. Hosted cross-drive coverage remains optional unless a second writable drive is configured; ordinary sanitizer/replacement/device/link tests run on all matrix jobs.

The first local attempt overlapped both suites and hit existing five-second timeouts plus busy fixture cleanup. Sequential runs passed without changing the limits or application code. The full integration report records those attempts and tested revisions separately.

Workflow review verified the exact test filter, three runtime entries and two platforms; `git diff --check` passed. Hosted execution of this changed workflow is recorded after its merge in the final integration report. This feature changes CI and this completion document only.
