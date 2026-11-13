require('./config.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const db=require('../../server/config/db');
const root=path.resolve(__dirname,'../..'),results=path.join(__dirname,'results');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
  const counts=(await db.query(`SELECT count(*) FILTER(WHERE date>='2040-01-01')::int AS new_cod,
    count(*) FILTER(WHERE date BETWEEN '2038-01-01' AND '2038-12-31' AND status='confirmed')::int AS contention_confirmed FROM bookings`)).rows[0];
  const run=JSON.parse(fs.readFileSync(path.join(results,'baseline/booking-200.json')));
  const state={...counts,lastBookingRunHttpRequests:run.metrics.http_reqs.values.count,allBookingInsertsPersisted:counts.new_cod===run.metrics.http_reqs.values.count};
  if(!state.allBookingInsertsPersisted||counts.contention_confirmed!==20)throw Error('Final fixture state does not match k6 runs');
  fs.writeFileSync(path.join(results,'final-database.json'),JSON.stringify(state,null,2));
  const tap=fs.readFileSync(path.join(results,'all-server.tap'),'utf8');
  if(!/^# pass 178$/m.test(tap)||!/^# fail 0$/m.test(tap)||!/^# skipped 0$/m.test(tap))throw Error('Server test evidence failed');
  const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)]);
  const files=walk(results).filter(p=>!p.endsWith('manifest.json')).sort();
  const manifest={createdAt:new Date().toISOString(),revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    originalControllerSha256:sha(path.join(results,'providerController.before.js')),
    optimizedControllerSha256:sha(path.join(root,'server/controllers/providerController.js')),
    dockerImageIds:execFileSync('docker',['inspect','--format','{{.Name}} {{.Image}}','taskgenie-k6-postgres','taskgenie-k6-redis'],{encoding:'utf8'}).trim().split(/\r?\n/),
    evidence:files.map(p=>({file:path.relative(root,p).replaceAll('\\','/'),sha256:sha(p)})),
    currentSource:['server/controllers/providerController.js','server/test/providerMatching.test.js','benchmarks/k6/load.js','benchmarks/k6/conflicts.js','benchmarks/k6/run.cjs'].map(p=>({file:p,sha256:sha(path.join(root,p))}))};
  fs.writeFileSync(path.join(results,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log(JSON.stringify(state));console.log(`Hashed ${files.length} evidence files`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.end());
