#!/usr/bin/env node
/**
 * npx grill-with-me — the whole product's command line.
 *
 *   join <key|url>     member: fetch your role's pack into this repo
 *   check-spec         member: is the spec you just wrote well-formed?
 *   host               host:   install the host-side skills into this repo
 *   publish <file>     host:   publish grill-room.json, get the room link
 *   republish [file]   host:   swap the room content, bump the version
 *   status [key|url]   anyone: who has claimed what
 *
 * Zero dependencies on purpose — npx cold-start stays fast and nothing can
 * break at minute 0. Everything intelligent still happens in the user's own
 * agent; this only moves files and prints what to do next.
 */

import {
  writeFile,
  readFile,
  readdir,
  mkdir,
  appendFile,
} from "node:fs/promises";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import process from "node:process";

const DEFAULT_BASE =
  process.env.GRILL_WITH_ME_URL ?? "https://grill-with-me.vercel.app";

/** Written by `publish` so `republish` and `status` need no arguments. */
const CONFIG_FILE = ".grill-with-me.json";

/** Must match AGENTS_BLOCK_START/END in lib/pack.ts. */
const AGENTS_START = "<!-- grill-with-me:start -->";
const AGENTS_END = "<!-- grill-with-me:end -->";

const GRILL_COMMAND = "grill-my-role";

/**
 * Commands we print for someone else to run. On the canonical deployment
 * `--base` is noise; anywhere else — a fork, a dev server — leaving it off
 * sends the whole team to the wrong app. Mirrors lib/commands.ts.
 */
const joinLine = (key, base, role) =>
  `npx grill-with-me join ${key}${role ? ` --role ${role}` : ""}${
    base === DEFAULT_BASE ? "" : ` --base ${base}`
  }`;

/* ------------------------------------------------------------------ */
/* output                                                              */

const plain = !process.stdout.isTTY || process.env.NO_COLOR;
const paint = (code, s) => (plain ? s : `\u001b[${code}m${s}\u001b[0m`);
const bold = (s) => paint("1", s);
const dim = (s) => paint("2", s);
const green = (s) => paint("32", s);
const red = (s) => paint("31", s);

function fail(message, hint) {
  console.error(`\n${red("✗")} ${message}`);
  if (hint) console.error(`  ${dim(hint)}`);
  process.exit(1);
}

async function version() {
  const pkg = join(dirname(fileURLToPath(import.meta.url)), "package.json");
  try {
    return JSON.parse(await readFile(pkg, "utf8")).version;
  } catch {
    return "unknown";
  }
}

function usage(exitCode = 0) {
  const out = exitCode === 0 ? console.log : console.error;
  out(`${bold("grill-with-me")} — grill a team, then hold everyone to the contract.

${bold("If a teammate sent you a link or a room key:")}
  npx grill-with-me join <room-key|url>     fetch your role's pack into this repo
    --role <slug>    skip the picker
    --name <name>    who to show on the host's board (skips the prompt)
    --dry-run        show what would change, write nothing
    --no-claim       don't tell the host's board you took the role
    --force          overwrite pack files this repo already has
  npx grill-with-me check-spec              is the spec you just wrote well-formed?

${bold("If you are the host:")}
  npx grill-with-me host                    install grill-host + merge-contract here
  npx grill-with-me publish <file>          publish grill-room.json, get the link
  npx grill-with-me republish [file]        replace the room content, bump version
  npx grill-with-me status [room-key|url]   who has claimed what

${dim(`Run join/host from your repo root. Everything else works anywhere.
Options everywhere: --base <url> (default ${DEFAULT_BASE}), --help, --version`)}
`);
  process.exit(exitCode);
}

/* ------------------------------------------------------------------ */
/* args                                                                */

const VALUE_FLAGS = ["--role", "--base", "--name", "--token", "--key"];
const BOOL_FLAGS = ["--force", "--dry-run", "--no-claim", "--help", "--version"];

