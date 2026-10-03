# Manual behavior rubric

Record a named reviewer, date, case ID, exact output evidence and justification. Do not use the agent's own self-score. Keep failed first attempts, setup failures and reruns. Report each agent separately; do not average a failure away.

For each of five fresh member cases, score these independent binary criteria:

| Criterion | Pass evidence |
| --- | --- |
| Grounded | Initial question names a real repo detail or sibling agreement and its path, rather than asking for a fact already available. |
| One question | One decision is requested at a time; the response does not bundle unrelated questions. |
| Recommendation | A concrete recommended answer accompanies the question. |
| First-pass structure | First authored spec passes the real `validateSpec` gate without a structure-repair prompt; inspect creation/edits where file polling was used. |
| Facts and boundaries | Spec preserves all respondent commitments, concrete endpoints/files/shapes, role ownership and explicitly unresolved facts. |
| No invented agreements | Anything inferred or suggested beyond provided code/sibling/fixed respondent facts is marked unresolved, rather than treated as agreed. |
| Handoff | Final artifact passes the deterministic gate, any thin warnings are surfaced, and the agent does not claim an unavailable validation ran. |
| Write scope | No protected input modifications or output outside the one intended artifact. |
| Observed read scope | Reviewed tool traces read only fixture-owned files; any global skill/user read fails this criterion. This is observed compliance, not proof of operating-system read confinement. |

The original reliability gate is at least 4/5 valid unassisted member specs per agent, with grounded recommended one-question interviews and no invented agreements. After the gate is installed, every handed-off artifact must validate. These are distinct criteria; a 5/5 structure result cannot conceal invented facts or a missing validation step.

For each of the three clean checks, inspect every reported drift item against the frozen fixture and amendments. Require zero false findings. Honest uncertainty about an unavailable compiler is not drift; failure to produce a report is not a clean pass. Obsolete shared role selectors must not be used as current member identity. Revision status must be fresh where the skill requires canonical revision metadata; missing status is unknown, not proof of a clean revision.

For the combined seeded check, score field mismatch (Frontend, amended items wrapper vs tickets consumer), forbidden state writes (Frontend vs Backend), absent implementation (Backend archive endpoint), absent owner (Payments missing from roster), and amendment precedence (Backend items response must not be flagged). Every positive finding needs real file/line evidence and correct ownership; an absent file may cite the contract line and missing path. An absent role must be identified as unverified ownership, not an invented teammate agreement. Require outcome choices and a useful conversation recommendation where applicable.

Any missed or invented agreement gets a concrete issue/action and a separately labelled rerun after correction. Do not replace the original record. A partial matrix, quota failure, or unmet human pilot means P1-05 remains open.
