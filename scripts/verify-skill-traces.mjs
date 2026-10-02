import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const skills = ["grill-host", "merge-contract", "check-contract", "amend-contract"];
const expected = await Promise.all(skills.map((name) => realpath(resolve(root, "skills", name, "SKILL.md"))));
const routes = ["api/room/[key]", "api/skills/[bundle]"];

for (const route of routes) {
  const path = resolve(root, ".next/server/app", route, "route.js.nft.json");
  const trace = JSON.parse(await readFile(path, "utf8"));
  assert.ok(Array.isArray(trace.files), `Missing file list in ${path}; run npm run build first`);
  const files = new Set(await Promise.all(trace.files.map((file) => realpath(resolve(dirname(path), file)))));
  for (const [index, skill] of expected.entries()) {
    assert.ok(files.has(skill), `${route} production trace is missing skills/${skills[index]}/SKILL.md`);
  }
}

console.log("Production traces include all four skills for both pack-serving routes.");
