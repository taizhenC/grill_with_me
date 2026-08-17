# grill-with-me — Plan

> Grill a whole team about their project — each member in their own CLI, with their own agent — then hold everyone to the contract that comes out of it.

**Status: v1 built** (2026-08-17, branch `build/v1-skills-and-app`). All four skills, the web app, the join CLI, and the examples exist and are tested — 75 unit/contract tests plus an end-to-end smoke of publish → join page → CLI join → republish. Remaining before calling M-milestones done: the *behavioral* exit criteria that need live grill runs (M1's reliability gate, M5's false-positive gate) and deployment (Vercel + Supabase). Rewritten 2026-08-17 (architecture reversal, §5); revised with §5 decisions 13–19.

---

## 1. What this is

`grill-me` interviews one person until the model understands their idea. **`grill-with-me` interviews a team, and then holds them to what they agreed.**

The product is **a set of skills**, not a web service. Every model call runs on a team member's own agent — their Claude Code, their Cursor, their subscription. **We never call an LLM API.** The web app exists only so the host can hand out packs.

**Governing principle: the host does all the setup; a member runs one command and starts.**

**Primary use case: hackathons.** 3–5 people, a few hours, a demo deadline, everyone about to vibe-code in parallel against an API shape nobody wrote down.

### The core insight

Teams building in parallel fail for one reason above all others: **nobody wrote down the contract between them.** Frontend expects `user.name`, backend returns `first_name`, nobody finds out until integration at hour 20.

So the product does three things:

1. **Extracts the contract** — grills each person about their layer, merges the answers.
2. **Makes it enforceable** — emits `contract.ts` alongside `CONTRACT.md`, so violations become compile errors, not opinions.
3. **Keeps it true** — the contract can be amended when reality changes, and a check reports drift *attributed to a role*, so the host knows who to go talk to.

Point 3 is what separates this from a documentation generator. Documentation goes stale in three hours; this is designed to be corrected.

---

## 2. Architecture

Everything intelligent happens on someone's own machine. Git carries the artifacts. The web app carries nothing but outbound packs.

```
HOST — local agent
  run  grill-host  skill
  ├─ gets grilled about the project
  ├─ proposes roles, host confirms
  └─ writes grill-room.json  (all packs, one file)
                │  host uploads that one file
                ▼
        ┌───────────────┐
        │   WEB APP     │   ← no LLM. Stores packs, serves them.
        │  /r/<key>     │
        └───────┬───────┘
                │  npx grill-with-me join <key>
                ▼
MEMBERS — local agent
  run  /grill-me   (MY-ROLE.md supplies scope + output contract)
  ├─ reads the repo and sibling specs already committed by teammates
  └─ writes  grill/<role>-spec.md  →  git commit
                │
                ▼
HOST — local agent
  run  merge-contract  skill
  └─ writes  grill/CONTRACT.md  +  grill/contract.ts  →  git commit
                │
                ▼
          EVERYONE BUILDS
                │
     ┌──────────┴───────────┐
     ▼                      ▼
ANYONE — local agent   ANYONE — local agent
  check-contract         amend-contract
  repo vs contract       "we moved auth to a header"
  → report by role       → CONTRACT-CHANGES.md
     │                          │
     └──────────┬───────────────┘
                ▼
   host tells that person → sorted out at the table
```

**Git is the transport.** Specs, contract, and amendments all move by commit. The web app never sees them.

**Cost to us: $0.** Members spend their own tokens — shifted, not eliminated. Say so plainly.

---

## 3. The four skills

These are the product. Everything else is plumbing.

| Skill | Who runs it | When | Writes |
|---|---|---|---|
| **`grill-host`** | Host | Once, at the start | `grill-room.json` — brief + roles + a pack per role |
| **`merge-contract`** | Host | Once specs are committed | `grill/CONTRACT.md` **+ `grill/contract.ts`** |
| **`amend-contract`** | **Anyone** | Whenever reality changes | appends to `grill/CONTRACT-CHANGES.md` |
| **`check-contract`** | **Anyone** | Repeatedly, during the build | `grill/CHECK-REPORT.md`, findings tagged by role |

**There is deliberately no member-grill skill.** Members run the existing `grill-me` (or any equivalent), and `MY-ROLE.md` supplies everything it needs. See *The member grill* below.

