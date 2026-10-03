# Project README guide — 2026-10-02

The README now introduces Grill With Me as a team agreement workflow: a host
brief, role interviews, committed role specs, a shared contract, and ongoing
implementation checks and amendments. It explains the web service, CLI and AI
skills separately so readers know where each part runs.

## Changes

- Added the live hosted service and distinguished it from pending npm publication.
- Replaced unavailable registry onboarding with local archive installation and
  direct source CLI instructions, followed by commands from the team's checkout.
- Added host/member walkthroughs, the merge preflight, finalized contract files,
  actual consuming TypeScript checks, and the browser ZIP import behavior.
- Corrected publication recovery and amendment descriptions: identical saved
  requests recover the same room; finalized contract prose remains current truth.
- Explained uploaded brief/role/claim data, local specs/contracts, bearer room
  access, host tokens and expiry, with links to the detailed privacy policy.
- Retained development, production migration/configuration, verification and
  repository navigation guidance; linked the dedicated operational guides.
- Corrected the CLI package README's hosted-service status and Node support range.

## Review and verification

The workflow and command descriptions were checked against `cli/grill.mjs`,
`lib/pack.ts`, the four source skills, contract helpers and current runbooks.
An independent agent audited the old documentation and reviewed the rewrite.
Read-only HTTPS checks returned 200 for `https://grill-with-me.vercel.app` and
404 for `https://registry.npmjs.org/grill-with-me`; both states are reflected
in the guide. `git diff --check` passed.

This change updates documentation only. The merged checkpoint uses the existing
CI workflow, including actual CLI archive installation and contract/spec checks.
The [deployment report](2026-10-02-cloud-deployment.md) records the separately
executed hosted room, browser and CLI verification. Full beta acceptance gates
remain documented in the [release runbook](beta-release-runbook.md).
