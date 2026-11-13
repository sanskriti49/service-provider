const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'results');
const groups=['baseline','controlled-before','controlled-after','after-matrix'];
const rows=[];
for(const group of groups){
  const dir=path.join(root,group);if(!fs.existsSync(dir))continue;
  for(const file of fs.readdirSync(dir).filter(f=>/^(discovery|availability|booking|conflicts)-\w.*\.json$/.test(f)&&!f.includes('.diagnostics.')&&!f.includes('.database.'))){
    const s=JSON.parse(fs.readFileSync(path.join(dir,file))),m=s.metrics;
    const v=n=>m[n]?.values;
    const lat=v('measured_latency')||v('attempt_latency');
    rows.push({group,test:s.mode,vus:s.vus,measuredRequests:v('measured_requests')?.count??null,rps:s.measuredRps??v('http_reqs')?.rate,
      p50:lat.med,p95:lat['p(95)'],p99:lat['p(99)'],failureRate:(v('measured_failure_rate')||v('unexpected_failure_rate')).rate,
      serverErrors:v('server_errors')?.count??null,created:v('created')?.count??null,conflicts:v('legitimate_conflicts')?.count??null,confirmed:v('confirmed')?.count??null,
      k6ThresholdsPassed:Object.values(m).every(x=>!x.thresholds||Object.values(x.thresholds).every(t=>t.ok))});
  }
}
rows.sort((a,b)=>groups.indexOf(a.group)-groups.indexOf(b.group)||a.test.localeCompare(b.test)||a.vus-b.vus);
fs.writeFileSync(path.join(root,'summary.json'),JSON.stringify(rows,null,2));
const n=x=>x==null?'--':x.toFixed(2),pct=x=>(x*100).toFixed(2)+'%';
let md='# Actual k6 results\n\nGenerated from retained k6 summaries; latency in milliseconds. RPS is completions in the fixed 20-second measured window divided by 20. Failures are unexpected statuses/invalid bodies; expected booking HTTP 409 responses are separate.\n\n';
md+='| Run | Workload | VUs | Measured requests | RPS | p50 | p95 | p99 | Failure rate | Server errors |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n';
for(const r of rows.filter(x=>x.test!=='conflicts'))md+=`| ${r.group} | ${r.test} | ${r.vus} | ${r.measuredRequests} | ${n(r.rps)} | ${n(r.p50)} | ${n(r.p95)} | ${n(r.p99)} | ${pct(r.failureRate)} | ${r.serverErrors} |\n`;
md+='\n## Simultaneous conflicting reservations\n\nFive timed waves per level, one attempt per VU per wave. k6 HTTP RPS includes deliberate pacing and the five winner-confirmation requests, so it is not a sustained capacity measure. Latencies below cover the creation attempts only.\n\n| VUs per wave | Attempts | Created | HTTP 409 conflicts | Confirmed winners | k6 HTTP RPS (paced) | Unexpected failures | p50 ms | p95 ms | p99 ms | Active overlaps in DB |\n|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
for(const r of rows.filter(x=>x.test==='conflicts')){
  const d=JSON.parse(fs.readFileSync(path.join(root,r.group,`conflicts-${r.vus}.database.json`)));
  md+=`| ${r.vus} | ${r.vus*5} | ${r.created} | ${r.conflicts} | ${r.confirmed} | ${n(r.rps)} | ${pct(r.failureRate)} | ${n(r.p50)} | ${n(r.p95)} | ${n(r.p99)} | ${d.activeOverlapPairs} |\n`;
}
md+='\n## Interpretation\n\nThe baseline survey exposed uncached/availability saturation and hot-cache expiry failures; failed runs are retained. The controlled comparison restarts the API, primes the same query, ages its 45-second cache for 30 seconds, and runs the same 200-VU script (5-second warm-up, 20-second measurement). Both use the same database, dataset, resource limits and pool. The change shares one database fill among identical undated requests. It does not improve the number of rows processed by distinct uncached requests, distributed cache invalidation, or multi-process coordination.\n\nThe final resume rounds 855.70 RPS to 856 and p95 288.667805 ms to 289 ms, explicitly stating local k6 users and synthetic providers. The 82 ms historical claim is not reused. `smoke/` is an intentionally retained failed harness check against an incorrect URL; `smoke-corrected/` validated the actual `/api/providers/v1` route. Smoke results do not support resume metrics.\n';
fs.writeFileSync(path.join(root,'RESULTS.md'),md);
console.log(`Summarized ${rows.length} k6 runs`);
