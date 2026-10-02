# Beta package preparation completion — 2026-10-02

Feature: publishable CLI metadata, package documentation, and release procedure.

Application/CLI versions are synchronized at `0.3.0-beta.1`. The CLI supports
Node 22.15+ within Node 22 and Node 24. It includes the declared MIT license,
README, repository/support metadata, and a default `beta` publish tag. The root
application package remains private. The release runbook is
[`beta-release-runbook.md`](beta-release-runbook.md).

Validation: the actual archive installed offline in a consumer checkout with
spaces and passed command/help/spec checks on Node 22.15.0 and Node 24.21.0. The
archive check verifies all declared runtime files, README, and license are
present and excludes local credentials, receipts, and dependencies. npm publish
dry-run passed without uploading a package. The preceding combined main passed
all six hosted CI jobs, including real PostgreSQL concurrency/privilege checks,
and 261 local tests with seven Windows platform skips.

The default registry package and service both returned 404 in fresh read-only
checks. This machine has no npm authentication, Vercel project configuration, or
Supabase runtime credentials. No publication or deployment was performed.
Ownership/access, actual hosted persistence/permissions, and all outstanding
P0/P1 release gates must be resolved before publication. Repack and verify the
final candidate after subsequent feature changes; this report does not freeze an
unpublished archive's integrity.
