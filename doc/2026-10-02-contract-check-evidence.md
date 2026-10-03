# Contract-check evidence and fixture projections — 2026-10-02

The current Codex clean-baseline report flagged a Frontend helper returning the raw fetch Response rather than parsing an agreed Backend response body. Root and an independent reviewer found no contract clause agreeing the Frontend helper's return or consumption behavior; this is an unsupported drift finding, retained in its original evidence.

The same report identified a different concern: the supposedly clean injected database adapter promised `TicketRow[]`, including required `title`, for every query, while the agreed close SQL returns only `id, closed`. That is a real static projection/type imprecision in the fixture. It is not safely counted as a false finding because the hidden expectation says zero. The frozen clean cases using that adapter remain limited evidence; no compiler or live driver result is inferred from the old report.

The shared check skill now requires the actual current contract clause and incompatible code behavior. A producer's HTTP body agreement does not force every caller to parse it or return its parsed shape. Missing type integration or untraced behavior belongs under Unverified; actual incompatible field consumption remains drift.

The current Codex seeded report also detected missing billing code while treating Payments as an ordinary existing owner, although Payments is absent from the roster. The skill now grounds attribution in the shared roster/contract Roles and marks absent owners as unverified, asking the team to assign or reconcile them. Missing implementation and unknown ownership are separate findings; no fictional teammate is invented.

Future fixtures model query result projections generically and explicitly select the close row's `id`/`closed` fields, retaining list `id`/`title`/`closed`, the agreed SQL and injected-driver limitation. A real installed-TypeScript consumer test checks the generated fixture files: list titles remain available, close id/closed remain available, and accessing close.title must be a type error. It does not claim a live database or fixture-installed compiler.

Skill, fixture/test and documentation changes are separate focused commits. Original in-flight matrices keep their frozen inputs and source hashes. Root runs affected checks after this feature merge, then preserves a separate bounded clean/seed run on the corrected fixture version. Passing behavior is recorded only after independent grading in the final integration report; existing failures are not replaced.
