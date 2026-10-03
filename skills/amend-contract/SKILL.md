---
name: amend-contract
description: Stage and finalize a recorded contract amendment, updating current prose/types and append-only history together. Anyone can run this; pending role agreement stays visible.
---

Record the team's new agreement so check-contract can distinguish changed
requirements from implementation drift. Ask one question at a time to pin the
change to a concrete endpoint, field, table, or ownership agreement.

## Read before staging

Run `npx grill-with-me contract-status`. Read `grill/CONTRACT.md`, optional
`grill/contract.ts`, `grill/CONTRACT-HISTORY.jsonl`, and
`grill/CONTRACT-CHANGES.md`. Use the returned revision ID as the exact parent;
contract revision is independent of the member's room packVersion.

Stop on conflicting hashes or unfinished finalization. Retry the same staged
proposal after fixing its filesystem error; never erase its journal to bypass
recovery. Offline unknown source freshness is unverified, not proof of drift.
An old unrecorded contract must first be explicitly adopted with stable IDs and
the legacy history hash from status. Preserve its existing prose/history and
show the user any agreement changes; do not silently replace an old contract.

Name the roles touched by the change and ask whether they agreed when their
agreement is unknown. Do not refuse to record a not yet agreed change. Record
it as approval `pending` with those role slugs in `pendingRoles`; never claim
agreement for an absent role. `agreedBy` records who requested/agreed the change,
not proof that every touched role approved it.

## Stage and finalize one change

1. Copy the current prose to `grill/CONTRACT.next.md` and update only affected
   stable agreement blocks **in place in that draft**. Retain each
   `### [agreement:api.rank.response]` ID across revisions. Do not edit the
   canonical artifacts directly or batch unrelated amendments.
2. If types exist, stage matching `grill/contract.next.ts` and select
   `types: "replace"`, or select `preserve` only when types remain correct
   unchanged. Non-TypeScript contracts use `none`; it cannot delete existing
   types. The helper cannot prove prose/type semantic equivalence: review both.
3. Write `grill/CONTRACT-PROPOSAL.json`: schemaVersion 1, kind `amend`, exact
   `parentRevision`, one-line summary, `changedAgreementIds`, `approval`,
   `agreedBy`, `pendingRoles`, `types`, `amendmentResolution: []`, and
   `resolvesPending: []`. Changed IDs include all changed prose blocks and
   identify agreements affected by changed types. To record later approval,
   use agreed approval and put the explicitly approved pending revision IDs
   in `resolvesPending`; that produces a new revision without rewriting history.
4. Run `npx grill-with-me contract-finalize`, then `contract-status`. The
   finalizer updates canonical prose/optional types, appends the human-readable
   changes and hash-linked JSONL history, and writes state last. History is
   append-only. Mixed/interrupted artifacts remain unknown until identical
   retry; edited journal outputs, changed targets, or stale parents stop safely.
5. For TypeScript run `npx grill-with-me contract-typecheck <consuming-tsconfig>`.
   It checks actual bound imports and the consuming project's real typecheck
   (`npm run typecheck` or installed compiler `--noEmit -p`). Never use
   `npx tsc` to download tools or compile only the generated contract file.
   Unknown or unintegrated results are not a passing typed check. Compare
   failures with the prior baseline; identify newly mismatched producers/callers
   and repair them before claiming typed integration passed.

The current contract is the current truth; history records how it changed.
Future re-merges must explicitly preserve or reconcile every amendment against
their exact parent, so agreement changes cannot silently disappear.
Use `doc/contract-revisions.md` for executable proposal/recovery examples.

## Hand off

Tell the user to commit prose, optional types, both histories, and state together
and tell the team to pull. Name pending roles, source freshness, and typecheck
results. A successful file finalization does not claim human approval, runtime
semantic equivalence, or that implementation already matches the amended types.
