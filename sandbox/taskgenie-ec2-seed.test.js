const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { createRequire } = Module;
const requireApp = createRequire(path.resolve(__dirname, "../server/package.json"));
const { seedSandbox, validateEnvironment, appRequire, IDS } = require("./taskgenie-ec2-seed");

test("sandbox seed rejects wrong destinations and bcrypt-truncated passwords", () => {
  const good = { DATABASE_URL: "postgresql://fixture:fixture@postgres:5432/taskgenie_sandbox", DEMO_PASSWORD: "fixture-password-123456" };
  assert.equal(validateEnvironment(good), good.DEMO_PASSWORD);
  assert.equal(validateEnvironment({ ...good, DATABASE_URL: good.DATABASE_URL + "?sslmode=disable" }), good.DEMO_PASSWORD);
  assert.throws(() => validateEnvironment({ ...good, DATABASE_URL: good.DATABASE_URL + "?host=another-server" }));
  assert.throws(() => validateEnvironment({ ...good, DATABASE_URL: good.DATABASE_URL + "?database=production" }));
  for (const DATABASE_URL of ["", "https://postgres/taskgenie_sandbox", "postgresql://localhost/taskgenie_sandbox", "postgresql://postgres/production", "postgresql://postgres:5555/taskgenie_sandbox"]) {
    assert.throws(() => validateEnvironment({ ...good, DATABASE_URL }));
  }
  assert.throws(() => validateEnvironment({ ...good, DEMO_PASSWORD: "short" }));
  assert.throws(() => validateEnvironment({ ...good, DEMO_PASSWORD: "é".repeat(40) }));
});

test("seed resolves actual server dependencies from its repository sandbox location", () => {
  assert.equal(appRequire().resolve("./config/db"), path.resolve(__dirname, "../server/config/db.js"));
  assert.equal(typeof appRequire()("bcrypt").compare, "function");
});

