import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as portServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { mintPublicationCapability } from "../cli/publication-capability.mjs";

// Actual built Next bundles, including the separately compiled page proxy.
// Controlled HTTP responses test the RPC transport; test:db proves SQL behavior.
const artifacts = await mkdtemp(join(tmpdir(), "grill-service-runtime-"));
const marker = join(artifacts, "advance-clock");
const shim = join(artifacts, "clock.mjs");
await writeFile(shim, `import {existsSync} from 'node:fs'; const original=Date.now; Date.now=()=>original()+(existsSync(${JSON.stringify(marker)})?31*24*60*60*1000:0);`);
const key = `r_${"0".repeat(32)}`;
const endpoints = [
  ["/api/rooms", "POST"], [`/api/room/${key}`, "GET"],
  [`/api/room/${key}/claim`, "POST"], [`/api/room/${key}/republish`, "POST"],
  [`/api/room/${key}`, "DELETE"],
  ["/api/skills/host", "GET"], [`/r/${key}`, "GET"], [`/r/${key}/host`, "GET"],
];
const fixtureRoom = { schemaVersion: 1, project: { name: "Runtime fixture", idea: "Check compiled errors.", mode: "production" }, roles: [{ slug: "frontend", name: "Frontend", description: "UI." }] };

async function freePort() {
  const server = portServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function withApp(overrides, check) {
  const port = await freePort();
  const env = { ...process.env, SUPABASE_URL: "", SUPABASE_SERVICE_KEY: "", CRON_SECRET: "", VERCEL: "", GRILL_TRUST_PROXY: "", ...overrides };
  const server = spawn(process.execPath, ["--import", pathToFileURL(shim).href, "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  const exited = once(server, "exit");
  let stderr = "";
  server.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-8000); });
  const call = (path, body, token, method, extraHeaders = {}) => fetch(`http://127.0.0.1:${port}${path}`, {
    ...(body ? { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
    ...(method ? { method } : {}),
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extraHeaders },
    signal: AbortSignal.timeout(5000),
  });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error(`Next server exited before startup: ${stderr}`);
      try { await call("/"); ready = true; break; } catch { await delay(100); }
    }
    assert(ready, "compiled Next server did not start");
    await check(call, () => stderr);
  } catch (error) {
    if (stderr) console.error(stderr);
    throw error;
  } finally {
    server.kill(); await exited;
    await unlink(marker).catch(() => {});
  }
}

let rpcStatus = 200;
let allowQuotas = false;
const privateDetail = "DO_NOT_LOG_HOST_TOKEN_OR_PRIVATE_BRIEF";
const calls = [];
const fake = createServer(async (req, res) => {
  let raw = ""; for await (const chunk of req) raw += chunk;
  calls.push({ path: req.url, body: raw ? JSON.parse(raw) : null });
  const quota = req.url === "/rest/v1/rpc/consume_request_quota";
  res.writeHead(quota ? rpcStatus : 500, { "content-type": "application/json" });
  res.end(JSON.stringify(quota ? rpcStatus === 200 ? { allowed: allowQuotas, retryAfter: allowQuotas ? 0 : 37 }
    : { message: "private database details" } : { code: "XX000", message: privateDetail, details: privateDetail }));
});
await new Promise((resolve, reject) => { fake.once("error", reject); fake.listen(0, "127.0.0.1", resolve); });

