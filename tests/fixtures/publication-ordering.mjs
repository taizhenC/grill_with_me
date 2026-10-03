// Preload only in the controlled two-process publication test. Gate real file
// operations without changing CLI code, record contents, or filesystem results.
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";

const { readFile, writeFile, rename, lstat } = fs.promises;
const root = process.cwd();
const role = process.env.GRILL_PUBLICATION_ORDERING_ROLE;
if (role !== "A" && role !== "B") throw new Error("missing publication ordering fixture role");
const recovery = join(root, ".grill-with-me-publish.json");
const temporary = `${recovery}.tmp`;
const marker = (name) => join(root, `fixture-${name}`);
const signal = (name) => writeFile(marker(name), "ready");
async function wait(name) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try { await lstat(marker(name)); return; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`publication ordering fixture deadline: ${name}`);
}

let observedAbsent = false;
let winnerRenamed = false;
let laterTemporaryChecks = 0;
fs.promises.readFile = async function (path, ...args) {
  try { return await readFile(path, ...args); }
  catch (error) {
    if (String(path) === recovery && error.code === "ENOENT" && !observedAbsent) {
      observedAbsent = true;
      if (role === "B") { await signal("B-observed-absent"); await wait("A-renamed"); }
      else await wait("B-observed-absent");
    }
    throw error;
  }
};
fs.promises.rename = async function (from, to) {
  await rename(from, to);
  if (role === "A" && String(to) === recovery) {
    winnerRenamed = true;
    await signal("A-renamed");
    await wait("B-temporary-written");
  }
};
fs.promises.writeFile = async function (path, ...args) {
  await writeFile(path, ...args);
  if (role === "B" && String(path) === temporary) {
    await signal("B-temporary-written");
    await wait("A-observed-temporary");
  }
};
fs.promises.lstat = async function (path, ...args) {
  const result = await lstat(path, ...args);
  // A's first check belongs to the whole-file preflight; its second is the
  // explicit temporary-file guard, which will throw using this actual stat.
  if (role === "A" && winnerRenamed && String(path) === temporary && ++laterTemporaryChecks === 2) {
    await signal("A-observed-temporary");
  }
  return result;
};
syncBuiltinESMExports();
