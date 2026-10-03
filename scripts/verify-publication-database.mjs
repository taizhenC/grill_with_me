import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

const connectionString = process.env.GRILL_TEST_DATABASE_URL;
if (!connectionString) throw new Error("Set GRILL_TEST_DATABASE_URL to an empty disposable grill_test database");
const options = { connectionString, connectionTimeoutMillis: 5000, statement_timeout: 10000 };
const admin = new pg.Client(options);
const workers = [];
const applicationName = `grill-publication-${randomUUID()}`;
let ownsFixture = false;
const room = { schemaVersion: 1, project: { name: "Recovery" }, roles: [{ slug: "builder" }] };
const digest = (value) => createHash("sha256").update(value).digest("hex");
const context = (age = 0) => ({ hash: randomBytes(32).toString("hex"), payloadHash: digest(JSON.stringify(room)), origin: "https://grill.test", issuedAt: new Date(Date.now() - age).toISOString() });
const create = (client, ctx, key = `key-${randomUUID()}`, token = `token-${randomUUID()}`) => client.query(
  "select public.create_room_recoverable($1,$2,$3,$4,$5,$6,$7) as result", [ctx.hash, ctx.payloadHash, ctx.origin, ctx.issuedAt, key, token, room],
);
const code = (promise, expected) => assert.rejects(promise, (error) => error.code === expected);
async function blocked(n) {
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    await admin.query("select pg_stat_clear_snapshot()");
    if ((await admin.query("select count(*)::int as n from pg_stat_activity where application_name=$1 and wait_event_type='Lock'", [applicationName])).rows[0].n >= n) return;
    await delay(25);
  }
  throw new Error(`Expected ${n} independent publication sessions blocked on locks`);
}
try {
  await admin.connect();
  const database = (await admin.query("select current_database() as name, version() as version")).rows[0];
  assert.match(database.name, /^grill_test(?:[_-].+)?$/);
  assert.deepEqual((await admin.query("select to_regclass('public.rooms') as rooms, to_regclass('public.request_quotas') as quotas, to_regclass('public.publication_requests') as publications")).rows[0], { rooms: null, quotas: null, publications: null }, "Refusing to replace existing application tables");
  console.log(database.version);
  await admin.query(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  end $$;`);
  assert.equal((await admin.query("select rolbypassrls from pg_roles where rolname='service_role'")).rows[0].rolbypassrls, true);
  ownsFixture = true;
  for (const file of ["0001_rooms.sql", "0002_atomic_room_mutations.sql", "0003_shared_request_quotas.sql", "0004_retention_and_room_deletion.sql", "0005_publication_recovery.sql", "0005_publication_recovery.sql"]) {
    await admin.query(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
  await admin.query("grant usage on schema public to service_role,anon,authenticated; grant select,insert,update on public.rooms to service_role");
  for (let i = 0; i < 8; i++) {
    const worker = new pg.Client({ ...options, application_name: applicationName }); workers.push(worker);
    await worker.connect(); await worker.query("set role service_role");
  }
  const ctx = context();
  await workers[0].query("begin");
  const first = (await create(workers[0], ctx)).rows[0].result;
  const retries = Promise.all(workers.slice(1).map((worker) => create(worker, ctx)));
  void retries.catch(() => {});
  await blocked(7);
  await workers[0].query("commit");
  const recovered = (await retries).map((result) => result.rows[0].result);
  assert.equal(first.recovery.replayed, false);
  for (const result of recovered) assert.deepEqual(result, { ...first, recovery: { ...first.recovery, replayed: true } });
  assert.equal((await admin.query("select count(*)::int as n from public.rooms")).rows[0].n, 1);
  console.log("PASS: eight independent workers create one room and recover the identical token");
  for (const changed of [{ ...ctx, payloadHash: digest("changed") }, { ...ctx, origin: "https://other.test" }]) {
    await code(create(workers[0], changed), "PT409");
  }
  // A collision is distinct from replay. The failed transaction owns no ledger
  // row, so a new candidate with the SAME request identity can safely succeed.
  const collision = context();
  await assert.rejects(create(workers[0], collision, first.key), (error) => error.code === "23505" && error.constraint === "rooms_key_key");
  assert.equal((await admin.query("select count(*)::int as n from public.publication_requests where capability_hash=$1", [collision.hash])).rows[0].n, 0);
  const distinct = (await create(workers[0], collision)).rows[0].result;
  assert.notEqual(distinct.key, first.key); assert.notEqual(distinct.hostToken, first.hostToken);
  console.log("PASS: changed bindings conflict and random room-key collisions can retry without losing the capability");

  await workers[0].query("select public.delete_room($1,$2)", [first.key, first.hostToken]);
  assert.equal((await admin.query("select room_id from public.publication_requests where capability_hash=$1", [ctx.hash])).rows[0].room_id, null);
  await code(create(workers[0], ctx), "PT410");
  await admin.query("update public.rooms set expires_at=clock_timestamp()-interval '1 second' where key=$1", [distinct.key]);
  await code(create(workers[0], collision), "PT410");
  await workers[0].query("select public.purge_expired_data(100,100)");
  await code(create(workers[0], collision), "PT410");
  console.log("PASS: host deletion and expiry cleanup leave unrecoverable tombstones without resurrecting rooms");

  // Deletion holds room and ledger locks; the retry waits, then sees the null FK.
  const deleting = context(); const toDelete = (await create(workers[0], deleting)).rows[0].result;
  await workers[0].query("begin");
  await workers[0].query("select public.delete_room($1,$2)", [toDelete.key, toDelete.hostToken]);
  const afterDelete = code(create(workers[1], deleting), "PT410"); void afterDelete.catch(() => {});
  await blocked(1); await workers[0].query("commit"); await afterDelete;

  // Conversely a replay owning the ledger can finish before deletion. No room
  // lock is acquired, preventing the reverse-order FK/room deadlock.
  const racing = context(); const raced = (await create(workers[0], racing)).rows[0].result;
  await workers[0].query("begin");
  await workers[0].query("select * from public.publication_requests where capability_hash=$1 for update", [racing.hash]);
  const deletion = workers[1].query("select public.delete_room($1,$2)", [raced.key, raced.hostToken]); void deletion.catch(() => {});
  await blocked(1);
  assert.equal((await create(workers[0], racing)).rows[0].result.key, raced.key);
  await workers[0].query("commit"); await deletion;
  await code(create(workers[0], racing), "PT410");
  console.log("PASS: replay/deletion races serialize without a ledger/room lock-order deadlock");

  const expiring = context(86400_000 - 800);
  await workers[0].query("begin"); await create(workers[0], expiring);
  const tooLate = code(create(workers[1], expiring), "PT410"); void tooLate.catch(() => {});
  await blocked(1); await admin.query("select pg_sleep(0.9)");
  await workers[0].query("commit"); await tooLate;
  const purged = (await workers[0].query("select public.purge_expired_data(100,100) as result")).rows[0].result;
  assert.equal(purged.publicationRequestsDeleted, 1);
  assert.equal((await admin.query("select count(*)::int as n from public.publication_requests where capability_hash=$1", [expiring.hash])).rows[0].n, 0);
  await code(create(workers[0], expiring), "PT410");
  await code(create(workers[0], context(-301_000)), "PT400");
  console.log("PASS: expiry is rechecked after lock waits and expired capabilities stay unusable after ledger purge");

  for (const role of ["anon", "authenticated"]) {
    await admin.query(`grant select on public.publication_requests to ${role}`);
    await workers[0].query(`set role ${role}`);
    assert.equal((await workers[0].query("select * from public.publication_requests")).rows.length, 0);
    await code(create(workers[0], context()), "42501");
  }
  const fn = (await admin.query("select prosecdef from pg_proc where oid='public.create_room_recoverable(text,text,text,timestamptz,text,text,jsonb)'::regprocedure")).rows[0];
  assert.equal(fn.prosecdef, false);
  console.log("PASS: anonymous/authenticated roles cannot execute recovery or read the protected ledger");
} finally {
  await Promise.allSettled(workers.map(async (worker) => { await worker.query("rollback").catch(() => {}); await worker.end(); }));
  if (ownsFixture) await admin.query("drop table if exists public.publication_requests; drop function if exists public.create_room_recoverable(text,text,text,timestamptz,text,text,jsonb); drop function if exists public.delete_room(text,text); drop function if exists public.purge_expired_data(integer,integer); drop function if exists public.claim_room(text,text,text); drop function if exists public.republish_room(text,text,jsonb); drop function if exists public.consume_request_quota(text,text,integer,integer,integer); drop table if exists public.request_quotas; drop table if exists public.rooms");
  await admin.end();
}
