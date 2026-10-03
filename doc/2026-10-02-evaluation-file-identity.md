# Evidence file identity on Windows Node 22 — 2026-10-02

The sanitizer now preserves pathname and opened-descriptor identities separately, allowing ordinary contained evidence to be sanitized on the observed Windows Node22.15.0 runtime without dropping device, inode or link checks. The prior implementation compared metadata returned by two different filesystem APIs and rejected the valid file before writing. The Node24 app requirement and Node22 CLI support are unchanged.

Direct probes of newly created owned temporary files showed:

| Runtime on this Windows machine | Path `lstat.dev` | Opened `FileHandle.stat().dev` | Inode / links |
| --- | --- | --- | --- |
| Node22.15.0 | 0 | 2216591337 | Same inode, one link |
| Node24.21.0 | 2216591337 | 2216591337 | Same inode, one link |

This is observed local evidence, not a claim about an upstream bug or release fixing it. Node documents [filesystem stat records](https://nodejs.org/api/fs.html#class-fsstats) and [descriptor stat](https://nodejs.org/api/fs.html#filehandlestatoptions); those APIs are the independent comparison channels used here.

Whole-tree preflight still checks lexical/real containment, directory links, regular-file type and exactly one link before any mutation. For each file it now opens a read-only handle, binds that descriptor to the path using inode and link count, preserves nonzero path-to-descriptor device consistency, and rechecks the path/location after opening. It records the exact path and descriptor metadata separately. Every later read/write must match the current pathname to the pathname snapshot and the opened descriptor to the descriptor snapshot, including exact device/inode/link values. The write handle remains `r+`; validation happens before writing or truncating.

Actual copied-sanitizer subprocess tests passed on both Node22.15.0 and Node24.21.0, including ordinary exact shorter Unicode output, outside selection, selected-root/ancestor/allowed junction rejection, hardlink preflight with unchanged normal/outside sentinels, and an available real C-to-D-drive selection. Added checks reject a file replaced after preflight and independent pathname/descriptor device changes with the inode unchanged; link-count changes also reject. The device-change test mutates copies of real stat records to isolate that comparison, rather than pretending a synthetic record is filesystem integration evidence.

Focused verification after the fix: nine sanitizer tests pass on each runtime. The combined fixture/pack/spec/sanitizer suite passes 62 tests across four files on both Node22.15.0 and Node24.21.0, with the actual alternate-drive case enabled; Node24 typecheck and diff checks also pass. No model invocation, original evaluation output, outside sentinel or global setting changed. This remains maintenance of stopped trusted records, not OS confinement against a hostile concurrent filesystem actor. The incomplete P1-05 matrix and human pilot remain open.