### `grill-host`
Unbounded interview about the product: what it does, what the demo shows, what's out of scope, what must work, hours until the deadline, **and the stack the team already knows** (which decides whether a typed contract is emitted later). Then proposes roles as **layers** — Frontend, Backend, UI/UX, finer when warranted. Host edits and confirms. Emits one `grill-room.json`.

### The member grill — no skill required

**We don't write a grilling skill. `grill-me` already exists and does this well.**

Instead, `MY-ROLE.md` carries everything: the role's scope, the grilling instruction, and the output contract. The member runs `/grill-me`; the agent has already loaded `AGENTS.md` → `MY-ROLE.md` and grills them correctly.

```markdown
# Your role: Backend

## What you own
The API layer and data model for the analyze flow...

## Before we start
Read grill/PROJECT.md, any grill/*-spec.md your teammates have already
committed, and the repo you're standing in.

## The grill
Interview me relentlessly about MY LAYER ONLY until we reach a shared
understanding. One question at a time, with your recommended answer.
Look facts up in the repo; the decisions are mine.
Prefer questions that reference something real — existing code, or something
a teammate wrote in their spec.

## When I say I'm done
Write grill/backend-spec.md with exactly these headings:
  ## Scope
  ## What I own
  ## What I need from other roles
  ## Decisions made
  ## Still unclear
```

**Why a markdown file beats a skill here:** it's portable — this works in Cursor and Copilot, a `.claude/skills/` file doesn't — and the grilling instruction being inline means it works for someone who's never heard of `grill-me`. Members install nothing.

**The cost, stated plainly:** `grill-me` ends at *"do not act until I confirm shared understanding"* — writing the spec file isn't native to it. Whether `grill/backend-spec.md` lands with the right headings depends on the agent honoring `MY-ROLE.md`. `merge-contract` parses those headings, so it **must validate and fail loudly** rather than merge garbage. That's P0-2, and it's now the most load-bearing gap in the plan.

Even without a skill of our own, the member grill keeps two advantages a web form structurally cannot have:

- **It reads the repo.** It sees `package.json`, the folder structure, what's scaffolded — so it asks *"you already have a `users` table with `email` and `created_at`; does the profile page need anything beyond those?"*
- **It reads sibling specs.** Any `grill/*-spec.md` a teammate already committed is context. So the backend dev's grill asks *"Frontend says the results page needs a confidence score per item — is that in your response shape?"*

That second one recovers most of what was lost when live conflict detection was removed, at zero coupling cost — git was already the transport. Later grills are naturally sharper than earlier ones. That's fine.

Output is a structured spec with **fixed section headings** (P0-2): Scope / What I own / What I need from others / Decisions made / Still unclear.

### `merge-contract`
Reads every spec and writes the crown jewel — **two files**.

**`CONTRACT.md`** — not prose, a list of agreements named concretely against the team's real stack:

- Endpoints: method, path, file path, request shape, response shape
- Data model: table names, column names, types
- State ownership: who owns what, who may write it
- Auth model: what exists, what's faked for the demo
- Error behavior: what the UI receives on failure

*"An endpoint that returns a list of items"* is useless. `POST /api/analyze` in `app/api/analyze/route.ts` returning `{ items: { id: string, label: string, score: number }[] }`, backed by table `analyses` — **that** an agent builds from without inventing names.

**`contract.ts`** — the same agreements as **shared TypeScript types**, when the stack supports it (known from the host grill). Both sides import it. `user.first_name` when the contract says `name` becomes a **compile error**, not an LLM finding:

| | Prose only | With `contract.ts` |
|---|---|---|
| Drift detection | Probabilistic — an agent reads code | Deterministic — `tsc` |
| When you find out | When someone runs the check | The moment you save the file |
| False positives | Possible | Zero |

`check-contract` then covers only what types can't express — auth model, error behavior, state ownership, whether the endpoint is actually implemented. Non-TS stacks fall back to prose only.

Contradictions between specs → `## ⚠️ UNRESOLVED — decide this before you code`. Unclaimed roles → `## ⚠️ NOBODY OWNS THIS`.

### `amend-contract`
**The contract will be wrong within hours. This is the skill that keeps it honest.**

Without it: the team changes something verbally at the table, the check reports it as drift — correctly but uselessly — the same false alarm reappears every run, and by hour 10 everyone ignores the check. The tool fails at exactly the moment it should earn its keep.

