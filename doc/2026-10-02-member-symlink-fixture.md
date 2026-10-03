# Member selector symlink fixture correction

Completed 2026-10-02. This follow-up corrects a Linux test fixture after the
member-local state migration; it changes no installation behavior.

## Failure and correction

Exact main `2069cad3cfd46cd064efc406b398bc5df84e9d02` passed local Windows
checks (461 tests, eight platform skips), all eight Chromium onboarding
flows, compiled runtime checks, and three real PostgreSQL fixtures.
[Hosted CI](https://github.com/taizhenC/grill_with_me/actions/runs/37081425866)
then exposed an `ENOENT` in the Linux file-symlink fixture: it created the old
`grill/` directory before linking `.grill-with-me/member.json`.

The fixture now creates `.grill-with-me/`. The CLI must still reject the
linked selector, leave the external sentinel unchanged, and avoid writing
the project pack. The existing Windows skip covers file symlinks only;
Windows junction and hardlink checks remain enabled.

`git diff --check` passed. This fix will be merged before combined main
testing, as requested. Linux CI must execute the corrected regression;
Windows skips cannot demonstrate that case. The earlier failed run is
retained as evidence, and hosted success is not claimed here.