function parseArgs(argv) {
  const args = { command: null, positional: [], base: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (VALUE_FLAGS.includes(arg)) {
      const value = argv[++i];
      if (value === undefined) fail(`${arg} needs a value`);
      args[arg.slice(2)] = value;
    } else if (BOOL_FLAGS.includes(arg)) {
      args[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = true;
    } else if (arg.startsWith("-")) {
      if (arg === "-h") args.help = true;
      else if (arg === "-v") args.version = true;
      else fail(`unknown option ${arg}`, "npx grill-with-me --help");
    } else if (!args.command) {
      args.command = arg;
    } else {
      args.positional.push(arg);
    }
  }
  return args;
}

/**
 * People paste whatever they were sent — a bare key, the room link, or the
 * host link. All three mean the same room, and the link also tells us which
 * deployment it lives on, so nobody has to know about --base.
 */
function parseRoomRef(raw) {
  if (!raw) return { key: null, base: null };
  const trimmed = raw.trim().replace(/[),.]+$/, "");
  const match = trimmed.match(/^https?:\/\/[^/]+(?:\/[^/]*)*?\/r\/([^/?#]+)/);
  if (match) {
    return { key: match[1], base: new URL(trimmed).origin };
  }
  if (/^https?:\/\//.test(trimmed)) {
    fail(`that URL has no room in it: ${trimmed}`, "expected .../r/<room-key>");
  }
  return { key: trimmed, base: null };
}

/* ------------------------------------------------------------------ */
/* http                                                                */

async function request(url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    fail(
      `could not reach ${url}`,
      `${err.cause?.code ?? err.message} — check your connection, or --base`,
    );
  }
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    const detail =
      body.errors?.join("\n  ") ??
      body.error ??
      `server said ${res.status} for ${url}`;
    fail(detail, res.status === 404 ? "double-check the room key" : undefined);
  }
  return body;
}

const getJson = (url) => request(url);

const postJson = (url, body, headers = {}) =>
  request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/* ------------------------------------------------------------------ */
/* files                                                               */

/** Refuse paths that would escape the current directory. */
function safeTarget(root, packPath) {
  const target = resolve(root, packPath);
  const rel = relative(root, target);
  if (isAbsolute(rel) || rel.startsWith("..")) {
    fail(`pack contains an unsafe path: ${packPath}`);
  }
  return target;
}

async function readIfExists(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function writeInto(root, file) {
  const target = safeTarget(root, file.path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, file.content, "utf8");
}

/**
 * AGENTS.md may already belong to the team. Ours is a fenced block inside
 * it, so joining adds to their file and re-joining updates only our part —
 * never the reverse of either.
 */
function mergeAgentsMd(existing, incoming) {
  if (existing === null) return incoming;
  const start = existing.indexOf(AGENTS_START);
  const end = existing.indexOf(AGENTS_END);
  if (start !== -1 && end > start) {
    return (
      existing.slice(0, start) +
      incoming.trim() +
      existing.slice(end + AGENTS_END.length)
    );
  }
  return `${existing.trimEnd()}\n\n${incoming}`;
}

async function readConfig(root) {
  const raw = await readIfExists(join(root, CONFIG_FILE));
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * The host token is the only secret in the product and it is shown once.
 * Saving it beside the repo turns "re-publish" from a curl with a bearer
 * token into a command with no arguments — and gitignoring it is the same
 * favor any tool that writes a credential owes you.
 */
async function saveConfig(root, config) {
  const path = join(root, CONFIG_FILE);
  const merged = { ...(await readConfig(root)), ...config };
  await writeFile(path, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  const gitignore = join(root, ".gitignore");
  const current = await readIfExists(gitignore);
  if (current !== null && !current.split(/\r?\n/).includes(CONFIG_FILE)) {
    const prefix = current.endsWith("\n") ? "" : "\n";
    await appendFile(
      gitignore,
      `${prefix}\n# grill-with-me host token — do not commit\n${CONFIG_FILE}\n`,
      "utf8",
    );
    return { saved: path, gitignored: true };
  }
  return { saved: path, gitignored: current !== null };
}

/* ------------------------------------------------------------------ */
/* prompts                                                             */

const interactive = () => Boolean(process.stdin.isTTY && process.stdout.isTTY);

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function pickRole(summary) {
  console.log(`\n${bold(summary.project.name)} — pick your role:\n`);
  summary.roles.forEach((role, i) => {
    const taken = role.claimedBy ? dim(`  (taken by ${role.claimedBy})`) : "";
    console.log(`  ${bold(String(i + 1))}. ${role.name}${taken}`);
    console.log(`     ${dim(role.description)}`);
  });
  const answer = await ask("\nWhich number is yours? ");
  const role = summary.roles[Number(answer) - 1];
  if (!role) fail(`"${answer}" is not one of the options`);
  return role.slug;
}

/* ------------------------------------------------------------------ */
/* join                                                                */

/**
 * Decide what writing this pack would do to the repo, before doing any of
 * it. The rule that matters: files are only overwritten when grill/.room
 * says this checkout already belongs to this room — i.e. the host
 * republished and you are pulling the update. Anything else needs --force,
 * because a stranger's pack silently overwriting your files is the kind of
 * thing that makes a team distrust a tool at minute 0.
 */
async function planWrites(root, files, stamp, roomKey, force) {
  const plan = [];
  const sameRoom = stamp?.roomKey === roomKey;
  for (const file of files) {
    const target = safeTarget(root, file.path);
    const current = await readIfExists(target);
    let content = file.content;
    if (file.path === "AGENTS.md") {
      content = mergeAgentsMd(current, file.content);
    }
    if (current === null) plan.push({ ...file, content, status: "created" });
    else if (current === content) plan.push({ ...file, content, status: "unchanged" });
    else if (file.path === "AGENTS.md")
      plan.push({ ...file, content, status: "merged" });
    else if (sameRoom || force)
      plan.push({ ...file, content, status: "updated" });
    else plan.push({ ...file, content, status: "blocked" });
  }
  return plan;
}

async function cmdJoin(args) {
  const ref = parseRoomRef(args.positional[0] ?? args.key);
  if (!ref.key) usage(1);
  const base = args.base ?? ref.base ?? DEFAULT_BASE;
  const root = process.cwd();

  const summary = await getJson(`${base}/api/room/${ref.key}`);
  const stampRaw = await readIfExists(join(root, "grill", ".room"));
  const stamp = stampRaw ? JSON.parse(stampRaw) : null;
  const sameRoom = stamp?.roomKey === ref.key;

  let roleSlug = args.role ?? (sameRoom ? stamp.role : null);
  if (roleSlug && !summary.roles.some((r) => r.slug === roleSlug)) {
    fail(
      `no role "${roleSlug}" in this room`,
      `roles: ${summary.roles.map((r) => r.slug).join(", ")}`,
    );
  }
  if (!roleSlug) {
    if (!interactive()) {
      fail(
        "no role chosen and nothing to prompt with",
        `pass --role <slug> — roles: ${summary.roles.map((r) => r.slug).join(", ")}`,
      );
    }
    roleSlug = await pickRole(summary);
  }
  const role = summary.roles.find((r) => r.slug === roleSlug);

  // Ask everything before writing anything, so prompts never interrupt output.
  let name = args.name ?? null;
  if (!name && !args.noClaim && interactive() && !sameRoom) {
    name =
      (await ask(`\nYour name, so the team sees who took ${role.name}? `)) ||
      null;
  }

  const pack = await getJson(
    `${base}/api/room/${ref.key}?role=${encodeURIComponent(roleSlug)}`,
  );
  const plan = await planWrites(root, pack.files, stamp, ref.key, args.force);

  if (args.dryRun) {
    console.log(
      `\n${bold("Dry run")} — nothing written. ${dim(
        `${role.name} · pack v${pack.version}`,
      )}\n`,
    );
    for (const file of plan) {
      const label =
        file.status === "blocked" ? red("blocked".padEnd(9)) : dim(file.status.padEnd(9));
      console.log(`  ${label} ${file.path}`);
    }
    console.log("");
    return;
  }

  const blocked = plan.filter((f) => f.status === "blocked");
  if (blocked.length > 0) {
    fail(
      `this repo already has pack files from a different room:\n  ${blocked
        .map((f) => f.path)
        .join("\n  ")}`,
      "--force overwrites them; your specs and CONTRACT files are never touched",
    );
  }

  for (const file of plan) {
    if (file.status !== "unchanged") await writeInto(root, file);
  }

  if (name && !args.noClaim) {
    try {
      await claimQuietly(base, ref.key, roleSlug, name);
    } catch {
      console.log(
        dim("\n  (couldn't record your claim — just tell your host you took this role)"),
      );
    }
  }

  const changed = plan.filter((f) => f.status !== "unchanged");
  console.log(
    `\n${green("✓")} ${bold(`You're set up as ${role.name}`)} ${dim(
      `(room ${ref.key}, pack v${pack.version})`,
    )}\n`,
  );
  for (const file of changed) {
    console.log(`  ${dim(file.status.padEnd(9))} ${file.path}`);
  }
  if (changed.length === 0) console.log(dim("  everything was already up to date"));

  console.log(`
${bold("Next — about ten minutes:")}

  1. Open your AI editor in this folder.
  2. Run ${bold(`/${GRILL_COMMAND}`)}  ${dim(`— or say: "read grill/MY-ROLE.md and follow it"`)}
  3. Answer its questions. When you say you're done it writes
     ${bold(`grill/${roleSlug}-spec.md`)}.
  4. Not sure it came out right? ${dim("npx grill-with-me check-spec")}
  5. Commit it so your host can merge the contract:
     ${dim(`git add grill/${roleSlug}-spec.md && git commit -m "${roleSlug} spec"`)}
`);
}

async function claimQuietly(base, key, role, displayName) {
  const res = await fetch(`${base}/api/room/${key}/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role, displayName }),
  });
  if (!res.ok) throw new Error(String(res.status));
}

