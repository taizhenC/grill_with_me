import { spawn, execFile } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve, relative, dirname, basename } from "node:path";
import { tmpdir, homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { cases, createFixture, repository } from "../evals/fixtures.mjs";
import { validateSpec } from "../cli/spec-format.mjs";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_CALL_MS = 120_000;
const MAX_RUN_MS = 30 * 60_000;
const MAX_CALLS = 14;
const sha = text => createHash("sha256").update(text).digest("hex");

function options(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!["--agent", "--out", "--case", "--claude-bin", "--codex-entry"].includes(key) || !argv[index + 1])
      throw new Error("Usage: node scripts/run-agent-evals.mjs --agent claude|codex --out NEW_DIRECTORY [--case CASE_ID] [--claude-bin PATH] [--codex-entry PATH]");
    result[key.slice(2)] = argv[index + 1];
  }
  if (!["claude", "codex"].includes(result.agent) || !result.out) throw new Error("--agent and --out are required");
  if (result.case && result.case.split(",").some(id => !cases.some(c => c.id === id))) throw new Error("Unknown --case");
  return result;
}

async function terminate(child) {
  if (process.platform === "win32") await new Promise(resolvePromise => {
    execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => resolvePromise());
  });
  else child.kill("SIGKILL");
}

export async function invoke(command, args, cwd, prompt, timeoutMs = MAX_CALL_MS, artifactPath = null) {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  return new Promise(resolvePromise => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false,
      stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, NO_COLOR: "1" } });
    let stdout = "", stderr = "", bytes = 0, stopped = null, firstObservedArtifact = null;
    const watcher = artifactPath ? setInterval(() => {
      if (firstObservedArtifact === null) void readFile(artifactPath, "utf8").then(content => {
        if (content && firstObservedArtifact === null) firstObservedArtifact = content;
      }).catch(() => {});
    }, 10) : null;
    const stop = reason => { if (!stopped) { stopped = reason; void terminate(child); } };
    const timer = setTimeout(() => stop("timeout"), timeoutMs);
    child.stdout.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) stop("output-limit"); else stdout += chunk.toString();
    });
    child.stderr.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) stop("output-limit"); else stderr += chunk.toString();
    });
    child.on("error", error => {
      clearTimeout(timer);
      clearInterval(watcher);
      resolvePromise({ startedAt, durationMs: Date.now() - start, exitCode: null,
        stopped: "spawn-error", stdout, stderr: `${stderr}\n${error.message}` });
    });
    child.on("close", exitCode => {
      clearTimeout(timer);
      clearInterval(watcher);
      resolvePromise({ startedAt, durationMs: Date.now() - start, exitCode, stopped, stdout, stderr, firstObservedArtifact });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
}

export function selectedEvents(agent, stdout) {
  const events = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { events.push({ type: "non-json-output", text: line }); continue; }
    if (agent === "claude") {
      if (event.type === "system" && event.subtype === "init") events.push({ type: "init",
        model: event.model, cliVersion: event.claude_code_version, tools: event.tools,
        mcpServers: event.mcp_servers, permissionMode: event.permissionMode });
      if (event.type === "assistant") {
        const content = event.message?.content?.filter(c => ["text", "tool_use"].includes(c.type));
        if (content?.length) events.push({ type: "assistant", model: event.message.model, content });
      }
      if (event.type === "user") {
        const content = event.message?.content?.filter(c => c.type === "tool_result");
        if (content?.length) events.push({ type: "tool-results", content });
      }
      if (event.type === "result") events.push({ type: "result", subtype: event.subtype,
        isError: event.is_error, result: event.result, turns: event.num_turns,
        usage: event.usage, modelUsage: event.modelUsage, estimatedCostUsd: event.total_cost_usd,
        permissionDenials: event.permission_denials });
      if (event.type === "error") events.push({ type: "error", error: event.error });
      // Account quota percentages, IDs, signatures, reasoning and auth metadata are not evidence.
    } else {
      if (["turn.completed", "turn.failed", "error"].includes(event.type)) events.push(event);
      if (event.type?.startsWith("item.") && event.item?.type !== "reasoning") events.push(event);
    }
  }
  return events;
}

