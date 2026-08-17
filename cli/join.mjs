#!/usr/bin/env node
/**
 * npx grill-with-me join <room-key> [--role <slug>] [--base <url>] [--force]
 *
 * Fetches your role's pack from the grill-with-me web app and writes it into
 * the current directory (your repo root). Zero dependencies on purpose —
 * npx cold-start stays fast and nothing can break at minute 0.
 */

import { writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import { createInterface } from "node:readline/promises";
import process from "node:process";

const DEFAULT_BASE = process.env.GRILL_WITH_ME_URL ?? "https://grill-with-me.vercel.app";

function usage(exitCode) {
  console.log(`Usage:
  npx grill-with-me join <room-key> [--role <slug>] [--base <url>] [--force]

Run it from your repo root. It writes AGENTS.md, grill/, and .claude/skills/
into the current directory, then tells you what to run next.

Options:
  --role <slug>   which role to join (skips the picker)
  --base <url>    web app origin (default: ${DEFAULT_BASE})
  --force         overwrite files that already exist
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (command !== "join") usage(command ? 1 : 0);
  const args = { key: null, role: null, base: DEFAULT_BASE, force: false };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--role") args.role = rest[++i] ?? null;
    else if (arg === "--base") args.base = rest[++i] ?? args.base;
    else if (arg === "--force") args.force = true;
    else if (arg.startsWith("--")) usage(1);
    else if (!args.key) args.key = arg;
    else usage(1);
  }
  if (!args.key) usage(1);
  return args;
}

async function fetchJson(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    fail(`could not reach ${url}\n  ${err.cause?.code ?? err.message}`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    fail(body.error ?? `server said ${res.status} for ${url}`);
  }
  return body;
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

async function pickRole(summary) {
  console.log(`\n${summary.project.name} — roles:\n`);
  summary.roles.forEach((role, i) => {
    const taken = role.claimedBy ? `  (taken by ${role.claimedBy})` : "";
    console.log(`  ${i + 1}. ${role.name}${taken}\n     ${role.description}`);
  });
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question("\nWhich number is yours? ");
    const index = Number(answer.trim()) - 1;
    const role = summary.roles[index];
    if (!role) fail(`"${answer.trim()}" is not one of the options`);
    return role.slug;
  } finally {
    rl.close();
  }
}

/** Refuse paths that would escape the current directory. */
function safeTarget(root, packPath) {
  const target = resolve(root, packPath);
  const rel = relative(root, target);
  if (isAbsolute(rel) || rel.startsWith("..")) {
    fail(`pack contains an unsafe path: ${packPath}`);
  }
  return target;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const base = args.base.replace(/\/+$/, "");

  const summary = await fetchJson(`${base}/api/room/${args.key}`);
  const roleSlug = args.role ?? (await pickRole(summary));

  const pack = await fetchJson(
    `${base}/api/room/${args.key}?role=${encodeURIComponent(roleSlug)}`,
  );

  const root = process.cwd();
  const clashes = [];
  for (const file of pack.files) {
    if (!args.force && (await exists(safeTarget(root, file.path)))) {
      clashes.push(file.path);
    }
  }
  if (clashes.length > 0) {
    fail(
      `these files already exist (use --force to overwrite):\n  ${clashes.join("\n  ")}`,
    );
  }

  for (const file of pack.files) {
    const target = safeTarget(root, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
    console.log(`  wrote ${file.path}`);
  }

  const role = summary.roles.find((r) => r.slug === roleSlug);
  console.log(`
✓ You're set up as ${role?.name ?? roleSlug} (pack v${pack.version}).

Next:
  1. Open your AI editor in this folder.
  2. Run /grill-me — or tell your agent: "read grill/MY-ROLE.md and follow it".
  3. Answer its questions. When you're done it writes grill/${roleSlug}-spec.md.
  4. Commit that file so your host can merge the contract.
`);
}

main().catch((err) => fail(err.message));
