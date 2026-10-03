import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

const connectionString = process.env.GRILL_TEST_DATABASE_URL;
if (!connectionString) throw new Error("Set GRILL_TEST_DATABASE_URL to an empty disposable grill_test database");
const options = { connectionString, connectionTimeoutMillis: 5000, statement_timeout: 10000 };
const admin = new pg.Client(options);
const workers = [];
const applicationName = `grill-retention-${randomUUID()}`;
let ownsFixture = false;
const room = { roles: [{ slug: "frontend" }] };
const remove = (client, key, token = "host-token") => client.query("select public.delete_room($1,$2) as removed", [key, token]);
const purge = (client, rooms = 2, quotas = 3) => client.query("select public.purge_expired_data($1,$2) as result", [rooms, quotas]);
const insertRoom = (key, expired = false) => admin.query("insert into public.rooms(key,host_token,room,expires_at) values($1,'host-token',$2,clock_timestamp() + $3::interval)", [key, room, expired ? "-1 day" : "1 day"]);
const count = async (table) => (await admin.query(`select count(*)::int as n from public.${table}`)).rows[0].n;
async function blocked(n) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    await admin.query("select pg_stat_clear_snapshot()");
    if ((await admin.query("select count(*)::int as n from pg_stat_activity where application_name=$1 and wait_event_type='Lock'", [applicationName])).rows[0].n >= n) return;
    await delay(25);
  }
  throw new Error(`Expected ${n} database sessions blocked on the deleted row`);
}
const code = (promise, expected) => assert.rejects(promise, (e) => e.code === expected);

