# Beta release runbook

The prepared release version is `0.3.0-beta.1`. This runbook prepares and verifies
the existing service and CLI. It does not establish that all public-beta gates
in `upgrade-plan.md` have passed.

## Prepare the artifact

Use Node 24 for the application. From the repository:

```sh
npm ci
npm test
npm run typecheck
npm run build
node scripts/verify-skill-traces.mjs
node scripts/verify-cli-package.mjs
npm audit --audit-level=low
```

Run `npm run test:db` only against an empty disposable database named `grill_test`
with `GRILL_TEST_DATABASE_URL` configured. The test creates and removes its
fixture table/functions. Hosted CI supplies a fresh PostgreSQL service.

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
