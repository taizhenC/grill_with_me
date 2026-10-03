# Cloud deployment — 2026-10-02

The application is deployed and publicly reachable at
[https://grill-with-me.vercel.app](https://grill-with-me.vercel.app).
Live service, browser, ZIP and locally packed CLI checks passed against its
Supabase-backed production API. The synthetic room was deleted afterward.

## Targets and source

- Vercel: `taizhencs-projects/grill-with-me`, Hobby, Next.js, Node `24.x`.
- Production deployment: `dpl_Cw3SrwZuWLTZseZXP473zq6uMoxk`, status `READY`.
- [Deployment inspector](https://vercel.com/taizhencs-projects/grill-with-me/Cw3SrwZuWLTZseZXP473zq6uMoxk).
- Deployment API `githubCommitSha`: `a79f0cb6e80b5fe8b2aa23540c65faccfd5d670c`.
- Supabase: Grill With Me, project `pbignhdphlhyyfacqbae`, `ACTIVE_HEALTHY`,
  PostgreSQL `17.11.0.002`, region `us-west-2`.
- Build region: Vercel `iad1`; no cross-region latency target was measured.

Deployment preparation landed in [PR #49](https://github.com/taizhenC/grill_with_me/pull/49).
The explicit room-privilege fix landed in [PR #50](https://github.com/taizhenC/grill_with_me/pull/50).
Both were merged before combined testing. Commits use the owner's author and
committer identity, without co-author trailers. This document and the local
Supabase CLI artifact ignore rule do not change the deployed application source.

## Database and configuration

The intended database was checked before migration: all three app tables and
Supabase migration history were absent. Supabase CLI `2.119.0` first performed
a dry run, then applied the six repository migrations in filename order using
`db push --linked --project-ref pbignhdphlhyyfacqbae --skip-vault`.
Hosted migration history now records `0001` through `0006`.

Verified on the hosted database: three tables exist, RLS is enabled with zero
policies, and each service-role SELECT/INSERT/UPDATE/DELETE privilege is present.
All six app RPCs are security invoker with an empty search path and service-role
execution; anon/authenticated execution is denied. Direct browser room-table
privileges are absent. Service-role schema usage and RLS bypass are present.

Five encrypted production variables are configured: `GRILL_STORE=supabase`,
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GRILL_PUBLIC_ORIGIN`, and `CRON_SECRET`.
The origin is the verified public HTTPS domain. `GRILL_TRUST_PROXY` remains unset.
Credentials were transferred privately and were not committed or printed.
Temporary credential payloads and saved publication/host-capability state were
removed after verification; provider settings remain the authoritative configuration.

## Executed checks

[CI run 37090861851](https://github.com/taizhenC/grill_with_me/actions/runs/37090861851)
passed all nine jobs at the exact application checkpoint. App tests: 557 passed,
4 skipped; Chromium: 12 passed; audit: zero vulnerabilities. Build, typecheck,
compiled runtime checks, all four skill traces, and all four PostgreSQL suites
passed. The database suites exercise the actual new grant migration.
Local Node 24 production build, compiled-runtime checks and skill traces also passed.

The production build completed on Vercel, with its deployment metadata confirming
Node 24 and the source SHA. Live HTTPS checks exercised publication and identical
recovery, conflicting recovery rejection, summaries without host tokens, concurrent
claims, complete role/host/member packs, versioned republishing preserving claims,
unauthorized mutation denial, room deletion, missing-room responses, and rejection
of recovery after deletion. Cache, robots and referrer headers passed.

The first production deployment retained a synthetic room while a second,
cache-free deployment of the same revision was built and promoted. A fresh process
then recovered the same key/token/expiry and both claims. This verifies hosted
persistence across an actual deployment, beyond local memory fixtures.

A separate headless Chromium session verified homepage hydration and JSON
validation, role selection, canonical commands, and a real ZIP download containing
staging `pack.json`, `IMPORT.md`, role files and member skills. It recorded no page
errors and made no room mutations. The installed local beta CLI archive successfully
ran `host` and `join --no-claim` against production. No npm publication was performed.

## Cleanup and operations

Vercel reports the production cron enabled, with `disabledAt: null`, attached to
the current deployment and configured for `/api/maintenance/purge`, `0 3 * * *`.
Missing authorization returns 401. An authenticated manual POST returned 200 with
aggregate counts only: zero expired room/quota/publication deletions, one batch,
and `needsAnotherRun: false`. The synthetic room was already deleted explicitly.
Its recovery tombstone remains subject to the normal 24-hour retention policy.
The first provider-scheduled invocation has not yet been observed.

The repository remains unlinked in Vercel: `vercel git connect` returned an
access-related error. Future releases currently require a manual
`vercel deploy --prod --scope taizhencs-projects` from a reviewed checkout.
Connecting the repository is a separate follow-up; this does not affect the
verified current production deployment.

Npm publication, operator alert destinations/backup policy, the full agent-quality
gate, native-editor verification and the consenting human pilot remain separate
release work. See `doc/beta-release-runbook.md`, `doc/operations-retention-runbook.md`
and `doc/2026-10-02-main-integration.md`. Cloud deployment alone does not certify
that every reliable-public-beta gate has passed.
