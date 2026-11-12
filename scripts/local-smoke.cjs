const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
let target;
try { target = new URL(process.env.DATABASE_URL || ''); } catch { throw new Error('A local fixture DATABASE_URL is required'); }
if (target.hostname !== 'postgres' || target.pathname !== '/taskgenie_local' || target.search || process.env.SMTP_HOST !== 'mail' || process.env.NODE_ENV !== 'development') {
  throw new Error('This smoke test requires the isolated taskgenie-local Compose environment');
}
const db = require('./config/db');
async function main() {
  const customer=randomUUID(), provider=randomUUID(), service=randomUUID();
  for (const [id,role] of [[customer,'customer'],[provider,'provider']]) {
    await db.query("INSERT INTO users(id,name,email,password,role,custom_id,lat,lng,location) VALUES($1,'Fixture',$2,'unused',$3,$4,12,77,'Fixture location')",[id,`${id}@example.test`,role,`${role === 'provider' ? 'SRV' : 'CUS'}${id.replaceAll('-','').slice(0,20).toUpperCase()}`]);
  }
  await db.query("INSERT INTO services(id,name,description,price,slug) VALUES($1,'House Cleaning','Synthetic local fixture',1200,$2)",[service,`fixture-${service}`]);
  await db.query("INSERT INTO providers(user_id,status) VALUES($1,'approved')",[provider]);
  await db.query("INSERT INTO provider_services(provider_id,service_id,price) VALUES($1,$2,1200)",[provider,service]);
  for (let day=0;day<7;day++) await db.query("INSERT INTO provider_master_availability(provider_id,day_of_week,start_time,end_time) VALUES($1,$2,'08:00','20:00')",[provider,day]);
  const token=jwt.sign({id:customer,role:'customer'},process.env.JWT_SECRET,{expiresIn:'5m'});
  const headers={'content-type':'application/json',authorization:`Bearer ${token}`};
  let response=await fetch('http://client/api/bookings',{method:'POST',headers,body:JSON.stringify({provider_id:provider,service_id:service,date:'2040-01-02',start_time:'10:00',address:'Synthetic local address',payment_method:'cod',latitude:12,longitude:77})});
  const result=await response.json();
  if(response.status!==201) throw new Error(`Booking failed ${response.status}: ${JSON.stringify(result)}`);
  const id=result.booking.booking_id;
  console.log('Booking through Nginx: 201');
  response=await fetch(`http://client/api/bookings/${id}/status`,{method:'PUT',headers,body:JSON.stringify({status:'cancelled'})});
  if(response.status!==200) throw new Error(`Cancellation failed ${response.status}: ${await response.text()}`);
  console.log('Cancellation through Nginx: 200');
  for(let i=0;i<40;i++) {
    const jobs=await db.query("SELECT status,count(*)::int AS n FROM notification_outbox WHERE payload->>'message' LIKE $1 GROUP BY status",[`%${id}%`]);
    if(jobs.rows.some(row=>row.status==='completed' && row.n===2)) { console.log('Booking email outbox: 2 completed'); break; }
    if(i===39) throw new Error(`Outbox did not complete: ${JSON.stringify(jobs.rows)}`);
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  const mail=await fetch('http://mail:8025/api/v1/messages').then(r=>r.json());
  if(mail.total < 2) throw new Error('Mailpit did not receive both messages');
  console.log(`Mailpit messages captured: ${mail.total}`);
  const saved=await db.query('SELECT status FROM bookings WHERE booking_id=$1',[id]);
  console.log('Persisted booking status:',saved.rows[0].status);
}
main().catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>db.end());
