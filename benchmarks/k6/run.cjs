const { serverRequire }=require('./config.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,execFileSync}=require('node:child_process');
const db=require('../../server/config/db');
const root=path.resolve(__dirname,'../..');
const k6=process.env.K6_PATH || path.join(root,'work/tools/k6/k6-v2.3.0-windows-amd64/k6.exe');
const levels=(process.env.LEVELS||'10,50,100,200').split(',').map(Number);
const modes=(process.env.MODES||'discovery-uncached,discovery-cached,availability,booking').split(',');
const prefix=process.env.RESULT_PREFIX||'baseline';
const output=path.join(__dirname,'results',prefix);fs.mkdirSync(output,{recursive:true});
async function run(script,name,env){
  const log=fs.openSync(path.join(output,`${name}.console.txt`),'w');
  const begin=new Date().toISOString();
  await db.query('SELECT pg_stat_statements_reset()');
  const child=spawn(k6,['run','--quiet','--no-usage-report',script],{cwd:__dirname,env:{...process.env,...env,SUMMARY:`results/${prefix}/${name}.json`},stdio:['ignore',log,log]});
  const poolSamples=[];
  const timer=setInterval(async()=>{try{const r=await fetch('http://127.0.0.1:3101/metrics');const raw=await r.text();poolSamples.push({at:new Date().toISOString(),metrics:raw.split('\n').filter(s=>s&&!s.startsWith('#')&&/pool|eventloop_lag_seconds/.test(s))});}catch(_){}},1000);
  const code=await new Promise(resolve=>child.on('exit',resolve));clearInterval(timer);fs.closeSync(log);
  const sql=(await db.query(`SELECT calls,total_exec_time,mean_exec_time,rows,left(query,4000) AS query FROM pg_stat_statements WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database()) ORDER BY total_exec_time DESC LIMIT 15`)).rows;
  fs.writeFileSync(path.join(output,`${name}.diagnostics.json`),JSON.stringify({begin,end:new Date().toISOString(),exitCode:code,sql,poolSamples},null,2));
  const summary=JSON.parse(fs.readFileSync(path.join(output,`${name}.json`),'utf8'));
  const lat=summary.metrics.measured_latency?.values||summary.metrics.attempt_latency?.values;
  console.log(JSON.stringify({name,code,rps:summary.measuredRps,latency:lat,failures:summary.metrics.measured_failure_rate?.values||summary.metrics.unexpected_failure_rate?.values}));
  // A crossed load threshold is a measured capacity limit; retain it and continue.
  if(code!==0) process.exitCode=1;
}
(async()=>{
  let ready;
  for(let attempt=0;attempt<30;attempt++){
    try{ready=await(await fetch('http://127.0.0.1:3101/health/ready',{signal:AbortSignal.timeout(5000)})).json();if(ready.status==='ready')break}catch(_){}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(ready?.status!=='ready')throw Error('Backend not ready after retries');
  fs.writeFileSync(path.join(output,'host.json'),JSON.stringify({date:new Date().toISOString(),platform:os.platform(),release:os.release(),cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,ramBytes:os.totalmem(),node:process.version,k6:execFileSync(k6,['version'],{encoding:'utf8'}).trim(),git:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),conditions:{poolMax:20,postgresCpuLimit:2,postgresRam:'2GiB',redisCpuLimit:1,redisRam:'256MiB',apiProcesses:1,nodeEnv:'test',rateLimitBypass:true,apiNativeWindows:true,k6NativeWindows:true,postgresDocker:true,redisDocker:true,warmupSeconds:Number(process.env.WARMUP||5),measuredSeconds:Number(process.env.DURATION||20),closedLoop:true,thinkTime:0}},null,2));
  for(const mode of modes)for(const vus of levels){
    if(process.env.PRIME_EXPIRY==='true'&&mode==='discovery-cached'){
      const primed=await fetch('http://127.0.0.1:3101/api/providers/v1?service=bench-cleaning&lat=12.97&lng=77.59&radius=50&limit=20&sort_by=distance',{headers:{'x-test-bypass-ratelimit':'1'}});
      if(primed.status!==200)throw Error('Cache priming failed');await primed.text();
      console.log('Cache primed; aging 30 seconds to put the 45-second TTL expiry inside measurement.');
      await new Promise(resolve=>setTimeout(resolve,30000));
    }
    if(mode==='booking'){
      await db.query("DELETE FROM notifications");
      await db.query("DELETE FROM bookings WHERE date>='2040-01-01'");
      await db.query('VACUUM ANALYZE bookings');
    }
    await run('load.js',`${mode}-${vus}`,{MODE:mode,VUS:String(vus)});
  }
  if(process.env.CONFLICTS!=='false')for(const vus of levels){
    const runDay=levels.indexOf(vus)*10;
    const first=new Date(Date.UTC(2038,0,1)+runDay*86400000).toISOString().slice(0,10);
    const last=new Date(Date.UTC(2038,0,1)+(runDay+4)*86400000).toISOString().slice(0,10);
    await db.query('DELETE FROM bookings WHERE date BETWEEN $1 AND $2',[first,last]);
    await run('conflicts.js',`conflicts-${vus}`,{VUS:String(vus),RUN_DAY:String(runDay)});
    const rows=(await db.query(`SELECT date::text,count(*)::int AS total,count(*) FILTER(WHERE status='confirmed')::int AS confirmed FROM bookings WHERE date BETWEEN $1 AND $2 GROUP BY date ORDER BY date`,[first,last])).rows;
    const overlaps=(await db.query(`SELECT count(*)::int AS n FROM bookings a JOIN bookings b ON a.provider_id=b.provider_id AND a.booking_id<b.booking_id AND tsrange(a.date+a.start_time,a.date+a.end_time,'[)')&&tsrange(b.date+b.start_time,b.date+b.end_time,'[)') WHERE (a.status IN ('booked','confirmed','in_progress') OR (a.status='pending' AND a.payment_method='cod')) AND (b.status IN ('booked','confirmed','in_progress') OR (b.status='pending' AND b.payment_method='cod'))`)).rows[0].n;
    fs.writeFileSync(path.join(output,`conflicts-${vus}.database.json`),JSON.stringify({rows,activeOverlapPairs:overlaps},null,2));
    if(rows.length!==5||rows.some(r=>r.total!==1||r.confirmed!==1)||overlaps!==0)throw Error('Concurrency invariant failed');
  }
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.end());
