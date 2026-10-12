// Synthetic sandbox data only. Run after migrations; never import production data.
// Supports repository sandbox/ and the /usr/src/app/sandbox-seed.js Docker mount.
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const IDS = Object.freeze({
  customer: "11111111-1111-4111-8111-111111111111",
  provider: "22222222-2222-4222-8222-222222222222",
  service: "33333333-3333-4333-8333-333333333333",
});
const MARKER = "Synthetic EC2 demo only";

function validateEnvironment(env) {
  let url;
  try { url = new URL(env.DATABASE_URL || ""); }
  catch { throw new Error("Set an explicit sandbox DATABASE_URL before running the seed"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "postgres" ||
      url.pathname !== "/taskgenie_sandbox" || url.port !== "5432") {
    throw new Error("Refusing non-sandbox database: expected postgres:5432/taskgenie_sandbox");
  }
  // pg connection-string query parameters can override the URL's host/database.
  for (const [key, value] of url.searchParams) {
    if (key !== "sslmode" || value !== "disable") throw new Error("Sandbox DATABASE_URL permits only sslmode=disable as a query parameter");
  }
  if (typeof env.DEMO_PASSWORD !== "string" || env.DEMO_PASSWORD.length < 16 ||
      Buffer.byteLength(env.DEMO_PASSWORD, "utf8") > 72) {
    throw new Error("DEMO_PASSWORD must have at least 16 characters and at most 72 UTF-8 bytes");
  }
  return env.DEMO_PASSWORD;
}

function appRequire() {
  const directory = [__dirname, path.resolve(__dirname, "../server")].find((candidate) =>
    fs.existsSync(path.join(candidate, "config/db.js")) && fs.existsSync(path.join(candidate, "package.json")));
  if (!directory) throw new Error("Cannot locate server/config/db.js; mount the seed at /usr/src/app/sandbox-seed.js");
  return createRequire(path.join(directory, "package.json"));
}

async function seedSandbox({ db, bcrypt, services, password }) {
  const service = services.find((item) => item.name === "House Cleaning");
  if (!service?.slug || !service.category) throw new Error("House Cleaning missing from application service catalog");
  const client = await db.connect();
  let began = false;
  try {
    const actual = await client.query("SELECT current_database() AS name");
    if (actual.rows[0].name !== "taskgenie_sandbox") throw new Error("Wrong database; seed requires taskgenie_sandbox");
    await client.query("BEGIN"); began = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('taskgenie:sandbox-seed:v1'))");
    const hash = await bcrypt.hash(password, 10);
    for (const [id, role, custom, email, name] of [
      [IDS.customer, "customer", "CUSDEMO0000000001", "customer@sandbox.example", "Demo Customer"],
      [IDS.provider, "provider", "SRVDEMO0000000001", "provider@sandbox.example", "Demo Provider"],
    ]) {
      const existing = await client.query("SELECT id,email,role,custom_id,password FROM public.users WHERE id=$1 OR email=$2 OR custom_id=$3 FOR UPDATE", [id,email,custom]);
      if (existing.rows.length) {
        const row = existing.rows[0];
        if (existing.rows.length !== 1 || row.id !== id || row.email !== email || row.role !== role || row.custom_id !== custom) {
          throw new Error(`Demo ${role} identity collides with another row; no data changed`);
        }
        if (!await bcrypt.compare(password, row.password)) {
          throw new Error(`Demo ${role} password differs; reuse the original DEMO_PASSWORD (seed does not reset passwords)`);
        }
      } else {
        await client.query(`INSERT INTO public.users(id,name,email,password,role,custom_id,location,lat,lng,bio)
          VALUES($1,$2,$3,$4,$5,$6,'Bhopal',23.2599,77.4126,'Synthetic sandbox account')`, [id,name,email,hash,role,custom]);
      }
    }
    const existingService = await client.query("SELECT id,name,description FROM public.services WHERE id=$1 OR slug=$2 FOR UPDATE", [IDS.service,service.slug]);
    if (existingService.rows.some((row) => row.id !== IDS.service || row.name !== service.name || row.description !== MARKER)) {
      throw new Error("Demo service ID/slug collides with a non-demo row; no data changed");
    }
    // Repair positively identified fixtures from the earlier seed too.
    await client.query(`INSERT INTO public.services(id,name,description,price,slug,category,price_unit,image_url)
      VALUES($1,$2,$3,1200,$4,$5,'fixed',$6) ON CONFLICT(id) DO UPDATE SET
      name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,
      slug=EXCLUDED.slug,category=EXCLUDED.category,price_unit=EXCLUDED.price_unit,image_url=EXCLUDED.image_url`,
      [IDS.service,service.name,MARKER,service.slug,service.category,service.image]);
    const availability = Array.from({ length: 7 }, (_, day) => ({ day, start: "08:00", end: "20:00" }));
    await client.query(`INSERT INTO public.providers(user_id,status,is_verified,kyc_status,description,price,service_id,availability)
      VALUES($1,'approved',true,'approved','Synthetic demo provider, not a real verified person',1200,$2,$3::jsonb)
      ON CONFLICT(user_id) DO UPDATE SET status=EXCLUDED.status,is_verified=EXCLUDED.is_verified,
      kyc_status=EXCLUDED.kyc_status,description=EXCLUDED.description,price=EXCLUDED.price,
      service_id=EXCLUDED.service_id,availability=EXCLUDED.availability`, [IDS.provider,IDS.service,JSON.stringify(availability)]);
    await client.query(`INSERT INTO public.provider_services(provider_id,service_id,price,price_unit,is_visible,slug,description)
      VALUES($1,$2,1200,'fixed',true,$3,$4) ON CONFLICT(provider_id,service_id) DO UPDATE SET
      price=EXCLUDED.price,price_unit=EXCLUDED.price_unit,is_visible=EXCLUDED.is_visible,
      slug=EXCLUDED.slug,description=EXCLUDED.description`, [IDS.provider,IDS.service,service.slug,MARKER]);
    for (let day=0; day<7; day++) {
      await client.query(`INSERT INTO public.provider_master_availability(provider_id,day_of_week,start_time,end_time)
        VALUES($1,$2,'08:00','20:00') ON CONFLICT(provider_id,day_of_week,start_time,end_time) DO NOTHING`, [IDS.provider,day]);
    }
    await client.query("COMMIT"); began = false;
    return { customer: IDS.customer, provider: IDS.provider, service: IDS.service, slug: service.slug, category: service.category };
  } catch (error) {
    if (began) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function main() {
  // Validate before loading config/db, which reads dotenv and constructs a pool.
  const password = validateEnvironment(process.env);
  const requireApp = appRequire();
  const db = requireApp("./config/db");
  try {
    const result = await seedSandbox({ db, bcrypt: requireApp("bcrypt"), services: requireApp("./utils/services").SERVICES, password });
    console.log(`Sandbox fixtures ready: ${result.slug} (${result.category}), 1200 INR, seven working days. No external messages sent.`);
  } finally { await db.end(); }
}
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { seedSandbox, validateEnvironment, appRequire, IDS };