/* ------------------------------------------------------------------ */
/* host                                                                */

async function cmdHost(args) {
  const base = args.base ?? DEFAULT_BASE;
  const root = process.cwd();
  const bundle = await getJson(`${base}/api/skills/host`);

  const written = [];
  for (const file of bundle.files) {
    const current = await readIfExists(safeTarget(root, file.path));
    if (current === file.content) {
      written.push(["unchanged", file.path]);
      continue;
    }
    if (current !== null && !args.force) {
      written.push(["kept", file.path]);
      continue;
    }
    await writeInto(root, file);
    written.push([current === null ? "created" : "updated", file.path]);
  }

  console.log(`\n${green("✓")} ${bold("Host skills installed")}\n`);
  for (const [status, path] of written) {
    console.log(`  ${dim(status.padEnd(9))} ${path}`);
  }
  if (written.some(([s]) => s === "kept")) {
    console.log(dim("\n  (kept your existing copies — pass --force to replace them)"));
  }

  console.log(`
${bold("Next:")}

  1. Open your AI editor here and say: ${bold("run the grill-host skill")}.
     It grills you about the project, proposes roles, and writes
     ${bold("grill-room.json")}.
  2. Publish it and share the link:
     ${dim("npx grill-with-me publish grill-room.json")}
  3. Once every teammate has committed their spec, say:
     ${bold("run the merge-contract skill")} — the contract lands in the repo.
`);
}

