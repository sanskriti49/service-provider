const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

function fixture(knownService=true, storage={documentExists:async()=>true}) {
	const queries=[];
	const client={ query:async(sql,params=[])=>{
		queries.push({sql,params});
		if(sql.includes("SELECT id FROM services")) return {rows:knownService?[{id:"33333333-3333-4333-8333-333333333333"}]:[]};
		if(sql.includes("UPDATE users SET")) return {rows:[{id:"11111111-1111-4111-8111-111111111111",custom_id:"SRVEXAMPLE12345"}]};
		return {rows:[]};
	},release:()=>queries.push({sql:"release"})};
	const filename=path.resolve(__dirname,"../controllers/providerController.js"),instance=new Module(filename,module);
	instance.filename=filename;instance.paths=Module._nodeModulePaths(path.dirname(filename));const original=instance.require.bind(instance);
	const stubs={"../config/db":{connect:async()=>client},"../utils/cache":{delPattern:()=>{}},"../services/kycStorage":storage};
	instance.require=(id)=>Object.hasOwn(stubs,id)?stubs[id]:original(id);
	instance._compile(fs.readFileSync(filename,"utf8"),filename);
	return {controller:instance.exports,queries};
}

test('disabled KYC storage returns an actionable error without a document reference', async()=>{
	const disabled=Object.assign(new Error('disabled'),{code:'KYC_STORAGE_DISABLED'});
	const storage={validateDocument:()=>{},storeDocument:async()=>{throw disabled;}};
	const {controller}=fixture(true,storage),res=response();
	await controller.uploadKycDocument({user:{role:'provider',id:'11111111-1111-4111-8111-111111111111'},file:{buffer:Buffer.from('%PDF-fixture'),mimetype:'application/pdf'}},res);
	assert.equal(res.statusCode,503);
	assert.match(res.data.error,/currently unavailable.*contact support/i);
	assert.equal(res.data.url,undefined);
});
const request=()=>({user:{id:"11111111-1111-4111-8111-111111111111",role:"provider"},body:{name:"Test Provider",email:"provider@example.com",service:"cleaning",lat:0,lng:0,availability:[],kyc_doc_type:'certificate',kyc_doc_number:'TEST1234',kyc_doc_front:'private-reference',kyc_declaration:true}});
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;}});
test("onboarding requires an authenticated provider and a submitted private document",async()=>{
	const {controller,queries}=fixture(),res=response();
	await controller.createProvider(request(),res,(error)=>{throw error;});
	assert.equal(res.statusCode,201,JSON.stringify(res.data));
	assert.equal(queries.find((q)=>q.sql.includes("UPDATE users SET")).params[0],request().user.id);
	const missingDoc=request();delete missingDoc.body.kyc_doc_front;
	assert.ok(controller.providerSchema.validate(missingDoc.body).error);
	const guest=request();delete guest.user;const denied=response();await controller.createProvider(guest,denied,e=>{throw e;});assert.equal(denied.statusCode,403);
	const noCoordinates=request();delete noCoordinates.body.lat;delete noCoordinates.body.lng;
	assert.ok(controller.providerSchema.validate(noCoordinates.body).error);
});
test("unknown onboarding service rolls back before releasing the transaction",async()=>{
	const {controller,queries}=fixture(false),res=response();
	await controller.createProvider(request(),res,(error)=>{throw error;});
	assert.equal(res.statusCode,400);
	assert.deepEqual(queries.filter((q)=>["BEGIN","ROLLBACK","COMMIT","release"].includes(q.sql)).map((q)=>q.sql),["BEGIN","ROLLBACK","release"]);
});

test("onboarding preserves zero service-base coordinates and validates their pair and range",async()=>{
	const {controller,queries}=fixture(),req=request();req.body.lat=0;req.body.lng=0;const res=response();await controller.createProvider(req,res,e=>{throw e;});assert.equal(res.statusCode,201);
	const insert=queries.find(q=>q.sql.includes("UPDATE users SET"));assert.equal(insert.params[4],0);assert.equal(insert.params[5],0);
	for(const pair of [{lat:null,lng:null},{lat:91,lng:0},{lat:0,lng:181}])assert.ok(controller.providerSchema.validate({...request().body,...pair}).error);
});
