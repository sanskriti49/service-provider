import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
const f=JSON.parse(open('./fixture.json'));
const vus=Number(__ENV.VUS||200), waves=Number(__ENV.WAVES||5);
const base=__ENV.BASE_URL||'http://127.0.0.1:3101';
const created=new Counter('created'),conflicts=new Counter('legitimate_conflicts'),errors=new Rate('unexpected_failure_rate'),confirmed=new Counter('confirmed');
const latency=new Trend('attempt_latency',true);
export const options={scenarios:{race:{executor:'per-vu-iterations',vus,iterations:waves,maxDuration:'60s'}},summaryTrendStats:['avg','min','med','p(95)','p(99)','max'],thresholds:{created:[`count==${waves}`],confirmed:[`count==${waves}`],legitimate_conflicts:[`count==${(vus-1)*waves}`],unexpected_failure_rate:['rate==0']}};
export function setup(){return {start:Date.now()+2000}}
export default function(data){
  const wave=exec.vu.iterationInScenario,vu=exec.vu.idInTest-1;
  sleep(Math.max(0,(data.start+wave*2500-Date.now())/1000));
  const p=f.providers[0];
  const date=new Date(Date.UTC(2038,0,1)+Number(__ENV.RUN_DAY||0)*86400000+wave*86400000).toISOString().slice(0,10);
  const headers={'x-test-bypass-ratelimit':'1','Content-Type':'application/json',Authorization:`Bearer ${f.customers[vu]}`};
  const r=http.post(`${base}/api/bookings`,JSON.stringify({provider_id:p.id,service_id:f.service,date,start_time:vu%2?'10:30':'10:00',address:'Synthetic simultaneous booking race',payment_method:'cod',latitude:Number(p.lat),longitude:Number(p.lng)}),{headers,tags:{operation:'conflicting-create'},responseCallback:http.expectedStatuses(201,409)});
  latency.add(r.timings.duration);
  created.add(r.status===201?1:0);conflicts.add(r.status===409?1:0);errors.add(![201,409].includes(r.status));
  check(r,{'created or legitimate booking conflict':r=>[201,409].includes(r.status)});
  if(r.status===201){
    const confirm=http.put(`${base}/api/bookings/${r.json('booking.booking_id')}/status`,JSON.stringify({status:'confirmed'}),{headers:{...headers,Authorization:`Bearer ${f.providerTokens[0]}`},tags:{operation:'confirm-winner'}});
    confirmed.add(confirm.status===200&&confirm.json('booking.status')==='confirmed'?1:0);
    errors.add(confirm.status!==200);
  }
}
export function handleSummary(data){return {[__ENV.SUMMARY||`results/conflicts-${vus}.json`]:JSON.stringify({mode:'conflicts',vus,waves,metrics:data.metrics},null,2)}}
