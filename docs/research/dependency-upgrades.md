# Dependency, runtime, and release upgrade research

As of **2026-09-19, America/New_York**. Scope: a reliable public beta. Evidence comes from the checked-in manifests and lockfile, installed package manifests, read-only npm/HTTP checks, and maintainer documentation. No packages, source, configuration, or lockfiles were changed during this research.

## What is actually installed

The version floors in `package.json` are not the installed versions. For example, Supabase is already 2.112.3 despite a `^2.45.0` declaration. Installed versions matched the lockfile for all direct dependencies checked.

| Dependency | Locked / installed | Registry latest stable | Recommended action |
|---|---:|---:|---|
| Next.js | 16.3.1 | 16.3.5 | **P0: patch to 16.3.5**; minimum security fix is 16.3.3. |
| sharp, optional transitive | 0.35.3 | Not independently needed | **P0: ensure >=0.35.4** after the Next patch. Next 16.3.5 requests `^0.35.4`. |
| React / React DOM | 19.2.8 / 19.2.8 | 19.3.0 / 19.3.0 | P2: update together after beta release gates work; no React package advisory appeared in this audit. |
| Supabase JS | 2.112.3 | 2.116.0 | P2: review the minor update and validate against real Supabase; no audit finding. |
| JSZip | 3.10.1 | 3.10.2 | P2: small maintenance update with download/archive verification. |
| Zod | 3.25.76 | 4.6.5 | P3: deliberate major migration, not a launch prerequisite. |
| Vitest / mocker | 4.1.10 / 4.1.10 | 5.0.1; latest stable 4.x is 4.1.11 | **P1: patch to 4.1.11**; defer major 5 migration. |
| TypeScript | 5.9.3 | 7.0.2 | P3: compatibility investigation before upgrading majors. |
| Node types | 22.20.1 | 26.6.2 | Match the chosen supported runtime; do not select latest major automatically. |

