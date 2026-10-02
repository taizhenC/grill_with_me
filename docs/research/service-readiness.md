# Public-beta service readiness

Research date: 2026-09-19. Scope: `app/`, `lib/`, the Supabase migration, and their tests. This is a planning audit; application source and external services were not modified.

The current architecture is appropriate for a small public beta: keep the web service as a pack distributor and keep model calls on members' machines. The necessary upgrades are correctness and operating controls. Accounts, a new backend framework, and live collaboration are not prerequisites.

For this note, **P0 means before opening a reliable public beta**, **P1 means the next delivery batch**, and **P2 means optional hardening after observing real use**. The parent upgrade plan can group these service findings with CLI and release work.

## 1. P0 — Make room access difficult to guess and creation collision-safe

**Evidence.** `lib/keys.ts:18-20` uses two choices from a 40-word list and an integer from 10 through 99: **144,000 possible keys, approximately 17.14 bits**, not the 6.4 million described in the comment. These keys are the only control over room reads: `app/api/room/[key]/route.ts:17-50` returns role details and complete packs; `app/r/[key]/page.tsx:44-64` returns the project brief. There is no read throttle. `MemoryStore.create` overwrites an existing map entry at `lib/store.ts:64`; `SupabaseStore.create` tries one insert at `lib/store.ts:129-140`, so the database's unique constraint turns a collision into a failed publish.

The birthday approximation gives a **49.95% chance of at least one duplicate draw among 447 generated keys**. This is cumulative collision risk, not a 50% failure rate for an individual publish. Supabase rows are never purged by the repository, so expired keys continue occupying its unique namespace.

**Upgrade.** Use a cryptographically random room capability with at least 128 bits of randomness and keep the readable name as an optional label. A larger random key can itself be the capability; an account system is unnecessary. If the readable short code must remain usable by itself, explicitly treat its room as public and do not promise private/unlisted access. Add bounded retries for unique-key violations and never replace an existing room on collision. Migrate CLI parsing, URL parsing, examples, tests, and documentation together. OWASP's guidance is for session identifiers rather than this exact product, but its minimum entropy and CSPRNG advice is a useful bearer-capability benchmark; the 128-bit recommendation here is an architectural choice. [OWASP session identifier guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

**Acceptance.** A forced collision preserves the first room and its token; the second create retries or returns a controlled failure. Missing/incorrect room capabilities cannot retrieve brief, claims, or packs. Both UI and CLI can use the new room URL. Legacy short-code access has an explicit migration/expiration policy.

## 2. P0 — Require durable production storage and verify the actual deployment

**Evidence.** `lib/store.ts:197-208` silently chooses `MemoryStore` whenever either Supabase environment variable is absent, including in production. `globalThis` only shares state inside a process. `tests/api.test.ts:42` injects `MemoryStore`, and `tests/store.test.ts:45` tests that implementation; there is no Supabase store integration suite in the repository. The production setup is three prose lines at `README.md:119-122`, with no tracked environment example or readiness check.

