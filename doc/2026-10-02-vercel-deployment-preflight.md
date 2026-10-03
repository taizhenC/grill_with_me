# Vercel deployment preflight — 2026-10-02

The deployment target is Vercel project `taizhencs-projects/grill-with-me`,
with a separate Supabase project `pbignhdphlhyyfacqbae` (Grill With Me).
This is a preparation record, not proof of a deployed or accepted public beta.

## Runtime

The private application now declares `engines.node: 24.x` in both npm manifests.
This agrees with `.node-version` and the app, database and browser CI jobs.
The separately published CLI keeps its existing Node compatibility contract.
Vercel's Node setting is also explicitly 24.x, with the Next.js framework preset,
repository root `.`, `npm ci --no-audit --no-fund`, and `npm run build`.
The CLI used for deployment preparation is Vercel 62.2.0 on Node 24.21.0,
installed outside the repository.

[Vercel's runtime documentation](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
confirms that the application manifest overrides a different project runtime.
The prior integrated source checkpoint `3c09d21f89ac0866d8504e5449740f510b4585ca`
passed all nine jobs in CI run `37089802881`; that result does not cover this
new manifest change or establish a functioning hosted database.

## Hosted configuration and verification

Production requires `GRILL_STORE=supabase`, the identified project's
`SUPABASE_URL` and server-only `SUPABASE_SERVICE_KEY`, a verified HTTPS
`GRILL_PUBLIC_ORIGIN`, and a random URL-safe `CRON_SECRET` of 32–256 characters.
Keep `GRILL_TRUST_PROXY` unset on Vercel: the service already recognizes its
sanitized ingress headers. Never commit, publish, or print secret values.

Apply migrations `0001` through `0005` in order after checking hosted schema
and migration history. Do not use the disposable-database verification scripts
against the hosted project. Verify service-role table privileges, RLS without
browser policies, restricted RPC execution, and actual PostgREST access.

The existing Next.js configuration includes all four skill files in both
pack-serving function traces. Verify those traces after the build and exercise
the deployed host, member, and role packs. The existing Vercel cron schedules
`/api/maintenance/purge` daily at 03:00 UTC; verify its production registration
and authenticated operation. A manual purge call does not prove scheduled
execution. [Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
describe Hobby's daily scheduling and timing window.

Hosted smoke checks must use synthetic data and cover publication, identical
replay, conflicting replay, concurrent role claims, pack downloads, authorized
republishing, denied unauthorized mutations, deletion, and replay after deletion.
Verify privacy/cache headers and HTTPS command origins. Keep capability-bearing
requests and room credentials out of logs and screenshots. The local runtime,
browser, and PostgreSQL fixtures are not hosted acceptance evidence.

## Provider choice

Vercel supports the current app directly. Cloudflare's
[current Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
recommends beta vinext and also links the OpenNext route. Either route needs
additional verification for the Node-based proxy, filesystem skill assets,
client-IP handling, and a Worker scheduled handler. Static hosting cannot run
this project's dynamic room API. Those changes are outside this Vercel deployment.

The final deployment record must include the exact deployed revision, verified
production URL, migration/grant results, live smoke results, and any remaining
release gates. Deployment does not close the separate agent-quality or pilot gates
listed in `doc/2026-10-02-main-integration.md`.
