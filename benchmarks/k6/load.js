import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
const fixture = JSON.parse(open('./fixture.json'));
const mode = __ENV.MODE || 'discovery-uncached';
const vus = Number(__ENV.VUS || 10);
const base = __ENV.BASE_URL || 'http://127.0.0.1:3101';
const warmup = Number(__ENV.WARMUP || 5);
const duration = Number(__ENV.DURATION || 20);
const requestMs = new Trend('measured_latency', true);
const requests = new Counter('measured_requests');
const failures = new Rate('measured_failure_rate');
const serverErrors = new Counter('server_errors');
const invalid = new Counter('invalid_responses');
export const options = {
  scenarios: {load:{executor:'constant-vus',vus,duration:`${warmup+duration}s`,gracefulStop:'15s'}},
  summaryTrendStats:['avg','min','med','p(95)','p(99)','max'],
  thresholds:{measured_failure_rate:['rate==0'],invalid_responses:['count==0'],server_errors:['count==0']},
};
export default function () {
  const vu = exec.vu.idInTest-1;
  const iteration = exec.scenario.iterationInTest;
  const headers = {'x-test-bypass-ratelimit':'1'};
  let r, valid;
  if(mode==='booking') {
    headers.Authorization=`Bearer ${fixture.customers[vu]}`;
    headers['Content-Type']='application/json';
    const provider=fixture.providers[vu];
    // One distinct provider/date per operation: exercises actual inserts, never replay hits.
    const date=new Date(Date.UTC(2040,0,1)+exec.vu.iterationInScenario*86400000).toISOString().slice(0,10);
    r=http.post(`${base}/api/bookings`,JSON.stringify({provider_id:provider.id,service_id:fixture.service,date,start_time:'10:00',address:'Synthetic k6 service address',payment_method:'cod',latitude:Number(provider.lat),longitude:Number(provider.lng)}),{headers,tags:{mode}});
    valid=r.status===201 && r.json('booking.status')==='pending';
  } else {
    // Monotonic unique coordinates defeat the actual 500-entry cache for uncached searches.
    const lat=mode==='discovery-cached'?12.97:12.97+iteration*0.000000001;
    let query=`service=bench-cleaning&lat=${lat}&lng=77.59&radius=50&limit=20&sort_by=distance`;
    if(mode==='availability') query+='&date=2035-01-03&start_time=10:00';
    r=http.get(`${base}/api/providers/v1?${query}`,{headers,tags:{mode}});
    let body; try {body=r.json()}catch(_){body=null}
    valid=r.status===200 && Array.isArray(body) && body.length===20 && body.every(p=>p.is_nearby===true && p.distance_km<=50 && (mode!=='availability'||p.availability_status==='available'));
  }
  check(r,{'expected status and response body':()=>valid});
  const elapsed=exec.instance.currentTestRunDuration;
  if(elapsed>=warmup*1000 && elapsed<(warmup+duration)*1000){requestMs.add(r.timings.duration);requests.add(1);failures.add(!valid);serverErrors.add(r.status>=500?1:0);invalid.add(valid?0:1);}
  if(!valid && __ITER<2) console.error(`${mode}: ${r.status} ${r.body.slice(0,300)}`);
}
export function handleSummary(data) {
  const m=data.metrics;
  const result={mode,vus,warmupSeconds:warmup,nominalMeasuredSeconds:duration,metrics:m,measuredRps:m.measured_requests.values.count/duration};
  return {[__ENV.SUMMARY || `results/${mode}-${vus}.json`]:JSON.stringify(result,null,2)};
}
