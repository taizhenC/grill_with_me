import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

// Opt-in only: an EMPTY disposable database and an admin connection.
const connectionString = process.env.GRILL_TEST_DATABASE_URL;
if (!connectionString) throw new Error("Set GRILL_TEST_DATABASE_URL to an empty disposable grill_test database");
const options = { connectionString, connectionTimeoutMillis: 5000, statement_timeout: 10000 };
const admin = new pg.Client(options);
const workers = [];
const applicationName = `grill-store-${randomUUID()}`;
let ownsFixture = false;
const fixtureRoom = {
  schemaVersion: 1,
  project: { name: "DB concurrency fixture", idea: "Exercise atomic mutations.", mode: "production", hoursLeft: null, knownStack: "", demoTarget: "", outOfScope: [], mustWork: [] },
  roles: Array.from({ length: 8 }, (_, i) => ({ slug: `role-${i}`, name: `Role ${i}`, description: "Integration test.", owns: [], mustCover: [] })),
};

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error.code === code);
}

async function waitForBlocked(count) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    await admin.query("select pg_stat_clear_snapshot()");
    const result = await admin.query("select count(*)::int as n from pg_stat_activity where application_name = $1 and wait_event_type = 'Lock'", [applicationName]);
    if (result.rows[0].n >= count) return;
    await delay(25);
  }
  throw new Error(`Expected ${count} independent database sessions waiting on the row lock`);
}

async function row() {
  return (await admin.query("select * from public.rooms where key = 'fixture-key'")).rows[0];
}

