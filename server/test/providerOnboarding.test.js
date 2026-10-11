const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

function fixture(knownService=true) {
	const queries=[];
	const client={ query:async(sql,params=[])=>{
		queries.push({sql,params});
		if(sql.includes("SELECT id FROM services")) return {rows:knownService?[{id:"33333333-3333-4333-8333-333333333333"}]:[]};
		if(sql.includes("INSERT INTO users")) return {rows:[{id:"11111111-1111-4111-8111-111111111111"}]};
		return {rows:[]};
	},release:()=>queries.push({sql:"release"})};
	const filename=path.resolve(__dirname,"../controllers/providerController.js"),instance=new Module(filename,module);
	instance.filename=filename;instance.paths=Module._nodeModulePaths(path.dirname(filename));const original=instance.require.bind(instance);
	const stubs={"../config/db":{connect:async()=>client},"../utils/cache":{delPattern:()=>{}}};
	instance.require=(id)=>Object.hasOwn(stubs,id)?stubs[id]:original(id);
	instance._compile(fs.readFileSync(filename,"utf8"),filename);
	return {controller:instance.exports,queries};
}
const request=()=>({body:{name:"Test Provider",email:"provider@example.com",password:"safe-password",service:"cleaning",availability:[],kyc_doc_front:null,kyc_doc_back:null}});
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;}});
test("onboarding accepts the UI password contract and requires a password",async()=>{
	const {controller,queries}=fixture(),res=response();
	await controller.createProvider(request(),res,(error)=>{throw error;});
	assert.equal(res.statusCode,201,JSON.stringify(res.data));
	assert.match(queries.find((q)=>q.sql.includes("INSERT INTO users")).params[4],/^\$2/);
	const noPassword=request();delete noPassword.body.password;
	assert.ok(controller.providerSchema.validate(noPassword.body).error);
});
test("unknown onboarding service rolls back before releasing the transaction",async()=>{
	const {controller,queries}=fixture(false),res=response();
	await controller.createProvider(request(),res,(error)=>{throw error;});
	assert.equal(res.statusCode,400);
	assert.deepEqual(queries.filter((q)=>["BEGIN","ROLLBACK","COMMIT","release"].includes(q.sql)).map((q)=>q.sql),["BEGIN","ROLLBACK","release"]);
});
