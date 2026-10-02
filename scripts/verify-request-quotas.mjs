import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import pg from "pg";

const connectionString = process.env.GRILL_TEST_DATABASE_URL;
if (!connectionString) throw new Error("Set GRILL_TEST_DATABASE_URL to an empty disposable grill_test database");
const options = { connectionString, connectionTimeoutMillis: 5000, statement_timeout: 10000 };
const admin = new pg.Client(options);
const workers = [];
let ownsFixture = false;
const bucket = (value) => createHash("sha256").update(String(value)).digest("hex");
const consume = (client, scope, identity, clientLimit, globalLimit) => client.query(
  "select public.consume_request_quota($1,$2,$3,$4,3600) as decision", [scope, identity, clientLimit, globalLimit],
);

await admin.connect();
try {
  const database = (await admin.query("select current_database() as name, version() as version")).rows[0];
  assert.match(database.name, /^grill_test(?:[_-].+)?$/);
  if (process.argv[2] === "--probe") {
    await admin.query("set role service_role");
    console.log(JSON.stringify((await consume(admin, "claim", bucket("shared"), 5, 100)).rows[0].decision));
  } else {
    assert.equal((await admin.query("select to_regclass('public.request_quotas') as quotas")).rows[0].quotas, null, "Refusing to replace an existing request_quotas table");
    console.log(database.version);
    await admin.query(`do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
    end $$;`);
    ownsFixture = true;
    await admin.query(await readFile(new URL("../supabase/migrations/0003_shared_request_quotas.sql", import.meta.url), "utf8"));
    await admin.query("grant usage on schema public to service_role, anon, authenticated; grant select on public.request_quotas to anon, authenticated");
    for (let i = 0; i < 8; i++) {
      const client = new pg.Client(options); workers.push(client);
      await client.connect(); await client.query("set role service_role");
    }
    // Avoid a rare fixture run straddling the real one-hour window boundary.
    const secondsLeft = (await admin.query("select 3600 - mod(extract(epoch from clock_timestamp()),3600) as n")).rows[0].n;
    if (Number(secondsLeft) < 10) await admin.query("select pg_sleep($1)", [Number(secondsLeft) + 0.1]);
    const results = (await Promise.all(workers.map(async (client, i) => {
      const results = [];
      for (let n = 0; n < 4; n++) results.push(await consume(client, "create", bucket(i), 3, 7));
      return results;
    }))).flat();
    assert.equal(results.filter((r) => r.rows[0].decision.allowed).length, 7);
    assert(results.filter((r) => !r.rows[0].decision.allowed).every((r) => r.rows[0].decision.retryAfter > 0));
    const createRows = (await admin.query("select * from public.request_quotas where scope='create'")).rows;
    assert.equal(createRows.find((r) => r.bucket === "global").hits, 7);
    assert(createRows.filter((r) => r.bucket !== "global").every((r) => r.hits <= 3));
    for (let i = 0; i < 50; i++) assert.equal((await consume(workers[0], "create", bucket(`new-${i}`), 3, 7)).rows[0].decision.allowed, false);
    assert.equal((await admin.query("select count(*)::int as n from public.request_quotas where scope='create'")).rows[0].n, createRows.length);
    console.log("PASS: simultaneous different-IP requests obey global caps without allocating denied-IP rows");

    const sameIp = (await Promise.all(workers.map(async (client) => {
      const results = [];
      for (let n = 0; n < 4; n++) results.push(await consume(client, "claim", bucket("shared"), 5, 100));
      return results;
    }))).flat();
    assert.equal(sameIp.filter((r) => r.rows[0].decision.allowed).length, 5);
    assert.deepEqual((await admin.query("select hits from public.request_quotas where scope='claim' order by bucket")).rows.map((r) => r.hits), [5, 5]);
    console.log("PASS: concurrent requests share the exact client cap and denied requests do not charge global budget");

    const restarted = await promisify(execFile)(process.execPath, [fileURLToPath(import.meta.url), "--probe"], { env: process.env, windowsHide: true });
    assert.equal(JSON.parse(restarted.stdout).allowed, false);
    console.log("PASS: a fresh application process retains the exhausted shared budget");

    await admin.query("update public.request_quotas set expires_at=clock_timestamp() - interval '1 second' where scope='claim'");
    assert.equal((await consume(workers[0], "claim", bucket("shared"), 5, 100)).rows[0].decision.allowed, true);
    assert.deepEqual((await admin.query("select hits from public.request_quotas where scope='claim' order by bucket")).rows.map((r) => r.hits), [1, 1]);
    await admin.query("insert into public.request_quotas(scope,bucket,hits,expires_at) select 'read',lpad(to_hex(n),64,'0'),1,clock_timestamp() - interval '2 hours' from generate_series(1,256) n");
    await consume(workers[0], "read", bucket("reader"), 5, 10);
    assert.equal((await admin.query("select count(*)::int as n from public.request_quotas where scope='read' and expires_at < clock_timestamp() - interval '1 hour'")).rows[0].n, 128);
    await consume(workers[0], "read", bucket("reader"), 5, 10);
    assert.equal((await admin.query("select count(*)::int as n from public.request_quotas where scope='read' and expires_at < clock_timestamp() - interval '1 hour'")).rows[0].n, 0);
    console.log("PASS: expired windows reset and stale client rows are purged in bounded batches");

    await assert.rejects(consume(workers[0], "bad-scope", bucket("bad"), 5, 10), (e) => e.code === "22023");
    await assert.rejects(consume(workers[0], "read", "203.0.113.1", 5, 10), (e) => e.code === "22023");
    for (const role of ["anon", "authenticated"]) {
      await workers[0].query(`set role ${role}`);
      assert.equal((await workers[0].query("select * from public.request_quotas")).rows.length, 0);
      await assert.rejects(consume(workers[0], "read", bucket("blocked"), 5, 10), (e) => e.code === "42501");
    }
    assert.equal((await admin.query("select prosecdef from pg_proc where oid='public.consume_request_quota(text,text,integer,integer,integer)'::regprocedure")).rows[0].prosecdef, false);
    assert.equal((await admin.query("select relrowsecurity from pg_class where oid='public.request_quotas'::regclass")).rows[0].relrowsecurity, true);
    console.log("PASS: invalid quota inputs and browser-role execution are denied; RLS remains enabled");
  }
} finally {
  await admin.query("rollback").catch(() => {});
  await Promise.allSettled(workers.map((client) => client.end()));
  if (ownsFixture) await admin.query("drop function if exists public.consume_request_quota(text,text,integer,integer,integer); drop table if exists public.request_quotas");
  await admin.end();
}