**Upgrade.** Select memory mode explicitly for local development/tests, reject missing or partial database settings in production, and add a non-sensitive readiness check that verifies the expected migration. Exercise the deployed publish → read → claim → republish → member pack workflow against a separate test database. Keep the existing HTTP Supabase client; a direct Postgres driver/pool rewrite is unnecessary. Vercel documents that global state can be reused within a warm Fluid Compute instance while the platform scales additional instances, which is not durable application storage. [Vercel function execution and HTTP database APIs](https://vercel.com/kb/guide/connection-pooling-with-functions)

The migration already enables RLS with no policies (`supabase/migrations/0001_rooms.sql:21-23`), and the service key is consumed only by server code. That is a valid server-mediated architecture, not evidence that RLS is missing. Confirm anon/authenticated clients cannot access rooms, retain service credentials exclusively server-side, and explicitly test any new database functions' privileges. Supabase service/secret keys bypass RLS. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

**Acceptance.** A production start with zero or one database setting fails clearly. A room survives an application restart and is readable from separate instances. A fresh database migration plus the real API smoke test passes; anon/authenticated database requests cannot read or mutate rows. Logs identify failing operations without recording bearer tokens or room bodies, and a storage outage yields a controlled response instead of a false publish success.

## 3. P0 — Make claims and republishing atomic

**Evidence.** `lib/store.ts:155-166` reads a version, updates with that version as a filter, and returns success without checking whether any row changed. Two simultaneous republishes can both acknowledge version 2 even though only one body is stored. `lib/store.ts:169-180` reads the complete claims JSON, adds one member locally, and writes the entire object; simultaneous claims for different roles can erase one another.

**Verification performed.** An in-process query double running the actual transpiled `SupabaseStore` reproduced both races: concurrent frontend/Alice and backend/Bob writes left only `{ "backend": "Bob" }`; concurrent publishes A and B returned `[2, 2]` while the persisted room was A at version 2. This demonstrates application control flow, not a substitute for a real Postgres concurrency test.

**Upgrade.** Move claim mutation to an atomic database operation, preserving other roles. For republish, either atomically increment and return the committed version or retain compare-and-swap and return a conflict when zero rows change. Validate room expiry, host authorization, and role existence inside the mutation, so a read/write race cannot bypass them. Preserve the existing policy that two claims for the *same* role are informational and last-write-wins. Decide how removed role slugs affect old claims.

Supabase updates do not return changed rows by default; chaining `.select()` is the documented way to retrieve them. A database function can perform a multi-step transaction; use invoker semantics when possible and explicitly restrict execution, since function execution is broadly granted by default. [Supabase update](https://supabase.com/docs/reference/javascript/update), [Supabase database functions and privileges](https://supabase.com/docs/guides/database/functions)

**Acceptance.** A real database test sends concurrent claims for every role and retains every different-role claim. Concurrent republish requests either each receive their committed, unique version or a documented conflict; neither reports success for content that was not stored. Invalid tokens and expired rooms cannot mutate data. A republish that removes a role has a tested claims policy.

## 4. P0 — Apply shared abuse controls and bounded request reading

**Evidence.** `lib/rate-limit.ts:13-29` stores the creation quota in a process-local map; it resets on process replacement and is not shared across instances. `app/api/rooms/route.ts:22-30` trusts `Content-Length` for an early check, then consumes the whole body. `lib/schema.ts:99-103` calls UTF-16 string length "bytes". Republish reads the entire body at `app/api/room/[key]/republish/route.ts:26`; claim parses JSON without a body cap at `app/api/room/[key]/claim/route.ts:23`. Read, claim, and republish routes have no application rate limit.

**Verification performed.** A valid six-role payload with multibyte text was **181,583 UTF-16 units but 541,583 UTF-8 bytes** and passed `parseGrillRoom`, despite the declared 262,144-byte ceiling. A truthful `Content-Length` catches that payload on create, but republish and requests without that header do not enforce the stated byte limit.

**Upgrade.** Use an atomic shared rate limiter or deployment firewall appropriate to the chosen host. Reusing Supabase is an option; adding a Redis vendor is not inherently required. Cover anonymous creation, enumeration/downloads, claims, and failed host writes, with policy adjusted for teams sharing one network. Use one bounded-body reader with endpoint-specific byte limits that aborts while streaming, and return consistent 413/429 JSON responses. OWASP recommends explicit size bounds and 413 responses and identifies compute/bandwidth abuse as a concern even without model inference costs. [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)

Trusting `x-forwarded-for` is deployment-specific: Vercel documents that it overwrites forwarded client IPs to prevent spoofing; a self-hosted proxy needs an explicit trust policy. Do not call this a proven IP-spoofing exploit on Vercel. [Vercel request headers](https://vercel.com/docs/headers/request-headers)

**Acceptance.** Multiple service instances observe the same quota. A restart does not reset it. Oversized ASCII and multibyte bodies, including absent/misleading length headers, are stopped within the configured byte budget on every mutation route. Legitimate members behind one NAT can join; limits return useful retry information and do not expose secrets.

## 5. P1 — Finish retention, privacy, and recovery; correct misleading copy before beta

**Evidence.** The host page promises rooms are **deleted** after 30 days at `app/r/[key]/host/page.tsx:118`; the store merely hides expired rows at `lib/store.ts:152`. `supabase/migrations/0001_rooms.sql:26` says a scheduled job *may* purge them, and none is implemented. There is no host delete or token-rotation path. Join-page metadata (`app/r/[key]/page.tsx:17-31`) contains project information without the host page's no-index setting. `app/publish-panel.tsx:39-40` reports that a room was not created on any fetch/JSON error, even when a server may have committed before the response was lost.

**Upgrade.** Correct the deletion promise immediately, then add scheduled physical deletion with an explicit grace window and monitoring. Supabase Cron can execute scheduled SQL/database functions and records job outcomes. [Supabase Cron](https://supabase.com/docs/guides/cron)

Publish short product-specific privacy text: what the brief/roles/names contain, that anyone holding a room capability can read them, what the service stores versus what remains in git, the actual retention policy, and how hosts request early deletion. Add room no-index metadata, explicit private/no-store response caching where appropriate, and a referrer policy; these reduce accidental dissemination and do not replace authorization. Add host-authorized deletion, then token rotation if real usage justifies it. Treat publish network failures as indeterminate; an idempotency key/retry mechanism can avoid duplicate rooms and unrecoverable host tokens.

**Acceptance.** An expired room is inaccessible and is removed within the documented purge window; a test records the cron job's result. Host deletion removes the room. Room pages send the intended indexing/cache/referrer controls. Fault-injection after an insert does not tell the user with certainty that no room exists; retry behavior is documented and tested.

## Smaller P1/P2 follow-ups

- **P1: correct browser takeover.** `app/r/[key]/role-list.tsx:145` offers "Take this over", but `:99` only shows the name/claim controls when nobody has claimed the role. Show the takeover action or change the label, and verify it with a browser test. This does not justify authenticated membership or realtime presence for beta.
- **P1: validate deployment origins before printing shell commands.** `lib/origin.ts:11-16` builds an origin from forwarding headers, and `lib/commands.ts:12` appends it unquoted to `--base`. Validate a configured public origin/trusted proxy hosts and reject malformed origins and shell metacharacters. On Vercel, documented headers are normalized; this is primarily a self-host/proxy configuration concern, not a demonstrated remote command-execution path on the canonical deployment. [Vercel request headers](https://vercel.com/docs/headers/request-headers)
- **P2: minimize stored bearer secrets.** Existing host tokens use 24 random bytes (`lib/keys.ts:24-25`), a strong generator. Hashing them at rest and adding rotation would reduce consequences of a read-only database leak; no evidence of a leaked service credential was found in the inspected implementation. Do not make a full auth/account system a prerequisite for this improvement.

## Limits and existing strengths

This audit did not connect to or mutate a live Supabase project. Real RLS behavior, migration application, deployment environment values, platform firewall rules, and cron configuration remain deployment checks. Tests currently exercise memory-backed API semantics, not the production store. Existing useful safeguards include Zod validation, duplicate-role rejection, bearer authorization for republishing, expiry checks, RLS, token stripping from public responses, and explicit skill-file inclusion in the production bundle (`next.config.mjs:9-12`). Preserve these while closing the gaps above.