try {
  await admin.connect();
  const database = (await admin.query("select current_database() as name, version() as version")).rows[0];
  assert.match(database.name, /^grill_test(?:[_-].+)?$/, "Refusing to alter a database not named grill_test or grill_test_*");
  assert.equal((await admin.query("select to_regclass('public.rooms') as rooms")).rows[0].rooms, null, "Refusing to replace an existing rooms table");
  console.log(database.version);
  await admin.query(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;`);
  assert.equal((await admin.query("select rolbypassrls from pg_roles where rolname = 'service_role'")).rows[0].rolbypassrls, true);
  ownsFixture = true;
  for (const file of ["0001_rooms.sql", "0002_atomic_room_mutations.sql", "0002_atomic_room_mutations.sql"]) {
    await admin.query(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
  await admin.query("grant usage on schema public to service_role, anon, authenticated; grant select, insert, update on public.rooms to service_role; grant select on public.rooms to anon, authenticated");
  await admin.query("insert into public.rooms(key,host_token,room,expires_at) values('fixture-key','fixture-token',$1,clock_timestamp() + interval '1 day')", [fixtureRoom]);

  for (let i = 0; i < 8; i++) {
    const worker = new pg.Client({ ...options, application_name: applicationName });
    workers.push(worker);
    await worker.connect();
    await worker.query("set role service_role");
  }
  const claim = (worker, slug, name) => worker.query("select public.claim_room($1,$2,$3)", ["fixture-key", slug, name]);
  const republish = (worker, room = fixtureRoom, token = "fixture-token", key = "fixture-key") =>
    worker.query("select public.republish_room($1,$2,$3) as version", [key, token, room]);

  // Release the row only after eight independent sessions are visibly blocked.
  await admin.query("begin");
  await admin.query("select key from public.rooms where key = 'fixture-key' for update");
  const allClaims = Promise.all(workers.map((worker, i) => claim(worker, `role-${i}`, `Member ${i}`)));
  void allClaims.catch(() => {});
  await waitForBlocked(8);
  await admin.query("commit");
  await allClaims;
  assert.deepEqual((await row()).claims, Object.fromEntries(workers.map((_, i) => [`role-${i}`, `Member ${i}`])));
  console.log("PASS: eight simultaneous claims preserve every role");

  for (let round = 0; round < 5; round++) {
    await admin.query("begin");
    await admin.query("select key from public.rooms where key = 'fixture-key' for update");
    const updates = Promise.all(workers.map((worker, i) => republish(worker, { ...fixtureRoom, project: { ...fixtureRoom.project, name: `Round ${round}, worker ${i}` } })));
    void updates.catch(() => {});
    await waitForBlocked(8);
    await admin.query("commit");
    const versions = (await updates).map((result) => result.rows[0].version).sort((a, b) => a - b);
    assert.deepEqual(versions, Array.from({ length: 8 }, (_, i) => 2 + round * 8 + i));
  }
  assert.equal((await row()).version, 41);
  assert.equal(Object.keys((await row()).claims).length, 8);
  console.log("PASS: 40 concurrent republishes return distinct committed versions");

  await admin.query("begin");
  await admin.query("select key from public.rooms where key = 'fixture-key' for update");
  const mixed = Promise.all(workers.map((worker, i) => i % 2 === 0
    ? claim(worker, `role-${i}`, `Updated ${i}`) : republish(worker)));
  void mixed.catch(() => {});
  await waitForBlocked(8);
  await admin.query("commit");
  await mixed;
  assert.equal((await row()).version, 45);
  assert.deepEqual((await row()).claims, Object.fromEntries(workers.map((_, i) => [`role-${i}`, i % 2 === 0 ? `Updated ${i}` : `Member ${i}`])));
  console.log("PASS: simultaneous claims and republishes retain independent claims");

  const oneRole = { ...fixtureRoom, roles: [fixtureRoom.roles[0]] };
  await admin.query("begin");
  await admin.query("select public.republish_room($1,$2,$3)", ["fixture-key", "fixture-token", oneRole]);
  const removedClaim = expectCode(claim(workers[0], "role-1", "Removed"), "PT404");
  void removedClaim.catch(() => {});
  await waitForBlocked(1);
  await admin.query("commit");
  await removedClaim;
  assert.deepEqual((await row()).claims, { "role-0": "Updated 0" });
  await expectCode(claim(workers[0], "role-1", "Removed"), "PT404");
  const before = await row();
  await expectCode(republish(workers[0], fixtureRoom, "wrong-token"), "PT403");
  assert.deepEqual(await row(), before);
  await expectCode(republish(workers[0], fixtureRoom, "fixture-token", "missing"), "PT404");
  console.log("PASS: removed roles, missing rooms and wrong tokens cannot mutate state");

  // Start before expiry, wait on a lock, then reject using current wall time.
  await admin.query("update public.rooms set expires_at = clock_timestamp() + interval '500 milliseconds'");
  await admin.query("begin");
  await admin.query("select key from public.rooms where key = 'fixture-key' for update");
  const expiringClaim = expectCode(claim(workers[0], "role-0", "Too late"), "PT404");
  void expiringClaim.catch(() => {});
  await waitForBlocked(1);
  await admin.query("select pg_sleep(0.6)");
  await admin.query("commit");
  await expiringClaim;
  await expectCode(republish(workers[0]), "PT404");
  assert.equal((await row()).claims["role-0"], "Updated 0");
  console.log("PASS: expiry is rechecked after lock acquisition");

  for (const role of ["anon", "authenticated"]) {
    await workers[0].query(`set role ${role}`);
    assert.equal((await workers[0].query("select * from public.rooms")).rows.length, 0);
    await expectCode(claim(workers[0], "role-0", "No access"), "42501");
    await expectCode(republish(workers[0]), "42501");
    const privileges = (await admin.query("select has_function_privilege($1, 'public.claim_room(text,text,text)', 'execute') as claim, has_function_privilege($1, 'public.republish_room(text,text,jsonb)', 'execute') as republish", [role])).rows[0];
    assert.deepEqual(privileges, { claim: false, republish: false });
  }
  const functions = await admin.query("select prosecdef from pg_proc where oid in ('public.claim_room(text,text,text)'::regprocedure, 'public.republish_room(text,text,jsonb)'::regprocedure)");
  assert.equal(functions.rows.length, 2);
  assert(functions.rows.every((fn) => fn.prosecdef === false));
  assert.equal((await admin.query("select relrowsecurity from pg_class where oid = 'public.rooms'::regclass")).rows[0].relrowsecurity, true);
  console.log("PASS: anon/authenticated cannot execute RPCs or read RLS-protected rows");
} finally {
  await admin.query("rollback").catch(() => {});
  await Promise.allSettled(workers.map((worker) => worker.end()));
  if (ownsFixture) {
    await admin.query("drop function if exists public.claim_room(text,text,text); drop function if exists public.republish_room(text,text,jsonb); drop table if exists public.rooms");
  }
  await admin.end();
}
