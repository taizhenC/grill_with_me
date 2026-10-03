# P1-05 live agent evaluation — 2026-10-02

The reproducible evaluation kit and bounded real-agent evidence are implemented. **The agent-quality release gate remains open.** Original structurally valid outputs contained invented decisions, Codex read outside the synthetic fixture, and several Claude invocations timed out. A partial matrix is not a passing matrix. Human pilot and deployment are still unexecuted.

## Delivered behavior

- Nine reproducible synthetic cases: five fresh member specs, three clean checks and one combined seeded drift check. Current room schemas/member identities validate before installation, and actual pack rendering/install planning/execution plus V2 receipt reading establish the installed local-role path.
- A bounded account-local runner: fresh CLI processes, verbatim interview transcript replay with fixed synthetic answers, exact prompts/arguments, frozen inputs/source hashes, selected tool/result/assistant events, timings/model evidence, first authored/observed and final artifacts, deterministic validation and distinct write/read-scope review. No mocked models, forced response schema or automatic structure-repair prompts.
- Canonical drift fixtures finalized through the actual copied CLI, with stable agreement blocks, child amendments and fresh matching revision status. Static SQL reads/writes match the agreed Database adapter boundary; live driver/HTTP wiring and consuming compiler integration are explicitly unverified.
- Member instructions now keep observed facts, respondent choices, recommendations and requested dependencies separate. Ending the interview does not accept unanswered recommendations. Unspecified status codes, return shapes and refresh mechanisms remain unresolved. Omission in a sibling spec is not contradiction.
- Manual rubric, privacy sanitization, timeout/process-tree regression checks, and a prepared 3–5-person team-pilot worksheet. POSIX invocations kill their own detached process group; Windows uses owned-PID `taskkill /T`.

These runs enter via the actual installed AGENTS and command/skill file references. Restricted Claude disables native slash discovery; Codex uses an explicit `.claude/commands` adapter instruction. This measures installed instruction-path behavior, not native editor discovery or end-to-end advertised HTTP join/publish.

## Actual measured results

Account-local versions were Claude Code 2.1.274, Codex CLI 0.144.4 and Node 24.21.0. Claude init/assistant events identify `claude-opus-5[1m]` / `claude-opus-5`, with auxiliary `claude-haiku-4-5-20251001` usage. Codex's preflight header identified default `gpt-5.6-sol`; measured JSON lacks per-call model ID. No model override was supplied. Dates are local America/New_York; some UTC records are October 3.

| Original validated member population | Observed result |
| --- | --- |
| Codex first authored structures | 5/5 pass; first equals final, one observed creation each, actual agent gate passes |
| Codex content faithfulness | 4/5; Frontend narrows unspecified “Reload” to “reload the page” |
| Codex observed read scope | 2/5; Backend, Auth and QA successfully read the account-home grilling skill |
| Codex content plus observed scope | 1/5, Database |
| Claude population | 2 complete / 1 timeout / 2 unattempted |
| Claude completed first structures | 2/2 pass; both have invented decisions, so no compliant member handoff |
| Claude agent gate | Both completed specs attempt denied wrapped gate commands; harness validation passes structure, agent execution incomplete |

Claude Frontend invents a discriminated close-result shape and unapproved implementation/status decisions. Claude Backend invents initial/list HTTP 200 behavior beyond the respondent's repeated-close HTTP 200 decision. Legitimate requirements under “What I need from other roles” are not themselves invention failures. Database's interview incorrectly calls a sibling's missing default a conflict; no spec was handed off before timeout.

The separately corrected canonical batch has two completed accurate clean reports using projected local selectors, plus an accurate no-local-role report that timed out after writing. The projected selectors do not satisfy the real V2 receipt schema, so those results are narrowed static revision checks. A subsequent full installed-receipt baseline completed with zero false findings. Its seeded report correctly covers all five category checks—field mismatch, forbidden owner write, missing implementation, absent roster owner and amendment precedence—but the invocation timed out after writing. Accurate artifacts and successful invocations are graded separately; these versions do not form three completed consistent clean runs.

Corrected Claude Frontend and Backend plus one corrected Codex Frontend case each passed the interview/content/first-structure/actual-gate/observed-scope rubric. They are separate prompt/configuration populations, and do not replace first-pass failures or establish a complete second matrix. The Codex rerun disables the known external skill per invocation; only this one case's observed read compliance was reverified.

