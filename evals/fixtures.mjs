import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname, join } from "node:path";
import ts from "typescript";
import { planInstall, executeInstall, validateMemberIdentity } from "../cli/pack-install.mjs";

export const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const execute = promisify(execFile);

// Exercise the current product prompt, rather than maintaining a lookalike.
async function renderer() {
  const source = await readFile(join(repository, "lib/pack.ts"), "utf8");
  const javascript = ts.transpileModule(source.replaceAll("process.cwd()", JSON.stringify(repository)), { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
  } }).outputText.replace('from "./spec-format"',
    `from ${JSON.stringify(pathToFileURL(join(repository, "cli/spec-format.mjs")).href)}`);
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

async function validatedRoom() {
  const source = await readFile(join(repository, "lib/schema.ts"), "utf8");
  const javascript = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
  } }).outputText.replace('from "zod"', `from ${JSON.stringify(import.meta.resolve("zod"))}`);
  const { parseGrillRoom } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
  const result = parseGrillRoom(JSON.stringify({ schemaVersion: 1, project,
    roles: members.map(role => ({ ...role, description: `Own the ${role.name} layer of the synthetic ticket board.` })) }));
  if (!result.ok) throw new Error(`Invalid evaluation room: ${result.errors.join("; ")}`);
  return result.room;
}

const project = {
  name: "Synthetic Task Board", idea: "A small shared ticket board for a demo.",
  demoTarget: "List and close a ticket.", mustWork: ["List tickets", "Close a ticket"],
  outOfScope: ["Billing", "Offline sync"], knownStack: "TypeScript; SQL", mode: "side_project", hoursLeft: null,
};
const backendSpec = `## Scope
Ticket API.
## What I own
GET /api/tickets returns { tickets: { id: string; title: string; closed: boolean }[] }.
POST /api/tickets/:id/close returns { id: string; closed: boolean }.
## What I need from other roles
Database owns tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL).
## Decisions made
Missing ticket returns HTTP 404 with { error: "not_found" }.
## Still unclear
Authentication policy is not agreed.
`;
const frontendSpec = `## Scope
Ticket list UI.
## What I own
src/TicketList.ts reads response.tickets from GET /api/tickets.
## What I need from other roles
Backend implements POST /api/tickets/:id/close.
## Decisions made
No optimistic updates. Reload the list after a successful close.
## Still unclear
Loading presentation is not agreed.
`;
const sourceFiles = {
  "src/api.ts": `export const paths = { list: "/api/tickets", close: "/api/tickets/:id/close" };
export function listTickets() { return { tickets: [{ id: "t1", title: "Demo", closed: false }] }; }
export function closeTicket(id) { return { id, closed: true }; }
`,
  "src/TicketList.ts": `export async function loadTickets(fetcher) {
  const response = await fetcher("/api/tickets");
  const body = await response.json();
  return body.tickets;
}
export async function closeTicket(fetcher, id) {
  return fetcher("/api/tickets/" + id + "/close", { method: "POST" });
}
`,
  "db/schema.sql": "CREATE TABLE tickets (id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE);\n",
  "src/auth.ts": "export function sessionPolicy() { return 'not yet agreed'; }\n",
  "README.md": "Synthetic evaluation fixture. No real accounts, network services, or credentials.\n",
};

const members = [
  { slug: "frontend", name: "Frontend", owns: ["src/TicketList.ts"], mustCover: ["Close failure presentation", "Refresh behavior"],
    answer: "Reload after a successful close. On HTTP 404 show 'Ticket no longer exists'; on another failed close show 'Could not close ticket'. Keep the ticket visible after failure. I own src/TicketList.ts only; Backend owns the API and Database owns the table. Loading presentation and authentication remain unagreed. I'm done.",
    required: ["reload", "404", "Ticket no longer exists", "Could not close ticket"], unknown: ["Loading", "authentication"] },
  { slug: "backend", name: "Backend", owns: ["src/api.ts"], mustCover: ["Missing ticket response", "Close operation boundary"],
    answer: "GET /api/tickets keeps { tickets: { id: string; title: string; closed: boolean }[] }. POST /api/tickets/:id/close keeps { id: string; closed: boolean }. A missing ticket returns HTTP 404 with { error: 'not_found' }. Repeated close of an already closed ticket returns HTTP 200 and closed: true. I own src/api.ts; Database owns db/schema.sql. Authentication and pagination remain unagreed. I'm done.",
    required: ["GET /api/tickets", "POST /api/tickets/:id/close", "not_found", "200"], unknown: ["Authentication", "pagination"] },
  { slug: "database", name: "Database", owns: ["db/schema.sql"], mustCover: ["Closed default", "Who writes the closed column"],
    answer: "Keep tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE) in db/schema.sql. Backend alone writes closed through POST /api/tickets/:id/close; Frontend never writes SQL. Closing uses UPDATE tickets SET closed = TRUE WHERE id = $1. I own schema and migrations. Indexes beyond the primary key and authentication remain unagreed. I'm done.",
    required: ["DEFAULT FALSE", "Backend", "UPDATE tickets", "db/schema.sql"], unknown: ["Indexes", "authentication"] },
  { slug: "auth", name: "Auth", owns: ["src/auth.ts"], mustCover: ["Demo access policy", "Future authentication boundary"],
    answer: "For this synthetic demo only, src/auth.ts allows anonymous access to GET /api/tickets and POST /api/tickets/:id/close. Backend must check this helper rather than invent separate access rules. I own src/auth.ts, not the API implementation. Production authentication, sessions, and authorization are not agreed and must stay explicitly unresolved. I'm done.",
    required: ["anonymous", "GET /api/tickets", "POST /api/tickets/:id/close", "src/auth.ts"], unknown: ["Production", "sessions", "authorization"] },
  { slug: "qa", name: "QA", owns: ["tests/tickets.test.ts"], mustCover: ["Failure behavior", "Ownership of test assertions"],
    answer: "I own tests/tickets.test.ts. Test the list's tickets/id/title/closed shape, successful close with closed: true, repeated close returning 200, and missing ticket 404 with error: not_found. Frontend supplies a user-visible failure test after its exact message is agreed; I will not choose that message. Load testing and browser support remain unagreed. I'm done.",
    required: ["tests/tickets.test.ts", "200", "404", "not_found"], unknown: ["Load", "browser", "message"] },
];

