const { serverRequire } = require('./config.cjs');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../../server/config/db');
const jwt = serverRequire('jsonwebtoken');
const id = (prefix, n) => `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
(async () => {
  if (!(await db.query('SELECT current_database() AS name')).rows[0].name.endsWith('_bench')) throw Error('Disposable benchmark DB required');
  for (const sql of require('../../server/migrations/create_tables').queries) await db.query(sql);
  await db.query('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
  await db.query(`INSERT INTO services(id,name,description,price,slug) VALUES($1,'House Cleaning','Synthetic k6 fixture',1200,'bench-cleaning') ON CONFLICT DO NOTHING`, [id(3, 1)]);
  await db.query(`INSERT INTO users(id,name,email,password,role,custom_id,location,lat,lng)
    SELECT ('10000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'Synthetic provider '||g,'provider'||g||'@bench.invalid','unusable','provider','SRVBENCH'||lpad(g::text,12,'0'),'Synthetic fixture',
      CASE WHEN g<=2000 THEN 12.97+((g%80)-40)*0.004 ELSE 20+(g%80)*0.03 END,
      CASE WHEN g<=2000 THEN 77.59+((g%100)-50)*0.004 ELSE 80+(g%100)*0.03 END
    FROM generate_series(1,10000) g ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO providers(user_id,status,rating,is_verified,kyc_status,availability)
    SELECT id,'approved',4.5,true,'approved','[]'::jsonb FROM users WHERE role='provider' ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO provider_services(provider_id,service_id,price,is_visible)
    SELECT id,$1,1200,true FROM users WHERE role='provider' ON CONFLICT DO NOTHING`, [id(3,1)]);
  await db.query(`INSERT INTO provider_master_availability(provider_id,day_of_week,start_time,end_time)
    SELECT id,d,'08:00','20:00' FROM users CROSS JOIN generate_series(0,6) d WHERE role='provider' ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO users(id,name,email,password,role,custom_id,lat,lng)
    SELECT ('20000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'Synthetic customer '||g,'customer'||g||'@bench.invalid','unusable','customer','CUSBENCH'||lpad(g::text,12,'0'),12.97,77.59
    FROM generate_series(1,200) g ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO bookings(booking_id,provider_id,user_id,service_id,date,start_time,end_time,status,address,price,payment_method,payment_status,latitude,longitude)
    SELECT md5('taskgenie-k6-history-'||g)::uuid,('10000000-0000-4000-8000-'||lpad((1+g%10000)::text,12,'0'))::uuid,$1,$2,
      '2025-01-01'::date+(g%365),'10:00','12:00','completed','Synthetic historical fixture',1200,'cod','paid',12.97,77.59
    FROM generate_series(1,50000) g ON CONFLICT DO NOTHING`, [id(2,1),id(3,1)]);
  await db.query('ANALYZE');
  const providers = (await db.query(`SELECT id,lat,lng FROM users WHERE role='provider' ORDER BY id LIMIT 200`)).rows;
  const customers = Array.from({length:200}, (_,i) => jwt.sign({id:id(2,i+1),role:'customer'},process.env.JWT_SECRET,{expiresIn:'2d'}));
  const providerTokens = providers.map(p => jwt.sign({id:p.id,role:'provider'},process.env.JWT_SECRET,{expiresIn:'2d'}));
  fs.writeFileSync(path.join(__dirname,'fixture.json'),JSON.stringify({service:id(3,1),providers,customers,providerTokens},null,2));
  const conditions = {seededAt:new Date().toISOString(),node:process.version,
    counts:(await db.query(`SELECT (SELECT count(*) FROM providers)::int AS providers,(SELECT count(*) FROM users WHERE role='customer')::int AS customers,(SELECT count(*) FROM provider_services)::int AS provider_services,(SELECT count(*) FROM provider_master_availability)::int AS availability_rules,(SELECT count(*) FROM bookings)::int AS bookings`)).rows[0],
    database:(await db.query('SELECT version(),PostGIS_Full_Version() AS postgis')).rows[0],
    indexes:(await db.query(`SELECT indexname,indexdef FROM pg_indexes WHERE tablename IN ('users','bookings') ORDER BY indexname`)).rows};
  fs.writeFileSync(path.join(__dirname,'results/conditions.json'),JSON.stringify(conditions,null,2));
  console.log(JSON.stringify(conditions.counts));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.end());
