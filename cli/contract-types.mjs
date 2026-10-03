import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { delimiter, dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const canonical = (path) => process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path);

function compilerConsumers(ts, program, contract, root) {
  const checker = program.getTypeChecker();
  const consumers = [];
  for (const file of program.getSourceFiles()) {
    if (file.isDeclarationFile || canonical(file.fileName) === contract || program.isSourceFileFromExternalLibrary(file)) continue;
    const bindings = new Set();
    const findBindings = (node) => {
      if (ts.isImportDeclaration(node) && node.importClause) {
        const clause = node.importClause;
        const names = [clause.name, ...(clause.namedBindings ? ts.isNamespaceImport(clause.namedBindings)
          ? [clause.namedBindings.name] : clause.namedBindings.elements.map((entry) => entry.name) : [])].filter(Boolean);
        for (const name of names) {
          const symbol = checker.getSymbolAtLocation(name);
          if (!symbol || !(symbol.flags & ts.SymbolFlags.Alias)) continue;
          const target = checker.getAliasedSymbol(symbol);
          if (target.declarations?.some((declaration) => canonical(declaration.getSourceFile().fileName) === contract)) bindings.add(symbol);
        }
      }
      ts.forEachChild(node, findBindings);
    };
    findBindings(file);
    const usages = new Set();
    const findUsage = (node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
      if (ts.isIdentifier(node) && bindings.has(checker.getSymbolAtLocation(node))) usages.add(node.text);
      ts.forEachChild(node, findUsage);
    };
    findUsage(file);
    if (usages.size) consumers.push({ file: relative(root, file.fileName).replaceAll("\\", "/"), symbols: [...usages].sort() });
  }
  return consumers.sort((a, b) => a.file.localeCompare(b.file));
}

/** Analyze real bound imports and typecheck the selected consuming project, using only installed tools. */
export async function contractTypecheck(root, configFile = "tsconfig.json") {
  const contract = canonical(join(root, "grill/contract.ts"));
  if (!existsSync(contract)) return { ok: true, integration: "prose-only", reason: "no generated TypeScript contract" };
  const configPath = resolve(root, configFile);
  if (!existsSync(configPath)) return { ok: false, integration: "unknown", reason: "selected project tsconfig is unavailable" };
  let ts, compiler, pkg;
  try {
    const require = createRequire(join(root, "package.json"));
    let directory = resolve(root);
    let installed;
    for (;;) {
      const candidate = join(directory, "node_modules/typescript");
      if (existsSync(join(candidate, "package.json"))) { installed = candidate; break; }
      if (dirname(directory) === directory) break;
      directory = dirname(directory);
    }
    if (!installed) throw new Error("no local or workspace-hoisted compiler");
    ts = require(installed);
    compiler = require.resolve(join(installed, "bin/tsc"));
    pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  } catch { return { ok: false, integration: "unknown", reason: "project-local TypeScript/package metadata unavailable; install declared dependencies explicitly" }; }
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error) return { ok: false, integration: "unknown", reason: ts.flattenDiagnosticMessageText(loaded.error.messageText, "\n") };
  const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, dirname(configPath), { noEmit: true }, configPath);
  if (parsed.errors.length || parsed.projectReferences?.length) return { ok: false, integration: "unknown",
    reason: parsed.projectReferences?.length ? "select the consuming leaf tsconfig; solution project references are not analyzed by this gate"
      : parsed.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n") };
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  const consumers = compilerConsumers(ts, program, contract, root);
  const diagnostics = ts.getPreEmitDiagnostics(program).map((error) => ({
    code: error.code, message: ts.flattenDiagnosticMessageText(error.messageText, "\n"),
    ...(error.file && error.start !== undefined ? { file: relative(root, error.file.fileName).replaceAll("\\", "/"),
      line: error.file.getLineAndCharacterOfPosition(error.start).line + 1 } : {}),
  }));
  let command = [process.execPath, compiler, "--noEmit", "-p", configPath];
  if (typeof pkg.scripts?.typecheck === "string" && pkg.scripts.typecheck.trim()) {
    const npm = [process.env.npm_execpath, ...[dirname(process.execPath), ...(process.env.PATH ?? "").split(delimiter)].map((directory) =>
      process.platform === "win32" ? join(directory, "node_modules/npm/bin/npm-cli.js") : join(directory, "npm"))]
      .find((candidate) => candidate && !/\.(cmd|bat)$/i.test(candidate) && existsSync(candidate));
    if (!npm) return { ok: false, integration: consumers.length ? "integrated" : "unintegrated", consumers,
      reason: "declared typecheck requires installed npm; no tools will be downloaded" };
    command = [process.execPath, npm, "run", "typecheck"];
  }
  let typecheck;
  try {
    const result = await execute(command[0], command.slice(1), { cwd: root, timeout: 120_000, maxBuffer: 1024 * 1024,
      env: { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ""}`, NO_COLOR: "1" } });
    typecheck = { passed: diagnostics.length === 0, command: pkg.scripts?.typecheck ? "npm run typecheck" : `local tsc --noEmit -p ${configFile}`,
      output: result.stdout + result.stderr, diagnostics };
  } catch (error) {
    typecheck = { passed: false, command: pkg.scripts?.typecheck ? "npm run typecheck" : `local tsc --noEmit -p ${configFile}`,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`, diagnostics,
      reason: error.killed ? "project typecheck exceeded 120 seconds or its output limit" : "project typecheck failed" };
  }
  return { ok: consumers.length > 0 && typecheck.passed, integration: consumers.length ? "integrated" : "unintegrated", consumers, typecheck };
}