const url = process.env.SANDBOX_SEED_TEST_DATABASE_URL;
test("sandbox seed: actual migrated PostgreSQL/PostGIS schema, repeatability, rollback and booking compatibility", { skip: !url, timeout: 60000 }, async (t) => {
  const { Pool } = requireApp("pg");
  const bcrypt = requireApp("bcrypt");
  const services = requireApp("./utils/services").SERVICES;
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  assert.equal((await pool.query("SELECT current_database() AS name")).rows[0].name, "taskgenie_sandbox");
  // This suite owns an EMPTY disposable DB. Never audit or truncate application data.
  assert.equal((await pool.query("SELECT to_regclass('public.users') AS existing")).rows[0].existing, null, "Provide an empty disposable test database");
  const target = path.resolve(__dirname, "../server/migrations/create_tables.js");
  const instance = new Module(target, module);
  instance.filename = target; instance.paths = Module._nodeModulePaths(path.dirname(target));
  const original = instance.require.bind(instance);
  instance.require = (name) => {
    if (name === "../config/db") return pool;
    if (name === "./migrate_booking_integrity") return { integritySchema: fs.readFileSync(path.resolve(__dirname, "../server/migrations/20261011_booking_integrity.sql"), "utf8") };
    if (name === "./migrate_chat") return { chatSchema: fs.readFileSync(path.resolve(__dirname, "../server/migrations/20261010_booking_chat.sql"), "utf8") };
    return original(name);
  };
  instance._compile(fs.readFileSync(target, "utf8"), target);
  for (const query of instance.exports.queries) await pool.query(query);
  const password = "fixture-password-123456";
  const run = () => seedSandbox({ db: pool, bcrypt, services, password });

  await t.test("initial seed and concurrent reruns keep two accounts, one service and seven intervals", async () => {
    await run(); await Promise.all([run(), run()]);
    for (const [table, expected] of [["users", 2], ["services", 1], ["providers", 1], ["provider_services", 1], ["provider_master_availability", 7]]) {
      assert.equal(Number((await pool.query(`SELECT COUNT(*) FROM public.${table}`)).rows[0].count), expected);
    }
    for (const row of (await pool.query("SELECT password FROM users")).rows) assert.equal(await bcrypt.compare(password, row.password), true);
    const service = (await pool.query("SELECT slug,category,price_unit FROM services")).rows[0];
    assert.deepEqual(service, { slug: "house-cleaning", category: "Home Services", price_unit: "fixed" });
  });
  await t.test("PostGIS trigger populates provider geography used by radius discovery", async () => {
    const found = await pool.query(`SELECT u.id FROM users u JOIN providers p ON p.user_id=u.id
      JOIN provider_services ps ON ps.provider_id=p.user_id AND ps.is_visible
      JOIN services s ON s.id=ps.service_id WHERE p.status='approved' AND s.slug='house-cleaning'
      AND ST_DWithin(u.geom, ST_SetSRID(ST_MakePoint(77.4126,23.2599),4326)::geography,1000)`);
    assert.deepEqual(found.rows.map((row) => row.id), [IDS.provider]);
  });
  await t.test("actual booking schedule accepts the fixture with the configured two-hour duration", async () => {
    const { validateSchedule } = requireApp("./services/bookingSchedule");
    const booking = { provider_id: IDS.provider, service_id: "house-cleaning", date: "2040-01-02", start_time: "10:00" };
    const selected = await validateSchedule(pool, booking);
    assert.equal(Number(selected.price), 1200); assert.equal(booking.end_time, "12:00");
  });
  await t.test("changed password fails rather than silently leaving unusable login credentials", async () => {
    const before = (await pool.query("SELECT password FROM users ORDER BY id")).rows;
    await assert.rejects(seedSandbox({ db: pool, bcrypt, services, password: "different-fixture-password" }), /reuse the original/);
    assert.deepEqual((await pool.query("SELECT password FROM users ORDER BY id")).rows, before);
  });
  await t.test("older seed labels are repaired only on the identified synthetic service", async () => {
    await pool.query("UPDATE services SET slug='sandbox-cleaning',category='Cleaning' WHERE id=$1", [IDS.service]);
    await run();
    assert.deepEqual((await pool.query("SELECT slug,category FROM services WHERE id=$1", [IDS.service])).rows[0], { slug: "house-cleaning", category: "Home Services" });
  });
  await t.test("fixture identity collision aborts the transaction without overwriting the row", async () => {
    await pool.query("UPDATE users SET email='other@sandbox.example' WHERE id=$1", [IDS.provider]);
    await assert.rejects(run(), /identity collides/);
    assert.equal((await pool.query("SELECT email FROM users WHERE id=$1", [IDS.provider])).rows[0].email, "other@sandbox.example");
    await pool.query("UPDATE users SET email='provider@sandbox.example' WHERE id=$1", [IDS.provider]);
  });
  await t.test("non-fixture service collision preserves metadata", async () => {
    await pool.query("UPDATE services SET description='non-fixture' WHERE id=$1", [IDS.service]);
    await assert.rejects(run(), /non-demo row/);
    assert.equal((await pool.query("SELECT description FROM services WHERE id=$1", [IDS.service])).rows[0].description, "non-fixture");
    await pool.query("UPDATE services SET description='Synthetic EC2 demo only' WHERE id=$1", [IDS.service]);
  });
  await t.test("failure midway through seed rolls back previous fixture changes", async () => {
    await pool.query("UPDATE services SET category='Before rollback' WHERE id=$1", [IDS.service]);
    const injected = { connect: async () => {
      const client = await pool.connect();
      return { query: (sql, params) => sql.includes("INSERT INTO public.provider_services") ? Promise.reject(new Error("Injected failure")) : client.query(sql, params), release: () => client.release() };
    } };
    await assert.rejects(seedSandbox({ db: injected, bcrypt, services, password }), /Injected failure/);
    assert.equal((await pool.query("SELECT category FROM services WHERE id=$1", [IDS.service])).rows[0].category, "Before rollback");
    await run();
  });
});