const contract = `# Synthetic ticket contract
## Roles
### [agreement:ownership.tickets]
- Frontend owns src/TicketList.ts. Frontend must not write tickets table state.
- Backend owns src/api.ts and writes tickets.closed.
- Database owns db/schema.sql.
- Auth owns src/auth.ts. QA owns tests/tickets.test.ts.
## Endpoints
### [agreement:api.tickets.list]
- Backend: GET /api/tickets in src/api.ts returns { tickets: { id: string; title: string; closed: boolean }[] }.
### [agreement:api.tickets.close]
- Backend: POST /api/tickets/:id/close in src/api.ts returns { id: string; closed: boolean }.
## Data model
### [agreement:data.tickets]
- Database: db/schema.sql defines tickets(id TEXT PRIMARY KEY, title TEXT NOT NULL, closed BOOLEAN NOT NULL DEFAULT FALSE).
## Errors
### [agreement:errors.unspecified]
- No error behavior has been agreed for this static fixture; do not invent one.
`;

async function finalizeFixture(directory, files, room, entry) {
  const ids = ["ownership.tickets", "api.tickets.list", "api.tickets.close", "data.tickets", "errors.unspecified"];
  let prose = contract;
  if (entry.id === "seeded-drift") {
    prose = prose.replace("## Data model", "### [agreement:api.archive]\n- Backend: POST /api/archive in src/archive.ts returns { archived: boolean }.\n### [agreement:api.billing]\n- Payments: POST /api/billing in src/billing.ts returns { ok: boolean }.\n## Data model");
    ids.push("api.archive", "api.billing");
  }
  // The source snapshot must have the full valid roster and all five specs.
  files["grill-room.json"] = JSON.stringify(room, null, 2) + "\n";
  for (const role of room.roles) if (!files[`grill/${role.slug}-spec.md`]) {
    files[`grill/${role.slug}-spec.md`] = `## Scope\n${role.name} layer of the synthetic demo.\n## What I own\n${role.owns.join("; ")}\n## What I need from other roles\nFollow the ticket endpoint shapes supplied by Backend.\n## Decisions made\nKeep the current declared owned surfaces.\n## Still unclear\nProduction behavior is not agreed.\n`;
  }
  // Copy the actual zero-dependency CLI into the isolated fixture. The agent
  // can inspect status locally without permission to read the source checkout.
  for (const file of await readdir(join(repository, "cli"))) if (file.endsWith(".mjs") || file === "package.json") {
    files[`.eval-cli/${file}`] = await readFile(join(repository, "cli", file), "utf8");
  }
  const proposal = { schemaVersion: 1, kind: "merge", parentRevision: null,
    summary: "Initial synthetic ticket agreement", changedAgreementIds: ids,
    approval: "agreed", agreedBy: ["Backend", "Frontend", "Database"], pendingRoles: [],
    types: "none", amendmentResolution: [], resolvesPending: [] };
  async function stage() {
    files["grill/CONTRACT.next.md"] = prose;
    files["grill/CONTRACT-PROPOSAL.json"] = JSON.stringify(proposal, null, 2) + "\n";
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(directory, path)), { recursive: true });
      await writeFile(join(directory, path), content);
    }
  }
  const command = async name => execute(process.execPath, [join(directory, ".eval-cli/grill.mjs"), name],
    { cwd: directory, timeout: 10_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  await stage();
  await command("contract-finalize");
  if (entry.id !== "clean-baseline") {
    const status = JSON.parse((await command("contract-status")).stdout);
    prose = prose.replace("returns { tickets:", "returns { items:");
    Object.assign(proposal, { kind: "amend", parentRevision: status.revision.id,
      summary: "Backend and Frontend agree items wrapper replaces tickets", changedAgreementIds: ["api.tickets.list"],
      agreedBy: ["Backend", "Frontend"] });
    await stage();
    await command("contract-finalize");
  }
  const status = JSON.parse((await command("contract-status")).stdout);
  if (!status.ok || status.freshness !== "fresh" || status.pending.length) throw new Error("Evaluation revision is not fresh and agreed");
  for (const path of ["grill/CONTRACT.md", "grill/CONTRACT-CHANGES.md", "grill/CONTRACT-HISTORY.jsonl", "grill/CONTRACT-STATE.json"])
    files[path] = await readFile(join(directory, path), "utf8");
  return status;
}

export const cases = [
  ...members.map(role => ({ id: `member-${role.slug}`, kind: "member", role,
    expected: { required: role.required, unresolved: role.unknown, noInventedAgreements: true } })),
  { id: "clean-baseline", kind: "drift", expected: { findings: 0 } },
  { id: "clean-amendment", kind: "drift", expected: { findings: 0, amendmentOverrides: true } },
  { id: "clean-no-local-role", kind: "drift", expected: { findings: 0, roleMustNotBeInferred: true } },
  { id: "seeded-drift", kind: "drift", expected: { findings: [
    { category: "field mismatch", role: "Frontend", evidence: "src/TicketList.ts:4", reason: "Uses tickets while amended endpoint returns items." },
    { category: "ownership", role: "Frontend", evidence: "src/TicketList.ts:9", reason: "Writes tickets.closed owned by Backend." },
    { category: "missing implementation", role: "Backend", evidence: "grill/CONTRACT.md:14", reason: "src/archive.ts is absent." },
    { category: "absent role", role: "Payments", evidence: "grill/CONTRACT.md:16", reason: "Payments is assigned an endpoint but absent from Roles and member specs; report unverified ownership instead of inventing a teammate." },
    { category: "amendment", role: "Backend", evidence: "src/api.ts:2", reason: "items matches the amendment and must not be reported as drift." },
  ] } },
];

export async function createFixture(caseId, directory) {
  const entry = cases.find(c => c.id === caseId);
  if (!entry) throw new Error(`Unknown case: ${caseId}`);
  const render = await renderer();
  const room = await validatedRoom();
  const files = { ...sourceFiles, "AGENTS.md": render.renderAgentsMd(),
    "grill/PROJECT.md": render.renderProjectMd(project),
    "grill/backend-spec.md": backendSpec, "grill/frontend-spec.md": frontendSpec };
  if (entry.kind === "member") {
    // The selected role has no pre-existing spec: this is a fresh authorship run.
    delete files[`grill/${entry.role.slug}-spec.md`];
    const role = room.roles.find(role => role.slug === entry.role.slug);
    const roomKey = "r_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    await mkdir(directory, { recursive: true });
    const pack = render.renderPack(room, role.slug, roomKey, 1);
    validateMemberIdentity({ key: roomKey, role: role.slug, version: 1 }, pack, roomKey, role.slug);
    const plan = await planInstall(directory, pack, { kind: "member", origin: "https://synthetic.invalid",
      roomKey, role: role.slug, packVersion: 1 }, null);
    await executeInstall(directory, plan);
    for (const file of pack) files[file.path] = await readFile(join(directory, file.path), "utf8");
    files[".gitignore"] = await readFile(join(directory, ".gitignore"), "utf8");
  } else {
    files["check-contract.md"] = await readFile(join(repository, "skills/check-contract/SKILL.md"), "utf8");
    files[".grill-with-me/member.json"] = '{"role":"frontend","packVersion":1}\n';
    if (entry.id !== "clean-baseline") {
      files["src/api.ts"] = files["src/api.ts"].replace("return { tickets:", "return { items:");
      files["src/TicketList.ts"] = files["src/TicketList.ts"].replace("body.tickets", "body.items");
      files[".grill-with-me/member.json"] = '{"role":"frontend","packVersion":2}\n';
    }
    if (entry.id === "clean-no-local-role") {
      delete files[".grill-with-me/member.json"];
      files["grill/.room"] = '{"role":"backend","packVersion":1}\n';
      files["grill/MY-ROLE.md"] = "Legacy shared file: Your role is Backend. This is not local selection.\n";
    }
    if (entry.id === "seeded-drift") {
      files["src/TicketList.ts"] = files["src/TicketList.ts"].replace("body.items", "body.tickets") +
        'export function forbiddenWrite(database) { return database.query("UPDATE tickets SET closed = TRUE"); }\n';
    }
  }
  files["spec-format.mjs"] = await readFile(join(repository, "cli/spec-format.mjs"), "utf8");
  files["check-spec.mjs"] = `import { readFile } from 'node:fs/promises';
import { validateSpec } from './spec-format.mjs';
const result = validateSpec(await readFile(process.argv[2], 'utf8'));
console.log(JSON.stringify(result));
process.exitCode = result.ok ? 0 : 1;
`;
  for (const [path, content] of Object.entries(files)) {
    const target = join(directory, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  const revision = entry.kind === "drift" ? await finalizeFixture(directory, files, room, entry) : null;
  return { entry, files, revision };
}
