# Contract — Trailhead
_Example of what `merge-contract` produces. Generated from 3 role specs. Amendments in CONTRACT-CHANGES.md override this file._

## Endpoints

- `POST /api/rank` — `app/api/rank/route.ts` — owner: **Backend**
  - Request: `{ city: string }`
  - Response 200: `{ trails: { id: string; name: string; shadeScore: number; blurb: string }[] }` — exactly 3 trails, `shadeScore` is an integer 0–100
  - Response 4xx/5xx: `{ error: string }` — Frontend renders `error` verbatim in the results area

## Data model

- Table `trails` — owner: **Backend**
  - `id uuid pk`, `name text`, `city text`, `shade_score int`, `explanation jsonb`, `created_at timestamptz`
  - `explanation` shape is owned by **Shade model**: `{ treeCover: number; aspect: string; bestHours: string; summary: string }`

## State ownership

- Trail data: **Backend** writes at seed time; nothing writes at runtime.
- `explanation` contents: **Shade model** decides the fields; Backend stores them opaque.
- UI state (selected trail, loading): **Frontend** only.

## Auth model

- None. No accounts (out of scope). Nothing is faked.

## Error behavior

- `POST /api/rank` with an unknown city → 200 with `{ trails: [] }`, not an error — Frontend shows the empty state.
- Any 5xx → Frontend shows "try again" with the returned `error` string.

## ⚠️ UNRESOLVED — decide this before you code

- **shadeScore scale.** Frontend's spec says "a percentage"; Shade model's spec says "0–100 integer, not a percentage — 100 is 'fully shaded at 2pm', which no trail hits." Same numbers, different labels on the detail page. Decide what the UI calls it. _(Frontend + Shade model)_

## ⚠️ NOBODY OWNS THIS

- Seeding trail data for a **second** demo city (Frontend's spec assumes a city switcher; no role claimed seeding beyond Austin).