/* ------------------------------------------------------------------ */
/* publish / republish / status                                        */

async function readRoomFile(path) {
  const raw = await readIfExists(resolve(process.cwd(), path));
  if (raw === null) {
    fail(
      `no such file: ${path}`,
      "the grill-host skill writes grill-room.json in the folder you ran it from",
    );
  }
  try {
    JSON.parse(raw);
  } catch (err) {
    fail(`${path} is not valid JSON`, err.message);
  }
  return raw;
}

async function cmdPublish(args) {
  const base = args.base ?? DEFAULT_BASE;
  const root = process.cwd();
  const file = args.positional[0] ?? "grill-room.json";
  const raw = await readRoomFile(file);

  const result = await postJson(`${base}/api/rooms`, raw);
  const roomUrl = `${base}${result.url}`;
  const config = await saveConfig(root, {
    base,
    roomKey: result.key,
    hostToken: result.hostToken,
  });

  console.log(`
${green("✓")} ${bold("Room published")}

${bold("Send this to your team:")}
  ${bold(roomUrl)}

  ${dim("or, if they prefer the terminal:")}
  ${dim(joinLine(result.key, base))}

${bold("Yours:")}
  host view   ${roomUrl}/host        ${dim("who has claimed what")}
  host token  ${result.hostToken}
              ${dim(`saved to ${CONFIG_FILE}${config.gitignored ? " (gitignored)" : " — do not commit it"}`)}

${bold("Next:")} once every spec is committed, run the ${bold("merge-contract")} skill.
${dim("Changed the plan? npx grill-with-me republish grill-room.json")}
`);
}