See [manual grades and evidence](../evals/runs/2026-10-02/grades.md), [runtime/setup notes](../evals/runs/2026-10-02/setup-smokes.md), [runner instructions](../evals/README.md) and [human pilot worksheet](team-pilot-worksheet.md).

## Scope, preservation and limits

Original malformed room fixtures, interrupted dependency setup and defective earlier clean code are retained and explicitly excluded from reliability scores. Codex correctly found the missing close mutation in one defective purported clean fixture; that finding must not be counted as a false positive. No record is silently replaced by a corrected run.

The requested Codex workspace-write sandbox did not confine reads; ignored configuration did not disable globally discovered skills. The single stricter named-profile smoke was unsupported by the unelevated Windows backend and failed permitted fixture reads/writes too. No global setting, ACL, elevated backend or quota workaround was used. The known external skill is disabled only in later per-invocation configuration, with observed rerun compliance graded separately from filesystem confinement. Claude's requested tool allowlist also permitted some directory-local readonly shell inspection; it is not claimed as an exclusive command gate or OS security proof.

Evidence is sanitized by parsing JSON and recursively redacting private paths. Actual foreign skill content is omitted with its SHA256 and byte count, while command, exit status and scope failures remain. Selected semantic assistant outputs are preserved. Reasoning/signatures, auth/account metadata and quota percentages are not published. Write snapshots do not establish read scope; manual trace review is required even when the small home-read detector finds nothing.

Review reproduced a fragmented UTF-8 capture bug without model calls. Future stdout/stderr use separate streaming decoders, with a real subprocess regression splitting arrow/emoji bytes. The full dated evidence scan found no U+FFFD; historical traces were not silently repaired. An old no-local-role legacy selector also lacks its required roomKey, so that frozen record remains explicitly narrowed; future fixtures use a valid legacy envelope without replacing the completed evidence.

Each call has a 120-second and 2 MiB output ceiling, each run a 14-call/30-minute ceiling, and Claude an estimated USD 1 per-call cap. The runner stops on failures and never automatically retries. A quota warning was observed during setup; timeout cause remains unknown. An artifact written before timeout is retained without inventing a final completion event.

## Validation and remaining release work

After synchronization with main224877e, focused fixture/pack/spec checks passed (53 tests across three files) and TypeScript typecheck passed using Node24.21.0. Checks cover actual installed receipts, canonical finalization, hidden answers, scope/privacy, fragmented UTF-8 and descendant-process timeout. Evidence consistency and private-path/replacement-character scans also passed. The root agent will run combined main source/build/runtime/browser checks after merge, as requested. No live database/browser changes are part of this feature. Local Windows process-tree validation does not itself establish Linux/macOS execution evidence; the portable regression runs in CI.

P1-05 remains open until a complete consistently valid per-agent member matrix, three completed valid clean checks with zero false findings, and a completed seeded check meet the behavioral rubric. Read-scope evidence must be explicit; a successful output does not establish confinement. Execute the prepared consenting 3–5-person complete-loop pilot and record timings/rescue/findings before the human release gate can pass. No public service, package or schedule is claimed deployed by this evaluation work.

## Pre-merge sanitizer safety amendment

Root review found that the original lexical sanitizer guard could accept another Windows drive and that a selected root/ancestor junction could escape before child checks. The guard now rejects absolute relative-path results, verifies repository/allowed/selected realpath containment, rejects directory links through every selected path component, and preflights the complete tree before any write. Hardlinked or special files are rejected, including ignored extensions. File reads/writes recheck directory links and inode/device/link ownership, then verify the opened handle before writing or truncating. Stopped runs remain required; this is not an OS confinement claim against a hostile concurrent filesystem actor.

Seven actual sanitizer subprocess cases passed on local Windows/Node24: contained success with exact shorter Unicode output/truncation, outside selection, selected-root junction, selected ancestor junction, allowed-directory junction, hardlink rejection before changing either a preceding normal file or outside sentinel, and a real available D-drive selection rejection. The alternate-drive case is conditional on an explicitly supplied temporary parent and is skipped when no such drive is configured. No model invocation or measured artifact was changed for this amendment. The combined focused suite passed 60 tests across four files and typecheck passed before the PR head was updated.
