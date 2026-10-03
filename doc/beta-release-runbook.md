# Beta release runbook

The prepared release version is `0.3.0-beta.1`. This runbook prepares and verifies
the existing service and CLI. It does not establish that all public-beta gates
in `upgrade-plan.md` have passed.

## Prepare the artifact

Use Node 24 for the application. From the repository:

```sh
npm ci
npx --no-install playwright install --only-shell chromium
npm test
npm run typecheck
npm run build
npm run test:runtime
npm run test:browser
node scripts/verify-skill-traces.mjs
node scripts/verify-cli-package.mjs
npm audit --audit-level=low
```

Install the Chromium build matching the repository's locally installed,
lockfile-pinned `@playwright/test` (currently `1.63.0`). On Linux, add
`--with-deps` to the install command to include the required system libraries,
as hosted CI does.
The runtime and browser commands require the preceding production build. Runtime
checks launch actual compiled Next bundles with controlled database HTTP fixtures;
browser checks launch a separate compiled app in explicit memory mode on
`127.0.0.1:3108`, without reusing an existing server. Neither verifies hosted SQL.

Set `GRILL_TEST_DATABASE_URL` to an **empty disposable** PostgreSQL database, then
run `npm run test:db`. All four scripts check the actual connected database name
against `^grill_test(?:[_-].+)?$`: `grill_test`, `grill_test_release`, and
`grill_test-release` are accepted. Each suite rejects its known existing application
tables, creates its fixtures/migrations, and removes owned tables/functions in
cleanup. The name and table checks do not establish that other data is safe to
modify. Use a disposable cluster and a privileged fixture connection: setup may
create the cluster-wide `anon`, `authenticated`, and `service_role` roles, requires
`service_role` to have `BYPASSRLS`, and leaves those roles in place. Do not use a
production or populated database. Hosted CI supplies a fresh PostgreSQL service.

The command runs these scripts in order:

| Script | Real database checks |
|---|---|
| `scripts/verify-store-database.mjs` | Concurrent claims/republishes, committed versions, authorization/expiry, and RLS/function privileges |
| `scripts/verify-request-quotas.mjs` | Shared atomic client/global budgets, fresh-process persistence, bounded cleanup, and restricted-role denial |
| `scripts/verify-retention-database.mjs` | Host deletion, queued writers, bounded concurrent purge, rollback, and deletion/purge privileges |
| `scripts/verify-publication-database.mjs` | Identical concurrent replay, binding conflicts, collision rollback, deletion/expiry tombstones, and ledger privileges |

Pack from `cli/`, whose package is public; the application package is private:

```sh
npm pack ./cli --pack-destination <release-directory>
```

Record the archive filename and integrity from npm's pack output. Verify the
exact archive in a separate checkout, including paths with spaces. The package
must include its runtime helpers, README, license, and support metadata and
exclude credentials and local receipts.

## Configure the service

Identify the owner's Supabase and Vercel projects before provisioning anything.
Apply every `supabase/migrations/*.sql` file in filename order to the intended
database. Verify RLS, function grants, concurrent mutations, retention, and
restart persistence on that actual deployment.

Set server-only `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` through hosting settings;
do not commit or paste secrets into reports. Keep `GRILL_STORE=supabase` in
production. Memory mode is restricted to explicit development/test use. A
secret-free build succeeds, but unconfigured production room APIs return 503.

Set `GRILL_PUBLIC_ORIGIN` to the deployment's validated HTTPS origin when using
a canonical public address. Keep `GRILL_TRUST_PROXY` unset unless the ingress
is verified to replace forwarded headers; only `GRILL_TRUST_PROXY=1` opts into
them. Check printed links/commands and publication recovery against the intended
origin, including a lost reply, same-request replay, and denial after room deletion.
Keep service/database clocks synchronized for the 24-hour recovery window; see
[the publication recovery protocol](publication-recovery-protocol.md).

Configure `CRON_SECRET`, verify the actual daily cron and function limit, and set
up operator monitoring/recovery using [the retention runbook](operations-retention-runbook.md).
Publish the deployment's actual operator/provider/log/backup policy; see
[privacy and retention](privacy-and-retention.md). A repository schedule alone
does not prove deletion is running on the hosting account.

Deploy the verified application artifact and verify skill tracing and the actual
response privacy/cache headers. Record the resulting service origin. Use that
origin explicitly in custom-service CLI commands. Confirm default onboarding
works before advertising the default origin.

## Publish and verify

Confirm npm account ownership and package naming. Authenticate on the owner's
machine or configure a verified trusted publisher. After the required beta
gates pass, publish the already-tested archive under the beta tag:

```sh
npm publish <verified-archive.tgz> --tag beta --access public
```

From clean independent host/member checkouts, install through the registry and
complete host → publish → join → status → republish → rejoin against the deployed
service. Confirm saved credentials stay ignored, updates preserve edits, actual
room state survives restart, and downloaded packs contain all skills. Record
registry version/integrity, deployed revision, and test evidence in `doc/`.

Promote a stable release only after all P0/P1 acceptance criteria, including real
agent evaluations and a team pilot, have evidence. Increment version metadata
together for later releases; never overwrite a published npm version.

## Access currently missing

On 2026-10-02 this machine had no authenticated npm account, no Vercel CLI/project
configuration, and no Supabase runtime credentials. Read-only HTTP checks returned
404 for `https://registry.npmjs.org/grill-with-me` and
`https://grill-with-me.vercel.app`. Missing access prevents publication and hosted
validation; it does not prevent local packaging or source verification.
