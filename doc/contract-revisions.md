# Local contract revisions and consuming TypeScript checks

Contract revisions belong to the shared Git checkout. Room `packVersion` records
published room/pack updates; it is not a contract version. No network call is
needed to finalize or inspect a contract. From source, substitute
`node /absolute/path/to/grill-with-me/cli/grill.mjs` for the installed command
below. Until registry publication, use a locally installed beta archive and
`npx --no grill-with-me` so nothing is downloaded implicitly.

## First merge

Keep the host's `grill-room.json` and every `grill/<role>-spec.md` in the shared
checkout. Run `npx --no grill-with-me merge-preflight` before generating prose.
It must pass. Read those specs, reconcile contradictions with the relevant
people, and stage concrete prose in `grill/CONTRACT.next.md`:

```markdown
# Contract — Sample

## Endpoints

### [agreement:api.rank.response]
GET /api/rank, implemented by src/producer.ts, returns
{ trails: { id: string; shadeScore: number }[] }. Backend owns the response;
Frontend reads shadeScore when rendering each trail. The integer score is 0–100.
```

Each agreement needs a stable exact H3 marker. Lowercase letters/digits with
dot/hyphen separators are accepted. Retain an ID when its agreement changes;
literal fenced/comment examples cannot create IDs. Duplicate IDs and empty
blocks fail. At least one and at most 100 blocks are supported. Prose is limited
to 1 MiB; optional staged types to 256 KiB; proposal JSON to 64 KiB.

For TypeScript, stage the corresponding exported shapes in
`grill/contract.next.ts`, then write `grill/CONTRACT-PROPOSAL.json`:

```json
{
  "schemaVersion": 1,
  "kind": "merge",
  "parentRevision": null,
  "summary": "Agree the rank response",
  "changedAgreementIds": ["api.rank.response"],
  "approval": "agreed",
  "agreedBy": ["Backend", "Frontend"],
  "pendingRoles": [],
  "types": "replace",
  "amendmentResolution": [],
  "resolvesPending": []
}
```

Use `types: "none"` for prose-only projects. `preserve` keeps existing types;
`replace` requires the staged type file. `none` cannot discard existing types.
Only record the approval actually reported by the people involved. A change
awaiting another role uses `approval: "pending"` and that roster role slug in
`pendingRoles`; requested changes remain recorded visibly, not silently agreed.

```sh
npx --no grill-with-me contract-finalize
npx --no grill-with-me contract-status
npx --no grill-with-me contract-typecheck tsconfig.json
```

`contract-finalize --dry-run` previews the proposed revision without writing;
`--force` is rejected. Publication still rechecks the original snapshot under
its lock, so a successful earlier preview does not authorize a stale parent.

Finalization writes `CONTRACT.md`, optional `contract.ts`, append-only
`CONTRACT-CHANGES.md`, append-only `CONTRACT-HISTORY.jsonl`, and finally
`CONTRACT-STATE.json`, all inside `grill/`. Commit those current artifacts
together. Staged/proposal files are working inputs, not another contract truth.
The source snapshot hashes normalized host context and each validated spec;
artifact hashes bind current prose/types/human-readable history. Revision IDs
hash canonical metadata, including their exact parent, without timestamps.
CRLF and LF hash identically. There is no remote freshness or model call.

## Amendments, adoption, and re-merges

Read status and both histories first. Copy current prose/types to the staged
paths, change the affected blocks, use kind `amend`, and set `parentRevision`
to the exact current ID returned by status. `changedAgreementIds` names every
changed prose block and explicitly identifies agreements affected by a type
change. The helper cannot map type declarations to prose semantically. Use one
summary per focused agreement change. The current prose/types are the current
truth; both histories are audit trails and are never silently overlaid.

To acknowledge later approval, use kind `amend`, agreed approval, and the exact
pending revision IDs in `resolvesPending`. Pending entries remain visible until
that explicit later record, including when source freshness is unknown.

Every later kind `merge` must acknowledge **every** previous kind `amend`
record in `amendmentResolution`. Each entry names its exact revision ID, decision
`preserved` or `reconciled`, and a concrete note. Preserved affected blocks must
retain their current hashes; preserved typed amendments also require unchanged
current types. A deliberate changed agreement needs `reconciled` and an explicit
reason. This bookkeeping proves preservation of hashed text, not approval truth
or semantic equivalence. The skill must settle actual agreements with people.

Old-format contracts/history stay intact until explicit kind `adopt` with
`parentRevision: null` and `legacyHistoryHash` equal to the value status reports.
Stage existing prose/types with stable IDs, review agreement changes explicitly,
and preserve previous human-readable history. There is no force bypass.

## Freshness and recovery

| Status | Meaning |
| --- | --- |
| fresh | Current artifact hashes and locally available source hashes match the recorded revision. |
| stale | A valid local source roster/spec snapshot differs from the revision's snapshot. |
| unknown | No recorded source/revision, source inputs unavailable/malformed, or unfinished/inconsistent finalization. |

Approval is independent: fresh hashes do not clear pending roles. A member
checkout without the host roster reports source freshness unknown. Changing a
room receipt's `packVersion` cannot change contract freshness. A hash chain is
local integrity bookkeeping, not a signed or tamper-proof history.

Publication holds an exclusive `CONTRACT-FINALIZE.lock`, checks the exact
original artifact snapshot, and persists `CONTRACT-PENDING.json` before any
canonical changes. Competing stale plans fail. Interrupted mixed artifacts are
unknown; retry the **same** proposal and staged outputs after fixing the I/O
problem. Changed targets/journal content stop for inspection. A killed process
can leave a lock or `*.contract-tmp`: confirm that process stopped, inspect the
journal, and remove only those abandoned leftovers before identical retry.
Never remove the journal to pretend recovery finished. Do not concurrently edit
contract files; these checks coordinate finalizers, not arbitrary editors or
hostile filesystem changes. Atomic renames and flushes do not guarantee a
five-file transaction across sudden power loss.

## Real consuming TypeScript example

`examples/type-integration/` contains a declared project typecheck, tsconfig,
generated contract, and both producer and consumer imports. Install that
example's declared dependencies explicitly, then run the installed CLI gate
from its directory. Correct code passes. Replace `src/consumer.ts` with
`consumer-mismatch.txt`; the real project typecheck fails with TS2339 because
`shadeRating` is absent while `shadeScore` exists. Restore it afterward.

The gate resolves installed TypeScript from the consuming project, analyzes
bound import usages under the selected tsconfig, and runs its declared
`npm run typecheck`. Without that script it invokes only the installed compiler
with `--noEmit -p`. It additionally enforces selected-project diagnostics, so a
script that exits zero cannot conceal a selected-config mismatch. It never
downloads TypeScript. Side-effect or unused imports report `unintegrated` even
if compilation passes. Missing compiler/config is `unknown`; select each
consuming leaf config instead of a solution with project references.

Named/default/namespace bound imports and aliases resolved to the generated
module are supported. Import-type expressions, custom compiler pipelines and
project-reference graphs are not exhaustively analyzed. A result only proves
some actual static usage, not that both sides of every endpoint use it. The
example explicitly demonstrates both. Static types cannot validate network
payloads or prove that prose, generated types, and runtime behavior agree.
Compare failures with the project's prior baseline and inspect producer/caller
boundaries before declaring a clean contract check. Passing a standalone
generated file is insufficient; TypeScript's project/config behavior is
documented in [the official CLI reference](https://www.typescriptlang.org/docs/handbook/compiler-options.html)
and [Compiler API guide](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API).