Takes plain input (*"we moved auth to a header"*), rewrites the affected section, and appends a dated entry to `grill/CONTRACT-CHANGES.md`. `check-contract` treats amendments as authoritative. Anyone can run it — a contract only one person can correct is a contract that stays wrong.

### `check-contract`
Compares the repo against the contract and reports drift **attributed to a role**:

```markdown
## ⚠️ Backend
- `app/api/analyze/route.ts:24` returns `first_name`; CONTRACT.md §Endpoints says `name`.
  → Talk to Frontend before changing either side.

## ✅ Frontend
- No drift detected.
```

Every finding offers **three outcomes**, not two: *the code is wrong* · *the contract is wrong (run `amend-contract`)* · *accepted, ignore it*.

**Why this is more reliable than the original design:** comparing two people's English answers and guessing whether they contradict is fuzzy. Comparing real code against a written contract is close to mechanical — and with `contract.ts`, most of it isn't even a model's job.

---

## 4. Joining and the pack

### Joining

```
npx grill-with-me join blue-tiger-42
```

Fetches the pack, writes the files, prints what to run next. **Members never open a browser.**

This exists because "download a zip and unzip it into your repo root" was the single most likely point of failure in the whole product — it has a download step, an unzip step, a *where does this go* step, and a *did I unzip it in the right folder* step, each of which will bite someone. The CLI removes all four.

### What lands in the repo

```
AGENTS.md                                  # points the agent at everything below
grill/
  PROJECT.md                               # shared: the brief from the host grill
  MY-ROLE.md                               # yours: scope, what you'll be asked about
  .room                                    # room key + pack version (staleness check)
.claude/skills/
  check-contract/SKILL.md
  amend-contract/SKILL.md
```

No member-grill skill — `MY-ROLE.md` carries it (decision 19). Check and amend ship in **every** pack, because anyone can run them (decision 17).

`.room` stamps the room key and pack version so `check-contract` can warn when the host has republished and you're holding a stale pack.

### `AGENTS.md`

```markdown
# Agent instructions

Before writing any code that crosses a role boundary, read `grill/CONTRACT.md`
and import types from `grill/contract.ts`.

- Use the exact endpoint paths, field names, and data shapes they specify.
- NEVER invent a field name, endpoint, or response shape. If what you need
  isn't in the contract, stop and tell the user it needs agreeing with the
  other role first — or run the `amend-contract` skill.
- `grill/MY-ROLE.md` is your scope. `grill/PROJECT.md` is the product context.
- `grill/CONTRACT-CHANGES.md` overrides CONTRACT.md where they disagree.
```

`AGENTS.md` rather than `CLAUDE.md` on purpose: cross-tool convention, so you never have to ask a teammate which agent they use.

---

## 5. Decision log

The reasoning matters more than the choice. Don't reverse one without reading the *why*.

### The reversal

The first version of this plan put the grilling **in the web app**, with our API key and four server-side model calls. Superseded.

**Why it changed:** every member already carries an LLM and an IDE. Paying for a second one bought nothing — and cost the one thing a local agent has that a web app never will: **it can read the repo.** Checking real code against a contract also turned out far more tractable than comparing two people's English answers.

**What it cost:** the live parallel-grill UI, the assembling-panel demo, live conflict banners, and link-and-type onboarding. Real losses, traded deliberately.

### Current decisions

