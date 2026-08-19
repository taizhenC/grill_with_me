---
name: grill-host
description: Grill the host about a team project, propose roles, and emit grill-room.json for publishing to grill-with-me. Use when a team lead wants to set up a grill-with-me room.
---

You are setting up a **grill-with-me** room. The person you are talking to is
the host — the one team member who does all the setup so the others only have
to join. Your output is a single file, `grill-room.json`, which the host
uploads to the grill-with-me web app.

Work in three phases, in order. Do not skip ahead.

## Phase 1 — grill the host about the project

Interview the host relentlessly about the PRODUCT until you reach a shared
understanding. Walk down each branch of the decision tree, resolving
dependencies between decisions one by one. For each question, provide your
recommended answer. Ask one question at a time — multiple questions at once
is bewildering.

If you are inside a repo that already has code, read it first and ground your
questions in what exists rather than asking about it.

You must come out of this phase knowing:

- What the product does, in one sentence a stranger understands
- What the demo shows at the end — the exact happy path
- What is explicitly OUT of scope
- The one thing that must work (if everything else fails, this still demos)
- Mode: hackathon, side project, or production
- If hackathon: how many hours remain until the demo
- The stack the team already knows (this later decides whether a typed
  contract can be generated — for TypeScript teams, ask enough to be sure)
- How many people are building, and roughly who is comfortable with what

Do not accept vague answers where the contract will need precision. "It
returns the results" is not an answer; "it returns ranked trails with a
shade score" is.

## Phase 2 — propose roles

Propose roles as LAYERS (Frontend, Backend, UI/UX — finer when the project
warrants it: AI/prompt, data, deploy). Do not propose more roles than there
are people. For each role, draft:

- `slug` — lowercase kebab-case, e.g. `frontend`, `ui-ux`
- `name` — display name
- `description` — one or two sentences on what this role owns
- `owns` — concrete surfaces (files, routes, tables) where known
- `mustCover` — the questions this role's grill must not skip, based on what
  you learned in Phase 1 (e.g. for backend: "exact response shape of the
  ranking endpoint")

Show the proposal. Let the host rename, add, remove, or re-scope roles.
Iterate until they confirm. `mustCover` is where your Phase 1 understanding
pays off — write entries specific to THIS project, not generic ones.

## Phase 3 — emit grill-room.json

Write `grill-room.json` in the current directory, exactly this shape:

```json
{
  "schemaVersion": 1,
  "project": {
    "name": "...",
    "idea": "...",
    "mode": "hackathon",
    "hoursLeft": 18,
    "knownStack": "...",
    "demoTarget": "...",
    "outOfScope": ["..."],
    "mustWork": ["..."]
  },
  "roles": [
    {
      "slug": "frontend",
      "name": "Frontend",
      "description": "...",
      "owns": ["..."],
      "mustCover": ["..."]
    }
  ]
}
```

Rules:

- `schemaVersion` is the literal number `1`
- `mode` is one of `"hackathon"`, `"side_project"`, `"production"`
- `hoursLeft` is a positive integer, or `null` when there is no deadline
- Role slugs are lowercase kebab-case and unique
- Every string you write must come from the host's answers — do not invent
  scope the host did not agree to

Then tell the host exactly this:

1. Publish it and share the link the command prints:

   ```
   npx grill-with-me publish grill-room.json
   ```

   (Or drop the file on the grill-with-me web app — same result. The command
   also saves the host token and gitignores it, so re-publishing later is
   `npx grill-with-me republish`.)

2. Each member runs `npx grill-with-me join <room-key>` from their own repo
   checkout, picks a role, and is grilled by their own agent.
3. Once every spec is committed, run the `merge-contract` skill.

Do not run any of these yourself — publishing is the host's call, and the
room link is theirs to share.
