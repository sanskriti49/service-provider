require('./config.cjs');
const fs=require('node:fs'),path=require('node:path');
const db=require('../../server/config/db');
const mode=process.argv[2]||'baseline';
let captured;
const original=db.query;
db.query=async(sql,params)=>{if(sql.startsWith('SELECT DISTINCT ON'))captured={sql,params};return original(sql,params)};
(async()=>{
  await require('../../server/controllers/providerController').getProviders({query:{service:'bench-cleaning',lat:12.970000123,lng:77.59,radius:50,limit:20,sort_by:'distance'}},{set(){},json(){}},e=>{throw e});
  const client=await db.connect();
  try{
    const normal=(await client.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+captured.sql,captured.params)).rows[0]['QUERY PLAN'];
    await client.query('SET jit=off');
    const withoutJit=(await client.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+captured.sql,captured.params)).rows[0]['QUERY PLAN'];
    fs.writeFileSync(path.join(__dirname,`results/explain-${mode}.json`),JSON.stringify({captured,normal,withoutJit},null,2));
    console.log(JSON.stringify({normalMs:normal[0]['Execution Time'],withoutJitMs:withoutJit[0]['Execution Time'],jit:normal[0].JIT}));
  }finally{client.release()}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await db.end();await require('../../server/config/redisClient').closeRedis()});