| # | Decision | Why |
|---|---|---|
| 1 | **All intelligence lives in skills on the user's own machine.** The web app never calls an LLM. | Zero inference cost, no keys to manage, no rate limits — and the grill is repo-aware. |
| 2 | **Host does all setup; members run one command.** | The governing principle. A member's whole experience: `npx … join`, run skill, commit. |
| 3 | **Git is the transport** for specs, contract, and amendments. | The team already has a repo. Building an upload path for artifacts that belong in version control is inventing a worse git. |
| 4 | **The web app only holds outbound packs.** Specs never return to it. | Keeps private project detail off our server, and means we could delete the app tomorrow without losing anyone's work. |
| 5 | **Host publishes by uploading one `grill-room.json`.** The host skill does not call our API. | No auth token in a skill, no `curl` permission prompts, nothing to break at minute 0. |
| 6 | **Roles are layers.** | How teams self-organize, and layer boundaries are exactly where contracts break. |
| 7 | **Grills are unbounded, with a running summary and an "I'm done" exit.** | Truest to `grill-me`. The summary makes "done" an informed click rather than a coin flip. |
| 8 | **No live cross-checking during grills.** | Would require every member's agent to phone home — the coupling this architecture exists to remove. |
| 9 | **Check reports are attributed to a role, not a file.** | The output's job is to say *who to go talk to*. A file list doesn't. |
| 10 | **`CONTRACT.md` is one file, in the repo, shared by everyone.** | Per-person summaries drift, reintroducing the exact bug this tool kills. Two people arguing at hour 14 point at the same line. |
| 11 | **Unresolved contradictions ship loudly, never block.** | The team is at one table; the tool notices and names, they decide. |
| 12 | **LLM API in the web app is deferred, not rejected.** | Nothing in v1 depends on it. Adding it later is additive. |
| 13 | **`merge-contract` also emits `contract.ts`** when the stack supports it. | Turns drift from an opinion into a compile error. The single biggest reliability upgrade available. |
| 14 | **`npx grill-with-me join <key>`** replaces zip download. | Kills the highest-probability failure in the member experience. Members never open a browser. |
| 15 | **`grill-my-role` reads sibling specs already committed.** | Recovers most of what live conflict detection provided, at zero coupling cost. Git was already there. |
| 16 | **The contract is amendable, and amendments are authoritative.** | A contract that can't be corrected becomes noise within hours, and a noisy check gets ignored. Non-negotiable for the product to survive a real build. |
| 17 | **Anyone can run `check-contract` and `amend-contract`** — not just the host. | The host is heads-down at hour 18. A bottleneck on the only person who can verify or correct the contract is a bottleneck on the whole feature. |
| 18 | **Packs are version-stamped** (`.room`). | Host republishes v2; a v1 holder currently has no way to know. |
| 19 | **No member-grill skill.** Members run the existing `grill-me`; `MY-ROLE.md` supplies scope, instructions, and the output contract. | Don't rebuild what exists. A markdown file is portable across agents where a `.claude/skills/` file isn't, works for someone who's never heard of `grill-me`, and means members install nothing. Cost: the spec file isn't guaranteed to be well-formed — pushed onto `merge-contract` to validate (P0-2). |

---

## 6. The web app

Deliberately dumb. If it starts growing a brain, something has gone wrong.

| Route | Does |
|---|---|
| `/` | Upload `grill-room.json` → creates a room → returns link + host token |
| `/r/[key]` | Project name + role list; claim a role; fallback zip download |
| `/api/room/[key]` | **JSON the CLI reads** — role list and pack contents |
| `/r/[key]/host` | Re-publish (bumps version), see who's claimed what |

**Stack:**

| Layer | Choice | Note |
|---|---|---|
| App | **Next.js (App Router)** on **Vercel Hobby** | Free. Function limits irrelevant — no model calls, so requests are milliseconds. |
| DB | **Supabase Postgres**, free tier | Packs are a few KB of markdown — store as `jsonb`. No storage bucket. |
| CLI | **npm package**, `npx grill-with-me` | Reads `/api/room/[key]`, writes files. Tiny. |
| Zip | **JSZip, client-side** | Browser fallback for anyone who can't run npx. |
| UI | **Tailwind + shadcn/ui** | Three screens. Don't over-build. |

**Gone from the previous plan:** Anthropic SDK, prompt caching, Supabase Realtime, presence, conflict banners, live panel, four server-side model calls.

**Region:** Supabase's region is fixed at project creation — match it to your Vercel region (`iad1` / `us-east-1`). Low stakes now that nothing is latency-sensitive, but free to get right.

---

## 7. Data model

One table. *(Simplified from two during the build: packs are rendered from the stored room `jsonb` at download time — see `lib/pack.ts` — so a `role_packs` table would only be a cache to keep in sync. The host skill emits semantics, the app owns the templates; template fixes ship without hosts re-running their grill.)*

```sql
rooms
  id          uuid pk
  key         text unique        -- speakable slug, e.g. "pearl-summit-88"
  host_token  text               -- bearer secret for re-publish; never sent to members
  version     int default 1      -- bumps on re-publish; stamped into grill/.room
  room        jsonb              -- the validated grill-room.json
  claims      jsonb              -- { "frontend": "Alice" } — informational only
  created_at  timestamptz
  expires_at  timestamptz        -- 30-day TTL, enforced on read (P1-5)
```

RLS is enabled with **no policies**: only the server's service key touches the table; the anon key is never used anywhere. An in-memory store with identical semantics backs tests and credential-less local dev.