async function cmdRepublish(args) {
  const root = process.cwd();
  const config = await readConfig(root);
  const base = args.base ?? config.base ?? DEFAULT_BASE;
  const key = parseRoomRef(args.key ?? args.positional[1]).key ?? config.roomKey;
  const token = args.token ?? process.env.GRILL_WITH_ME_TOKEN ?? config.hostToken;
  const file = args.positional[0] ?? "grill-room.json";

  if (!key) {
    fail(
      "no room key",
      `pass --key <room-key>, or run this where ${CONFIG_FILE} lives`,
    );
  }
  if (!token) {
    fail(
      "no host token",
      `pass --token <token>, set GRILL_WITH_ME_TOKEN, or run this where ${CONFIG_FILE} lives`,
    );
  }

  const raw = await readRoomFile(file);
  const result = await postJson(`${base}/api/room/${key}/republish`, raw, {
    authorization: `Bearer ${token}`,
  });

  console.log(`
${green("✓")} ${bold(`Room ${key} is now v${result.version}`)}

  ${dim("Members holding an older pack keep it until they re-join:")}
  ${dim(joinLine(key, base))}  ${dim("— safe to re-run, it updates in place")}

  ${dim("Tell the team. The app will not.")}
`);
}

async function cmdStatus(args) {
  const config = await readConfig(process.cwd());
  const ref = parseRoomRef(args.positional[0] ?? args.key ?? config.roomKey);
  if (!ref.key) {
    fail("no room key", "npx grill-with-me status <room-key|url>");
  }
  const base = args.base ?? ref.base ?? config.base ?? DEFAULT_BASE;
  const summary = await getJson(`${base}/api/room/${ref.key}`);

  const claimed = summary.roles.filter((r) => r.claimedBy);
  console.log(`
${bold(summary.project.name)} ${dim(`· room ${summary.key} · pack v${summary.version}`)}
`);
  for (const role of summary.roles) {
    const mark = role.claimedBy ? green("●") : dim("○");
    const who = role.claimedBy ? role.claimedBy : dim("unclaimed");
    console.log(`  ${mark} ${role.name.padEnd(16)} ${who}`);
  }
  console.log(
    `\n  ${dim(`${claimed.length}/${summary.roles.length} claimed · ${base}/r/${summary.key}`)}\n`,
  );
  if (claimed.length < summary.roles.length) {
    console.log(
      dim("  Claims are informational — someone may be working without claiming.\n"),
    );
  }
}

/* ------------------------------------------------------------------ */