await admin.connect();
try {
  const database = (await admin.query("select current_database() as name, version() as version")).rows[0];
  assert.match(database.name, /^grill_test(?:[_-].+)?$/);
  const existing = (await admin.query("select to_regclass('public.rooms') as rooms, to_regclass('public.request_quotas') as quotas")).rows[0];
  assert.deepEqual(existing, { rooms: null, quotas: null }, "Refusing to replace existing application tables");
  console.log(database.version);
  await admin.query(`do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  end $$;`);
  assert.equal((await admin.query("select rolbypassrls from pg_roles where rolname='service_role'")).rows[0].rolbypassrls, true);
  ownsFixture = true;
  for (const file of ["0001_rooms.sql", "0002_atomic_room_mutations.sql", "0003_shared_request_quotas.sql", "0004_retention_and_room_deletion.sql", "0004_retention_and_room_deletion.sql"]) {
    await admin.query(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
  await admin.query("grant usage on schema public to service_role,anon,authenticated; grant select,insert,update on public.rooms to service_role; grant select on public.rooms,public.request_quotas to anon,authenticated");
  for (let i = 0; i < 8; i++) {
    const worker = new pg.Client({ ...options, application_name: applicationName }); workers.push(worker);
    await worker.connect(); await worker.query("set role service_role");
  }
  await insertRoom("active"); await insertRoom("expired", true);
  await code(remove(workers[0], "active", "wrong"), "PT403");
  await code(remove(workers[0], "expired", null), "PT403");
  await code(remove(workers[0], "missing"), "PT404");
  assert.equal(await count("rooms"), 2);
  assert.equal((await remove(workers[0], "expired")).rows[0].removed, true);
  assert.equal(await count("rooms"), 1);
  console.log("PASS: host deletion physically removes expired rows; missing and bad-token outcomes preserve data");

  // The delete transaction owns the row before the writers queue behind it.
  await insertRoom("race");
  await workers[0].query("begin"); await remove(workers[0], "race");
  const claim = workers[1].query("select public.claim_room('race','frontend','Alice')");
  const republish = workers[2].query("select public.republish_room('race','host-token',$1)", [room]);
  void claim.catch(() => {}); void republish.catch(() => {});
  await blocked(2); await workers[0].query("commit");
  await code(claim, "PT404"); await code(republish, "PT404");
  assert.equal((await admin.query("select * from public.rooms where key='race'")).rows.length, 0);
  console.log("PASS: queued claims and republishes cannot resurrect a deleted room");

  for (let i = 0; i < 7; i++) await insertRoom(`old-${i}`, true);
  await admin.query("insert into public.request_quotas(scope,bucket,hits,expires_at) select 'read',lpad(to_hex(n),64,'0'),1,clock_timestamp() - interval '2 hours' from generate_series(1,13)n");
  await admin.query("insert into public.request_quotas values('read','global',7,clock_timestamp()-interval '2 hours'),('claim',repeat('a',64),1,clock_timestamp()+interval '1 hour'),('republish',repeat('b',64),1,clock_timestamp()-interval '30 minutes')");
  const results = await Promise.all(workers.map((worker) => purge(worker)));
  assert.equal(results.reduce((sum, r) => sum + r.rows[0].result.roomsDeleted, 0), 7);
  assert.equal(results.reduce((sum, r) => sum + r.rows[0].result.quotaBucketsDeleted, 0), 13);
  assert.equal(await count("rooms"), 1); assert.equal(await count("request_quotas"), 3);
  assert.deepEqual((await purge(workers[0])).rows[0].result, { roomsDeleted: 0, quotaBucketsDeleted: 0 });
  assert.equal((await admin.query("select hits from public.request_quotas where bucket='global'")).rows[0].hits, 7);
  console.log("PASS: concurrent bounded purges remove every expired row once, retain active/grace-period clients and four possible global counters");

  // Purge must not wait on a live transaction; reconciliation removes it later.
  await insertRoom("busy", true);
  await workers[0].query("begin"); await workers[0].query("select id from public.rooms where key='busy' for update");
  assert.deepEqual((await purge(workers[1])).rows[0].result, { roomsDeleted: 0, quotaBucketsDeleted: 0 });
  assert.equal(await count("rooms"), 2);
  await workers[0].query("commit");
  assert.equal((await purge(workers[1])).rows[0].result.roomsDeleted, 1);
  console.log("PASS: busy expired rows are skipped without blocking and deleted on reconciliation");

  // Force the second deletion to fail: the room deletion in the same batch rolls back.
  await insertRoom("rollback", true);
  await admin.query("insert into public.request_quotas values('read',repeat('c',64),1,clock_timestamp()-interval '2 hours')");
  await admin.query("create function public.reject_quota_delete() returns trigger language plpgsql as $$ begin raise exception 'fixture'; end $$; create trigger retention_rollback before delete on public.request_quotas for each row execute function public.reject_quota_delete()");
  await code(purge(workers[0]), "P0001");
  assert.equal((await admin.query("select * from public.rooms where key='rollback'")).rows.length, 1);
  assert.equal((await admin.query("select * from public.request_quotas where bucket=repeat('c',64)")).rows.length, 1);
  await admin.query("drop trigger retention_rollback on public.request_quotas; drop function public.reject_quota_delete()");
  await purge(workers[0]);
  console.log("PASS: room and quota cleanup commit atomically within each batch");

  for (const args of [[0, 1], [1, 0], [2001, 1], [1, 5001], [null, 1]]) await code(purge(workers[0], ...args), "22023");
  for (const role of ["anon", "authenticated"]) {
    await workers[0].query(`set role ${role}`);
    assert.equal((await workers[0].query("select * from public.rooms")).rows.length, 0);
    assert.equal((await workers[0].query("select * from public.request_quotas")).rows.length, 0);
    await code(remove(workers[0], "active"), "42501"); await code(purge(workers[0]), "42501");
  }
  for (const signature of ["public.delete_room(text,text)", "public.purge_expired_data(integer,integer)"]) {
    assert.equal((await admin.query("select prosecdef from pg_proc where oid=$1::regprocedure", [signature])).rows[0].prosecdef, false);
    assert.equal((await admin.query("select has_function_privilege('anon',$1,'execute') as allowed", [signature])).rows[0].allowed, false);
  }
  console.log("PASS: browser roles cannot read stored data or invoke deletion/purge; functions remain security invoker");
} finally {
  await admin.query("rollback").catch(() => {});
  await Promise.allSettled(workers.map(async (client) => { await client.query("rollback").catch(() => {}); await client.end(); }));
  if (ownsFixture) await admin.query(`drop function if exists public.delete_room(text,text),public.purge_expired_data(integer,integer),public.claim_room(text,text,text),public.republish_room(text,text,jsonb),public.consume_request_quota(text,text,integer,integer,integer);
    drop table if exists public.rooms,public.request_quotas cascade; drop function if exists public.reject_quota_delete()`);
  await admin.end();
}