No participants, turns, panels, or conflicts tables — those lived in the server-side-grilling design and died with it.

---

## 8. Build order

One developer with a coding agent. Exit criteria are binary.

> **Sequencing note:** you asked to start with role assignment and pack download. I've put the role-grill skill first anyway — shipping distribution before the payload is proven is building a delivery truck with no cargo. M1–M3 together produce exactly what you asked for. Override if you disagree.

### M1 — the `MY-ROLE.md` template *(1 day)*
The payload. No skill to write — design the template, then tune it against real runs. No web app, no host skill: hand-write a `PROJECT.md` and a `MY-ROLE.md`, run `/grill-me`, grill yourself. This milestone is **prompt iteration, not authoring**.

- [ ] After 8 answers the spec contains at least one **concrete API or data shape**, and **zero statements the user did not make**
- [ ] Run in a repo with existing code, it asks ≥1 question referencing something real in that repo
- [ ] With a sibling `grill/*-spec.md` present, it asks ≥1 question referencing that teammate's spec
- [ ] "I'm done" produces a well-formed spec with the fixed headings at any point — never a half-written file
- [ ] **Reliability gate:** across 5 runs, the spec file is written with all five headings at least 4 times. Below that, `MY-ROLE.md` isn't instructing strongly enough — fix the template, don't paper over it in `merge-contract`

### M2 — `grill-host` skill *(1–2 days)*
Host grill → proposed roles → confirm → `grill-room.json`.

- [ ] Proposed roles visibly reflect the host's answers, not a generic four-item list
- [ ] `grill-room.json` validates against its schema and contains a complete pack per role
- [ ] `known_stack` is captured well enough for M4 to decide on emitting `contract.ts`
- [ ] A pack extracted by hand and run through M1 produces a usable spec

### M3 — Web app + `npx` join *(2 days)*
Upload → room link → join from the CLI.

- [ ] Host uploads and gets a shareable link in under 30 seconds
- [ ] `npx grill-with-me join <key>` writes the correct files into a fresh repo, first try, no manual steps
- [ ] Browser zip fallback produces an identical file tree
- [ ] Malformed upload is rejected with a readable error — never a half-created room

### M4 — `merge-contract` skill *(2–3 days)*
All specs → `CONTRACT.md` + `contract.ts`.

- [ ] Four specs with one deliberate contradiction → lands in `## ⚠️ UNRESOLVED`, not silently reconciled
- [ ] Every endpoint and field names a **concrete path and type**, not a description
- [ ] On a TS stack, `contract.ts` **compiles**, and a deliberate field-name mismatch in consuming code fails `tsc`
- [ ] Missing role → `## ⚠️ NOBODY OWNS THIS`, never silent omission

### M5 — `check-contract` + `amend-contract` *(3 days, the uncertain one)*
Two halves of one loop — build them together.

- [ ] Break one field name in the repo → flagged, attributed to the correct role, with `file:line`
- [ ] **False-positive gate:** a clean repo produces **zero** findings across 3 runs
- [ ] After `amend-contract`, the previously-reported drift **stops being reported**
- [ ] Runs on a repo large enough to need scoping without blowing context (see §9)
- [ ] Stale `.room` version produces a warning

### M6 — Polish *(1–2 days)*
Re-publish → v2. Claim tracking. 30-day TTL. Example room + example outputs in the repo. README a stranger can follow.

**Total: ~10–13 working days.**

---

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **`check-contract` can't fit the repo in context.** A hackathon repo at hour 20 is not small. | **High** | Scope the check: derive the file set **from the contract** (only files implementing named endpoints/models), never read the whole tree. Prototype before committing to M5's estimate — this is the milestone most likely to slip. |
| **Spec files come back malformed**, so `merge-contract` can't parse them. | **High** *(new top gap)* | The trade for decision 19: no skill means no guaranteed output. Mitigate on both ends — `MY-ROLE.md` states the headings unmissably (M1 reliability gate), and `merge-contract` validates and fails loudly rather than merging garbage (P0-2). |
| **Setup friction.** Four people, four agents. | Low *(was High)* | Largely designed out. `npx … join` (decision 14) removes download/unzip/where-does-this-go, and decision 19 means **members install nothing at all** — they run a skill they already have, or follow instructions inline in a markdown file. Still test the README on someone who hasn't seen the project. |
| **The contract goes stale and the check becomes noise.** | Medium *(was unmitigated)* | `amend-contract` (decision 16) + three outcomes per finding. Watch for it anyway in real use: if people amend instead of fixing, the tool is being used to paper over drift. |
| **Grill quality varies by the member's model.** | Medium | Fixed section headings so even a mediocre grill parses. `merge-contract` should flag thin specs rather than silently merging them. |
| **Members never run the skill.** Nothing forces them. | Medium | Claim tracking (M6) gives the host visibility. Beyond that it's social, not software. |
| **Merge quality is the whole product** and rides on one skill run. | Medium | Validate before writing: required sections present, contract non-empty, `contract.ts` compiles. Test against deliberately messy specs. |
| **No demo.** The old plan's screenshot was a spec assembling itself live. | Medium | The demo is now `check-contract` catching a real break and naming the person — arguably a better story. Write the script early (P2-2). |

