import { lstat, realpath, readdir, open } from "node:fs/promises";
import { resolve, join, relative, isAbsolute, sep, dirname } from "node:path";

const unsafe = () => new Error("Select an existing, unlinked evidence directory inside this repository's evals/runs; stop active runs first.");
function contained(parent, child) {
  const location = relative(parent, child);
  return !isAbsolute(location) && location !== ".." && !location.startsWith(`..${sep}`);
}

export function assertFileIdentity(info, expected) {
  if (!info.isFile() || info.nlink !== 1n || info.dev !== expected.dev || info.ino !== expected.ino || info.nlink !== expected.nlink)
    throw unsafe();
}

async function directoryChain(parent, child) {
  if (!contained(parent, child)) throw unsafe();
  let current = parent;
  for (const component of ["", ...relative(parent, child).split(sep).filter(Boolean)]) {
    current = join(current, component);
    const entry = await lstat(current);
    if (entry.isSymbolicLink() || !entry.isDirectory()) throw unsafe();
  }
}

// Preflight the whole selected tree before any write. This is a stopped-run
// maintenance operation, not OS confinement against a hostile concurrent actor.
export async function prepareEvidenceRoot(repository, selected) {
  const repo = resolve(repository), allowed = join(repo, "evals/runs");
  const root = resolve(selected || "");
  if (!selected || !contained(allowed, root)) throw unsafe();
  await directoryChain(repo, allowed);
  await directoryChain(allowed, root);
  const [realRepo, realAllowed, realRoot] = await Promise.all([realpath(repo), realpath(allowed), realpath(root)]);
  if (!contained(realRepo, realAllowed) || !contained(realAllowed, realRoot)) throw unsafe();

  const directories = new Map(), files = new Map();
  async function assertLocation(path) {
    await directoryChain(realRepo, dirname(path));
    if (!contained(realRoot, await realpath(path))) throw unsafe();
  }
  async function collect(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    directories.set(directory, entries);
    for (const entry of entries) {
      const path = join(directory, entry.name), info = await lstat(path, { bigint: true });
      if (info.isSymbolicLink()) throw unsafe();
      if (info.isDirectory()) await collect(path);
      else {
        assertFileIdentity(info, info);
        await assertLocation(path);
        const handle = await open(path, "r");
        try {
          const descriptor = await handle.stat({ bigint: true });
          // Windows Node22.15 reports path.dev=0 while fstat has the volume
          // device. Bind by inode/link count, retaining both exact devices
          // for later comparisons through the same APIs that captured them.
          if (!descriptor.isFile() || descriptor.ino !== info.ino || descriptor.nlink !== 1n ||
            (info.dev !== 0n && descriptor.dev !== info.dev)) throw unsafe();
          assertFileIdentity(await lstat(path, { bigint: true }), info);
          await assertLocation(path);
          files.set(path, { path: info, descriptor });
        } finally { await handle.close(); }
      }
    }
  }
  await collect(realRoot);

  async function ownedFile(path, mode, operation) {
    const expected = files.get(path);
    if (!expected) throw unsafe();
    await assertLocation(path);
    const current = await lstat(path, { bigint: true });
    assertFileIdentity(current, expected.path);
    const handle = await open(path, mode);
    try {
      const info = await handle.stat({ bigint: true });
      assertFileIdentity(info, expected.descriptor);
      return await operation(handle);
    } finally { await handle.close(); }
  }
  return {
    root: realRoot,
    entries: directory => directories.get(directory),
    read: path => ownedFile(path, "r", handle => handle.readFile("utf8")),
    write: (path, value) => ownedFile(path, "r+", async handle => {
      await handle.writeFile(value, "utf8");
      await handle.truncate(Buffer.byteLength(value));
    }),
  };
}