/**
 * The five headings merge-contract parses. Must match SPEC_HEADINGS in
 * lib/spec-format.ts — tests/cli.test.ts asserts they still agree.
 */
const SPEC_HEADINGS = [
  "## Scope",
  "## What I own",
  "## What I need from other roles",
  "## Decisions made",
  "## Still unclear",
];

/**
 * Sections must appear in order, because merge-contract parses by slicing
 * between headings.
 */
function validateSpec(markdown) {
  const missing = [];
  const thin = [];
  let cursor = 0;
  const found = [];
  for (const heading of SPEC_HEADINGS) {
    const at = markdown.startsWith(heading) && cursor === 0
      ? 0
      : markdown.indexOf(`\n${heading}`, cursor);
    if (at === -1) {
      missing.push(heading);
      continue;
    }
    found.push({ heading, at });
    cursor = at + heading.length + 1;
  }
  for (let i = 0; i < found.length; i++) {
    const start = found[i].at + found[i].heading.length;
    const end = i + 1 < found.length ? found[i + 1].at : markdown.length;
    // Low bar on purpose: one real sentence passes, a stub word does not.
    if (markdown.slice(start, end).trim().length < 12) {
      thin.push(found[i].heading);
    }
  }
  return { missing, thin };
}

/**
 * The member's whole contribution is one file, and nothing tells them it came
 * out right until the host merges — hours later, when it is the host's
 * problem. This is that feedback, thirty seconds after the grill, on their
 * own machine (plan §11, P0-2).
 */
async function cmdCheckSpec(args) {
  const root = process.cwd();
  const grillDir = join(root, "grill");
  let names = args.positional.length > 0 ? args.positional : null;
  if (!names) {
    try {
      names = (await readdir(grillDir))
        .filter((f) => f.endsWith("-spec.md"))
        .map((f) => `grill/${f}`);
    } catch {
      names = [];
    }
  }
  if (names.length === 0) {
    fail(
      "no spec files found in grill/",
      `run /${GRILL_COMMAND} in your editor first — it writes grill/<role>-spec.md`,
    );
  }

  let bad = 0;
  console.log("");
  for (const name of names) {
    const markdown = await readIfExists(resolve(root, name));
    if (markdown === null) {
      console.log(`  ${red("✗")} ${name} ${dim("— not found")}`);
      bad++;
      continue;
    }
    const { missing, thin } = validateSpec(markdown);
    if (missing.length > 0) {
      bad++;
      console.log(`  ${red("✗")} ${name}`);
      console.log(
        dim(`      missing or out of order: ${missing.join(", ")}`),
      );
      console.log(
        dim("      ask your agent to rewrite it with all five headings, in order"),
      );
    } else if (thin.length > 0) {
      console.log(`  ${green("✓")} ${name} ${dim("— but thin")}`);
      console.log(dim(`      nearly empty: ${thin.join(", ")}`));
      console.log(
        dim("      merge-contract will flag these; a sentence each is enough"),
      );
    } else {
      console.log(`  ${green("✓")} ${name} ${dim("— all five sections")}`);
    }
  }

  console.log(
    bad === 0
      ? `\n  ${dim("Well-formed. Commit it so your host can merge the contract.")}\n`
      : "",
  );
  if (bad > 0) process.exit(1);
}

const COMMANDS = {
  join: cmdJoin,
  "check-spec": cmdCheckSpec,
  host: cmdHost,
  publish: cmdPublish,
  republish: cmdRepublish,
  status: cmdStatus,
  help: async () => usage(0),
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.version) {
    console.log(await version());
    return;
  }
  if (args.help || !args.command) usage(0);

  const run = COMMANDS[args.command];
  if (!run) {
    fail(
      `unknown command "${args.command}"`,
      `try: ${Object.keys(COMMANDS).join(", ")}`,
    );
  }
  await run(args);
}

main().catch((err) => fail(err.message));
