# CLI file safety completion — 2026-10-02

Feature: downloaded pack validation and installation target protection.

- PR: [#6](https://github.com/taizhenC/grill_with_me/pull/6), merged into `main`.
- Feature commits: `b680f25`, `6c098cb`.
- Merge commit: `54d53e5cd1fd74815779bdeeff588978bb2d8ee7`.
- Scope: exact host/member manifest paths and counts; duplicate, unsafe, malformed, empty, and oversized file rejection; UTF-8 pack limits; full filesystem preflight; link/junction/hardlink rejection; host dry-run.

Post-merge [CI](https://github.com/taizhenC/grill_with_me/actions/runs/37077465585) passed on exact `main` revision `eb737f461a7c2e27b016c08abea2848d129a72c1`. Linux CLI jobs passed all 66 CLI tests; Windows passed 62 and skipped four Unix-specific symlink cases. Installed tarball checks passed on both platforms and runtimes. Full Linux application suite passed all 151 tests.

Local Node 24 full tests, typecheck, build, installed CLI checks, and the real-server host-to-rejoin flow also passed. Sentinel tests cover Windows junctions and hardlinks and Linux symlinks.

Remaining CLI safety work includes credential scoping, preservation of edited installed files, bounded network responses, and recovery after interrupted multi-file writes. This feature does not protect against concurrent local path replacement.