try {
  await withApp({ NODE_ENV: "test", GRILL_STORE: "supabase", SUPABASE_URL: `http://127.0.0.1:${fake.address().port}`, SUPABASE_SERVICE_KEY: "test-only-service-key" }, async (call) => {
    for (const [path, method] of endpoints) {
      const response = await call(path, method === "POST" ? "{invalid" : undefined, undefined, method);
      assert.equal(response.status, 429, path);
      assert.equal(response.headers.get("retry-after"), "37", path);
      assert(response.headers.get("cache-control").includes("no-store"), path);
    }
    assert(calls.every((call) => call.path === "/rest/v1/rpc/consume_request_quota"));
    assert(calls.every((call) => /^[a-f0-9]{64}$/.test(call.body.p_bucket)));
    rpcStatus = 500;
    for (const [path, method] of endpoints) {
      const response = await call(path, method === "POST" ? "{invalid" : undefined, undefined, method);
      assert.equal(response.status, 503, path);
      assert(!(await response.text()).includes("private database details"));
    }
  });
  console.log("PASS: compiled API/page quota429+Retry-After and cross-bundle backend503");

  rpcStatus = 200;
  allowQuotas = true;
  await withApp({ NODE_ENV: "test", GRILL_STORE: "supabase", SUPABASE_URL: `http://127.0.0.1:${fake.address().port}`,
    SUPABASE_SERVICE_KEY: "test-only-service-key" }, async (call, capturedErrors) => {
    const brief = { ...fixtureRoom, project: { ...fixtureRoom.project, idea: privateDetail } };
    for (const [path, method] of endpoints.slice(0, 5)) {
      const body = method === "POST" ? path.endsWith("/claim") ? { role: "frontend", displayName: privateDetail } : brief : undefined;
      const response = await call(path, body, privateDetail, method);
      assert.equal(response.status, 503, path);
      assert.equal(response.headers.get("retry-after"), "5", path);
      assert(response.headers.get("cache-control").includes("no-store"), path);
      assert(!(await response.text()).includes(privateDetail));
    }
    const capability = mintPublicationCapability();
    const recoverable = await call("/api/rooms", brief, undefined, "POST", { "idempotency-key": capability });
    assert.equal(recoverable.status, 503);
    assert(!(await recoverable.text()).includes(capability));
    await delay(50); // Drain child stderr before inspecting its operation-only events.
    const diagnostic = capturedErrors();
    assert(diagnostic.includes('"event":"room_storage_unavailable"'));
    assert(!diagnostic.includes(privateDetail));
    assert(!diagnostic.includes(capability));
  });
  console.log("PASS: compiled room storage503 responses and operation-only logs exclude private database input");

  const maintenanceSecret = "fixture-only-maintenance-secret-123456";
  await withApp({ NODE_ENV: "test", GRILL_STORE: "memory", CRON_SECRET: maintenanceSecret }, async (call) => {
    const published = await call("/api/rooms", fixtureRoom);
    assert.equal(published.status, 201);
    const { key, hostToken } = await published.json();
    assert.equal((await call(`/api/room/${key}`, undefined, undefined, "DELETE")).status, 401);
    assert.equal((await call(`/api/room/${key}`, undefined, "wrong-token", "DELETE")).status, 403);
    assert.equal((await call(`/api/room/${key}/claim`, { role: "frontend", displayName: "Alice" })).status, 200);
    assert.equal((await call(`/api/room/${key}/claim`, { role: "missing", displayName: "Alice" })).status, 404);
    assert.equal((await call(`/api/room/${key}/republish`, fixtureRoom, "wrong-token")).status, 403);
    const missing = `r_${"f".repeat(32)}`;
    assert.equal((await call(`/api/room/${missing}/claim`, { role: "frontend", displayName: "Alice" })).status, 404);
    assert.equal((await call(`/api/room/${missing}/republish`, fixtureRoom, hostToken)).status, 404);
    assert.equal((await call(`/api/room/${missing}`, undefined, hostToken, "DELETE")).status, 404);
    const oldRoom = await (await call("/api/rooms", fixtureRoom)).json();
    assert.equal((await call("/api/maintenance/purge")).status, 401);
    await writeFile(marker, "advance");
    assert.equal((await call(`/api/room/${key}`)).status, 404);
    assert.equal((await call(`/api/room/${key}/claim`, { role: "frontend", displayName: "Alice" })).status, 404);
    assert.equal((await call(`/api/room/${key}/republish`, fixtureRoom, hostToken)).status, 404);
    assert.equal((await call(`/api/room/${key}`, undefined, hostToken, "DELETE")).status, 200);
    assert.equal((await call(`/api/room/${key}`, undefined, hostToken, "DELETE")).status, 404);
    const purged = await call("/api/maintenance/purge", undefined, maintenanceSecret);
    assert.equal(purged.status, 200);
    assert.equal((await purged.json()).roomsDeleted, 1);
    assert.equal((await call(`/api/room/${oldRoom.key}`, undefined, oldRoom.hostToken, "DELETE")).status, 404);
    const repeated = await call("/api/maintenance/purge", undefined, maintenanceSecret, "POST");
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json()).roomsDeleted, 0);
  });
  console.log("PASS: cached compiled store preserves token403 and missing/expired role/room404");
  console.log("PASS: compiled host DELETE and authenticated GET/POST retention physically remove memory rows");

  for (const mode of ["supabase", "memory"]) {
    await withApp({ NODE_ENV: "production", GRILL_STORE: mode }, async (call) => {
      for (const [path, method] of endpoints) {
        const response = await call(path, method === "POST" ? fixtureRoom : undefined, "private-host-token", method);
        assert.equal(response.status, 503, path);
        assert(!(await response.text()).includes("private-host-token"));
      }
      assert.equal((await call("/api/maintenance/purge")).status, 503);
    });
  }
  console.log("PASS: absent storage and forbidden production memory return503 for compiled APIs/pages");
} finally {
  await new Promise((resolve) => fake.close(resolve));
  // Only remove the task-created directory directly beneath the system temp root.
  assert.equal(dirname(resolve(artifacts)), resolve(tmpdir()));
  assert(basename(artifacts).startsWith("grill-service-runtime-"));
  await rm(artifacts, { recursive: true, force: true });
}