---

## 10. Open questions

- Does the host also take a role and get grilled twice? (Likely yes — host grill is about the *product*, role grill about their *layer*.)
- Fewer people than roles: one person takes two, or the role is dropped and flagged unowned in the contract?
- Does `grill-my-role` need a re-run mode that *extends* an existing spec, or is one pass enough?
- Should `amend-contract` require the affected roles to acknowledge, or is a dated log entry enough? (Log entry for v1.)

---

## 11. Delivery gaps

**P0** = before writing code. **P1** = before outside users. **P2** = later.

### P0

| ID | Gap | Fix | Lands |
|---|---|---|---|
| **P0-1** | **`grill-room.json` has no schema** — the contract between two components that ship separately. | Define and version it before M2. Validate on write and on upload. | M2 |
| **P0-2** | **Spec structure isn't guaranteed** — the load-bearing gap. With no member-grill skill (decision 19), nothing *enforces* that `grill-me` writes the five headings; `MY-ROLE.md` only asks. | Both ends: headings stated unmissably in `MY-ROLE.md` (M1 reliability gate), **and** `merge-contract` validates them. An unparseable spec must fail loudly and name the file — never merge silently. | M1 + M4 |
| **P0-3** | **`check-contract` scoping is undesigned** — the highest-risk unknown in the build. | Prototype file selection before committing to M5's estimate. | Before M5 |
| **P0-4** | **No skill-install instructions.** Every member hits this in the first 60 seconds. | README + one-liner printed by the CLI. Test on someone unfamiliar with the project. | M3 |

### P1

| ID | Gap | Fix | Lands |
|---|---|---|---|
| **P1-1** | Anonymous upload endpoint. | Size cap on `grill-room.json`, per-IP rate limit. Storage abuse only — no LLM cost exposure. | M3 |
| **P1-2** | Fewer people than roles — a certainty, not a question. | Decide: sequential double-role, or drop and flag as unowned. | M4 |
| **P1-3** | No merge validation — one skill run produces the deliverable unchecked. | Required sections, non-empty contract, `contract.ts` compiles. | M4 |
| **P1-4** | **Check report is absolute, not diffed.** At hour 18 it re-surfaces the 12 findings you already triaged, and people stop reading. | Mark new vs known/accepted findings. | M6 |
| **P1-5** | No data retention. | 30-day TTL on rooms. | M6 |
| **P1-6** | **No example room.** Nobody commits a team to this without seeing the output first. | Ship an example `grill-room.json` + example `CONTRACT.md` / check report in the repo. | M6 |
| **P1-7** | No success metric. | Proposed: **a team that used the packs reaches integration with zero contract mismatches.** Without an outcome measure you'll ship features instead. | Now |
| **P1-8** | Skills only tested in Claude Code. | Verify `grill-my-role` runs in one other agent before claiming cross-tool support. | M6 |

### P2

| ID | Gap |
|---|---|
| **P2-1** | `check-contract` as a pre-push hook or CI action — a manual command nobody remembers to run is worth little |
| **P2-2** | Demo script — the 2-minute story is "check catches a real break and names the person" |
| **P2-3** | **Stub generation from the contract** — mock route handlers, types, a migration, so frontend builds against a working mock from minute 1. Very high value, and a second product. Deliberately not v1. |
| **P2-4** | Usage analytics — do packs get downloaded *and run*? |
| **P2-5** | LLM in the web app (deferred by decision 12) — e.g. merge without a local agent |
| **P2-6** | Room templates / saved role sets for repeat teams |
