# Mutation request bounds completion — 2026-10-02

Feature: bounded streaming reads for every JSON mutation endpoint.

Room creation and republish accept at most 256 KiB of received UTF-8 bytes; claims accept at most 4 KiB. Missing or misleading `Content-Length` does not bypass the limit. Split UTF-8 sequences decode correctly; malformed UTF-8 returns 400, oversized requests return 413, and unfinished reads return 408 after ten seconds. Abort and cancellation errors do not expose internal details. The shared browser/server room parser now counts UTF-8 bytes.

Implementation is split into a reader/parser commit and a route-integration commit. Both use the project owner's configured author and committer identity without co-author trailers.

Validation before integration into main:

- Node 24 full suite: 161 passed, four Unix-specific cases skipped on Windows.
- Fourteen dedicated reader/endpoint regressions passed, including false headers, multibyte chunks, exact limits, stuck cancellation, aborted input, and unchanged room/claims after rejection.
- Typecheck, production build, and production skill traces passed.
- A real Next production server and CLI passed host → publish → join → claim/status → republish → rejoin with pack version 2.

Shared abuse quotas and bounded CLI response downloads remain separate upgrades. Request deadlines bound reading application bodies; they do not impose a global deadline on database work or all hosting infrastructure.