Registry snapshots: [Next 16.3.5](https://registry.npmjs.org/next/16.3.5), [React](https://registry.npmjs.org/react/latest), [React DOM](https://registry.npmjs.org/react-dom/latest), [Supabase](https://registry.npmjs.org/@supabase%2Fsupabase-js/latest), [JSZip](https://registry.npmjs.org/jszip/latest), [Zod](https://registry.npmjs.org/zod/latest), [Vitest](https://registry.npmjs.org/vitest/latest), [TypeScript](https://registry.npmjs.org/typescript/latest). The `/latest` endpoints are live and may change after this report.

## P0: patch the production dependency tree before public exposure

`npm audit --json` returned four affected package entries: one critical (`next`), one high (`sharp`), and two moderate (`vitest`, `@vitest/mocker`). This is a dependency advisory result, not proof that every vulnerable code path is reachable in this app.

- **Next Windows server RCE, CVE-2026-75604:** 16.3.1 is in the affected range; fixed in 16.3.3. The maintainer describes Windows-hosted Pages/App Router applications without Cache Components. This repository uses App Router and does not enable Cache Components; the development workspace is Windows. Network exposure and actual deployment conditions have not been established. Linux/macOS are not affected by this particular issue. [Maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), [Next release notice](https://nextjs.org/blog/august-2026-security-release).
- **Next AVIF optimization RCE:** the affected path requires optimization of attacker-controlled AVIF images. No `next/image` imports or remote image configuration were found in `app/` or `next.config.mjs`, so exploitability is not established here. Still remove the affected dependency before beta. The initial Next fix disables AVIF optimization pending the upstream fix. [Maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4).
- **sharp/libheif:** 0.35.3 is below the fixed 0.35.4 release. The advisory concerns processing untrusted input and describes conditional RCE on glibc Linux. Next 16.3.5 requests patched sharp; verify the resolved lockfile and platform binaries rather than assuming that changing the direct manifest completes the fix. [sharp maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c).

Acceptance: raise the Next dependency floor, commit the regenerated lockfile, install from that lock in clean CI, rerun audit, tests, typecheck, production build, and download smoke tests. Confirm Next >=16.3.3 and sharp >=0.35.4 in the resolved production tree. Keep this patch separate from React, TypeScript, Zod, and Vitest major migrations. Next 16 is already Active LTS; no framework replacement is warranted. [Next support policy](https://nextjs.org/support-policy).

## P0: make the advertised installation and default service exist

The public [npm package endpoint](https://registry.npmjs.org/grill-with-me) and its `/latest` endpoint both returned HTTP 404. The [hard-coded default service](https://grill-with-me.vercel.app) returned HTTP 404 with `DEPLOYMENT_NOT_FOUND` on GET as well as HEAD. Therefore the README's default `npx grill-with-me host/join` route cannot be treated as a working public onboarding path today. These observations do not establish name ownership, whether npm will permit registration, or whether another deployment exists.

Publish from `cli/` after account/name and deployment setup. The root package is intentionally private. `npm pack --dry-run --json` in `cli/` succeeded, but the proposed 8,268-byte package contains only `grill.mjs` and `package.json`: no README or license text. Add package documentation, the intended license file, and accurate repository/homepage/bugs metadata. Root `package.json` and CLI report 0.2.0 while the lockfile root metadata still reports 0.1.0; synchronize release metadata. This mismatch alone is not evidence of a broken install.

Acceptance: test the actual tarball in a clean temporary project, then test the published package through `npx` against the deployed app for host, publish, join, status, republish, and rejoin. Validate the `skills/` assets in the deployment output; `next.config.mjs` already has explicit tracing rules for them. Existing CLI tests spawn `cli/grill.mjs` against a local API stub, so they do not validate package publication or the live serverless bundle.

## P1: pin supported runtimes and add reproducible release gates

Observed local runtime: **Node 22.15.0, npm 10.9.2**. The root has no `engines` or runtime pin. Locked Supabase requires Node >=22.0.0; locked Vite 8.2.1 requires Node `^20.19.0 || >=22.12.0`. Thus the full web development dependency tree needs at least Node 22.12 within the supported 22.x line. CLI `engines.node` currently allows >=18; because that CLI has no dependencies, this is a separate compatibility promise rather than evidence it has the web app's runtime requirement.

Standardize web development, CI, and hosting on a current **Node 24 LTS** patch, with matching Node types. At observation time Node's index returned 24.21.0 (and 22.23.2 for the maintenance 22 line). Decide whether the CLI should promise supported Node 22/24 only; avoid promising untested versions. Node 18 and 20 are EOL; Node 22 remains maintenance LTS through April 2027, while 24 remains supported through April 2028. [Node release schedule](https://github.com/nodejs/Release#release-schedule), [EOL policy](https://nodejs.org/en/about/eol), [release index](https://nodejs.org/dist/index.json).

No CI workflow is checked in. Add a required workflow with `npm ci`, typecheck, tests, production build, dependency audit, and CLI package verification. Test CLI filesystem behavior on Windows and Linux using each runtime the package promises. Use `npm ci` in release builds because it installs the existing lock and fails dependency-manifest disagreement rather than silently updating it. Add a scheduled dependency-update mechanism and explicitly triage audit severity against reachability. [npm ci documentation](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

Patch Vitest to **4.1.11** in this lane. Its advisory concerns a reachable development server using redirect mocks/browser interception. The repository config uses `environment: "node"`; no browser-mode or mocker-plugin use was found. That makes P1 maintenance appropriate, rather than claiming a production exploit. [Vitest maintainer advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9).

For repeatable npm releases, use trusted publishing/OIDC once package ownership is configured. npm currently requires CLI >=11.5.1 and Node >=22.14.0; the observed npm 10.9.2 is insufficient. Set accurate repository metadata and test the release workflow. GitHub/GitLab provenance is automatic for public packages from public repositories; do not assume the same guarantee for a private repository. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

## P2/P3: defer upgrades that add migration risk without fixing beta blockers

- **P2 React 19.3:** optional feature/bug-fix update, paired with React DOM. The locked 19.2.8 is not 19.0.0, despite the manifest floor. Keep browser flow checks around publishing, claiming, copying commands, and hydration. [React 19.3 release](https://react.dev/blog/2026/09/09/react-19-3).
- **P3 Zod 4:** review validation/error/default semantics against the room protocol before migrating. Version 4 changes these APIs; preserve existing accepted/rejected room fixtures and public error responses deliberately. [Zod migration guide](https://zod.dev/v4/changelog).
- **P3 Vitest 5:** optional after patching 4.1.11; it raises runtime/tooling requirements and changes Vite dependency handling. [Vitest 5 migration guide](https://main.vitest.dev/guide/migration/).
- **P3 TypeScript 7:** investigate after beta. The native compiler does not ship the old compiler API, and this project config includes the Next TypeScript plugin. Verify Next build/plugin compatibility or use the documented side-by-side 6/7 approach; do not blindly install latest. [TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

Remaining uncertainty: deployment configuration, npm ownership, real Supabase integration, and actual exploit reachability were not established. No live application mutation or package publication was attempted.