export function assistantText(agent, events) {
  return agent === "claude"
    ? events.filter(e => e.type === "assistant").flatMap(e => e.content.filter(c => c.type === "text").map(c => c.text)).join("\n\n")
    : events.filter(e => e.type === "item.completed" && e.item?.type === "agent_message").map(e => e.item.text).join("\n\n");
}

// A workspace-write sandbox restricts writes, not reads. This detector catches
// explicit account-home reads, but is not a complete shell/path security parser.
export function homeReadFindings(agent, events) {
  const variants = [homedir(), homedir().replaceAll("\\", "/"), homedir().replaceAll("\\", "\\\\"), "${HOME}"];
  const findings = [];
  for (const event of events) {
    if (agent === "codex" && event.type === "item.completed" && event.item?.type === "command_execution") {
      const command = event.item.command ?? "";
      // The native shell executable may itself live under HOME. Only inspect
      // its command body, preserving that harmless runtime path as evidence.
      const body = command.split(/-Command\s/i).slice(1).join("-Command ");
      if (/Get-Content|\bcat\b|\btype\b/i.test(body) && variants.some(path => body.toLowerCase().includes(path.toLowerCase())))
        findings.push({ itemId: event.item.id, command, exitCode: event.item.exit_code,
          reason: "Explicit account-home content read; review actual output and intent." });
    }
    if (agent === "claude" && event.type === "assistant") for (const content of event.content) {
      if (content.type === "tool_use" && ["Read", "Grep", "Glob"].includes(content.name)) {
        const path = content.input?.file_path ?? content.input?.path;
        if (typeof path === "string" && variants.some(home => path.toLowerCase().startsWith(home.toLowerCase())))
          findings.push({ itemId: content.id, path, reason: "Explicit account-home file-tool access." });
      }
    }
  }
  return findings;
}

export function redactForeignOutputs(agent, events) {
  const ids = new Set(homeReadFindings(agent, events).map(finding => finding.itemId));
  return events.map(event => {
    if (agent !== "codex" || !ids.has(event.item?.id) || !event.item.aggregated_output) return event;
    const output = event.item.aggregated_output;
    return { ...event, item: { ...event.item, aggregated_output: "[Outside-fixture content omitted from public evidence]",
      outsideFixtureOutputRedacted: true, originalOutputSha256: sha(output), originalOutputBytes: Buffer.byteLength(output) } };
  });
}

export function redactEvidence(value, directory) {
  function sanitize(input) {
    if (typeof input === "string") {
      for (const [path, label] of [[directory, "${FIXTURE}"], [repository, "${REPOSITORY}"], [homedir(), "${HOME}"], [tmpdir(), "${TEMP}"]]) {
        if (!path) continue;
        for (const spelling of [path, path.replaceAll("\\", "\\\\"), path.replaceAll("\\", "/")])
          input = input.split(spelling).join(label);
      }
      // Directory-local shell listings can expose the OS account owner.
      const username = basename(homedir()).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return input.replace(new RegExp(`\\b${username}\\b`, "g"), "${USER}");
    }
    if (Array.isArray(input)) return input.map(sanitize);
    if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).map(([key, entry]) => [key, sanitize(entry)]));
    return input;
  }
  return `${JSON.stringify(sanitize(value), null, 2)}\n`;
}

async function outputFiles(directory) {
  const files = {};
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const target = join(path, entry.name);
      if (entry.isSymbolicLink()) { files[relative(directory, target).replaceAll("\\", "/")] = "[SYMLINK: scope violation]"; continue; }
      if (entry.isDirectory()) await visit(target);
      else files[relative(directory, target).replaceAll("\\", "/")] = await readFile(target, "utf8");
    }
  }
  await visit(directory);
  return files;
}

