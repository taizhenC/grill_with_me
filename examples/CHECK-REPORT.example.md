# Contract check — 2026-08-17 14:20
_Example of what `check-contract` produces. Against CONTRACT.md + 1 amendment. 6 files in scope._

## ⚠️ Backend
- `app/api/rank/route.ts:31` — returns `{ trails: [{ id, name, shade_score, blurb }] }`;
  CONTRACT.md §Endpoints says `shadeScore`. Frontend reads `t.shadeScore`, so the
  score renders as `undefined` for every trail.
  → Talk to Frontend before changing either side.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore
- **NEW** `app/api/rank/route.ts:12` — unknown city returns `404 { error }`;
  CONTRACT.md §Error behavior says `200 { trails: [] }` so the UI can show its
  empty state. Frontend currently renders the "try again" error for a typo.
  → Talk to Frontend.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ⚠️ Shade model
- `lib/score.ts:48` — writes `explanation.bestHours` as a `{ from, to }` object;
  CONTRACT.md §Data model says `bestHours: string`. The detail page prints
  `[object Object]`.
  → Talk to Frontend. Amended once already (see CONTRACT-CHANGES.md 13:05) —
  if the object shape is the real agreement now, amend rather than revert.
  Outcome: [ ] fix the code   [ ] contract is wrong → run amend-contract   [ ] accepted, ignore

## ✅ Frontend
- No drift detected. `app/page.tsx` and `app/trail/[id]/page.tsx` match the
  contract's request and response shapes.

## Unverified
- Seeding for a second demo city — CONTRACT.md flags it under **NOBODY OWNS
  THIS** and no file implements it, so there is nothing to compare.

---

3 findings, 1 new. **One conversation clears two of them:** Backend and
Frontend agreeing on the response shape (`shadeScore`) and on what an unknown
city returns.
