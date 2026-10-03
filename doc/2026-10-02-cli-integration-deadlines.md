# Bounded CLI integration-test deadlines — 2026-10-02

Main run [37089074350](https://github.com/taizhenC/grill_with_me/actions/runs/37089074350) passed eight jobs, including the corrected controlled publication test on all runtimes, but the current Node 22 Windows job timed out in `tests/cli.test.ts`'s room-link join case at Vitest's default five seconds. The file invokes the actual Node CLI, serves rendered packs over loopback HTTP and performs protected filesystem operations. Its helper previously had no child-process deadline. The hosted log establishes the runner timeout; it does not establish a production network or installation regression.

These real-process suites now allow a bounded twenty seconds per case, consistent with the existing member-state/refresh/publication integration suites. Every child invocation in this file has a ten-second deadline. A killed or signaled child is rethrown as a test failure, so an expected CLI rejection cannot accidentally accept a process timeout. Product request/storage deadlines, pure-unit test budgets and every functional/path/credential assertion remain unchanged.

Focused tests pass all 68 runnable cases with four Windows file-symlink skips on both Node 24.21 and Node 22.15, sequentially; TypeScript checking passes. A fresh main CI run follows the feature merge and must complete the nine-job matrix before integrated success is reported. Failed runs remain visible; this is a test-lifecycle correction, not evidence of deployment or a performance guarantee.

Source and completion report are delivered in separate detailed owner-only commits without co-author trailers, through one feature PR. The report is saved in literal `doc/`.