async function run(config) {
  const out = resolve(config.out);
  await mkdir(dirname(out), { recursive: true });
  await mkdir(out, { recursive: false }); // Never overwrite or silently rerun a recorded evaluation.
  const working = await mkdtemp(join(tmpdir(), "grill-agent-eval-"));
  const selected = config.case ? cases.filter(c => config.case.split(",").includes(c.id)) : cases;
  const executable = config.agent === "claude"
    ? config["claude-bin"] || (process.platform === "win32" ? join(homedir(), ".local/bin/claude.exe") : "claude")
    : process.execPath;
  const entry = config["codex-entry"] || (process.platform === "win32"
    ? join(process.env.APPDATA || "", "npm/node_modules/@openai/codex/bin/codex.js") : null);
  if (config.agent === "codex" && !entry) throw new Error("Provide --codex-entry for the installed Codex JS entry point");
  const version = await invoke(executable, config.agent === "claude" ? ["--version"] : [entry, "--version"], working, "", 10_000);
  if (version.exitCode !== 0) throw new Error(`CLI version probe failed: ${version.stderr}`);
  const manifest = { startedAt: new Date().toISOString(), agent: config.agent, version: version.stdout.trim(),
    node: process.version, sourceFiles: {}, limits: { callMs: MAX_CALL_MS, runMs: MAX_RUN_MS, calls: MAX_CALLS, outputBytes: MAX_BYTES, claudePerCallBudgetUsd: 1 },
    isolation: "Synthetic temp fixture only; no CLI model override; fresh CLI per phase with verbatim interview transcript replay; no response schema or structure repair prompts.",
    cases: [], stopped: null };
  const cliSources = (await readdir(join(repository, "cli"))).filter(path => path.endsWith(".mjs") || path === "package.json").map(path => `cli/${path}`);
  for (const path of ["lib/pack.ts", "lib/schema.ts", "skills/check-contract/SKILL.md", "skills/amend-contract/SKILL.md",
    "skills/merge-contract/SKILL.md", ...cliSources, "evals/fixtures.mjs", "scripts/run-agent-evals.mjs"])
    manifest.sourceFiles[path] = sha(await readFile(join(repository, path), "utf8"));
  const began = Date.now();
  let calls = 0;
  await writeFile(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  for (const fixtureCase of selected) {
    if (Date.now() - began > MAX_RUN_MS || calls >= MAX_CALLS) { manifest.stopped = "run-limit"; break; }
    const directory = join(working, fixtureCase.id);
    const recordDirectory = join(out, fixtureCase.id);
    await mkdir(recordDirectory);
    let initialized;
    try { initialized = await createFixture(fixtureCase.id, directory); }
    catch (error) {
      manifest.stopped = "fixture-setup-failure";
      manifest.setupFailure = { case: fixtureCase.id, message: error.message, agentTaskInvoked: false };
      await writeFile(join(out, "manifest.json"), redactEvidence(manifest, directory));
      console.error(`Fixture setup failed before agent invocation: ${fixtureCase.id}`);
      break;
    }
    const { entry: fixture, files: input, revision } = initialized;
    await writeFile(join(recordDirectory, "fixture.json"), JSON.stringify({ files: input, expected: fixture.expected, revision }, null, 2) + "\n");
    const environment = "This is a synthetic offline fixture. Work only inside this directory. Do not access parent/user directories, credentials, network, git, or install packages. The local equivalent of npx grill-with-me check-spec is node check-spec.mjs PATH; use that instead. The local equivalent of npx grill-with-me contract-status is node .eval-cli/grill.mjs contract-status. This is the actual copied CLI, not a mocked status. Do not modify source, inputs, role instructions, contract, or the local gate. Report permission failures without trying alternate paths or commands.";
    let prompt = `${environment}\n\n` + (fixture.kind === "member"
      ? "Read AGENTS.md and the installed .claude/commands/grill-my-role.md instruction, follow its references, and start the interview."
      : "Read check-contract.md and follow it. Write grill/CHECK-REPORT.md, then summarize the result. The fixture has no package manager/compiler; if a compiler is needed report that as unverified instead of installing one.");
    const results = [];
    const reads = [];
    for (const phase of fixture.kind === "member" ? ["interview", "write"] : ["check"]) {
      const args = config.agent === "claude" ? ["--restricted", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
        "--tools", "Read,Glob,Grep,Write,Edit,Bash", "--allowedTools", "Read,Glob,Grep,Write,Edit", "Bash(node check-spec.mjs *)", "Bash(node .eval-cli/grill.mjs contract-status)",
        "--permission-mode", "dontAsk", "--no-session-persistence", "--disable-slash-commands", "--max-budget-usd", "1",
        "--output-format", "stream-json", "--verbose", "-p"]
        : [entry, "exec", "--sandbox", "workspace-write", "--ignore-user-config", "--ignore-rules", "--ephemeral",
          "--skip-git-repo-check", "--json", "--color", "never", "--cd", directory,
          "-c", 'approval_policy="never"', "-c", 'windows.sandbox="unelevated"',
          "-c", `skills.config=[{path=${JSON.stringify(join(homedir(), ".agents/skills/grilling/SKILL.md").replaceAll("\\", "/"))},enabled=false}]`,
          "-c", 'web_search="disabled"', "-c", "sandbox_workspace_write.network_access=false", "-"];
      console.log(`${config.agent}: ${fixture.id}/${phase} (${++calls}/${MAX_CALLS})`);
      const artifactPath = fixture.kind === "member" ? join(directory, `grill/${fixture.role.slug}-spec.md`) : null;
      const raw = await invoke(executable, args, directory, prompt, Math.min(MAX_CALL_MS, Math.max(1, MAX_RUN_MS - (Date.now() - began))), phase === "write" ? artifactPath : null);
      const events = selectedEvents(config.agent, raw.stdout);
      const text = assistantText(config.agent, events);
      reads.push(...homeReadFindings(config.agent, events));
      if (phase === "write") {
        const write = events.filter(e => e.type === "assistant").flatMap(e => e.content)
          .find(c => c.type === "tool_use" && c.name === "Write" && c.input.file_path?.endsWith(`${fixture.role.slug}-spec.md`));
        const first = write?.input?.content ?? raw.firstObservedArtifact;
        if (first) await writeFile(join(recordDirectory, "first-artifact.md"), first);
        await writeFile(join(recordDirectory, "first-artifact-method.json"), JSON.stringify({
          source: write ? "First Claude Write tool payload" : first ? "First nonempty file observed at 10ms intervals; check tool trace for later corrections" : "Not observed",
          structure: first ? validateSpec(first) : null,
        }, null, 2) + "\n");
      }
      const result = { phase, startedAt: raw.startedAt, durationMs: raw.durationMs, exitCode: raw.exitCode,
        stopped: raw.stopped, invocation: { executable: config.agent === "claude" ? "claude" : "node ${CODEX_ENTRY}", args: args.map(a => a === entry ? "${CODEX_ENTRY}" : a), prompt },
        events: redactForeignOutputs(config.agent, events), assistantText: text, stderr: raw.stderr };
      await writeFile(join(recordDirectory, `${phase}.json`), redactEvidence(result, directory));
      results.push({ phase, exitCode: raw.exitCode, stopped: raw.stopped });
      if (raw.exitCode !== 0 || raw.stopped || events.some(e => e.isError || e.type === "turn.failed" || e.type === "error")) {
        manifest.stopped = "agent-failure";
        break;
      }
      if (fixture.kind === "member" && phase === "interview") {
        prompt = `${environment}\n\nPrior user message (verbatim): Read AGENTS.md and the installed .claude/commands/grill-my-role.md instruction, follow its references, and start the interview.\n\nPrior assistant response (verbatim):\n${text}\n\nNew user reply (fixed synthetic respondent facts):\n${fixture.role.answer}`;
      }
    }
    const final = await outputFiles(directory);
    const modifications = Object.keys(input).filter(path => final[path] !== input[path]);
    const added = Object.keys(final).filter(path => !Object.hasOwn(input, path));
    const target = fixture.kind === "member" ? `grill/${fixture.role.slug}-spec.md` : "grill/CHECK-REPORT.md";
    const content = final[target] ?? null;
    if (content !== null) await writeFile(join(recordDirectory, "artifact.md"), content);
    const validation = fixture.kind === "member" && content !== null ? validateSpec(content) : null;
    await writeFile(join(recordDirectory, "outcome.json"), redactEvidence({ results, modifications, added, target,
      artifactExists: content !== null, structure: validation,
      writeScopeOk: modifications.length === 0 && added.every(path => path === target),
      readScope: { knownHomeReadFindings: reads, fullyConfined: false, review: "Manual trace review required; write scope does not prove read confinement." },
      manualGrade: "Pending; structure validity is not a behavior grade." }, directory));
    manifest.cases.push({ id: fixture.id, artifactExists: content !== null, structureOk: validation?.ok ?? null, results });
    await writeFile(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    if (manifest.stopped) break;
  }
  manifest.finishedAt = new Date().toISOString();
  await writeFile(join(out, "manifest.json"), redactEvidence(manifest, working));
  console.log(`${config.agent}: saved ${manifest.cases.length} cases; stopped=${manifest.stopped ?? "no"}`);
  if (manifest.stopped) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(options(process.argv.slice(2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
