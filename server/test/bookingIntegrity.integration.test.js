const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, createHmac } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

function load(filename, stubs) {
	const target = path.resolve(__dirname, filename), instance = new Module(target, module);
	instance.filename = target; instance.paths = Module._nodeModulePaths(path.dirname(target));
	const original = instance.require.bind(instance);
	instance.require = (name) => Object.hasOwn(stubs, name) ? stubs[name] : original(name);
	instance._compile(fs.readFileSync(target, "utf8"), target);
	return instance.exports;
}
const response = () => ({ statusCode: 200, status(n) { this.statusCode=n; return this; }, json(data) { this.data=data; return this; } });
const url = process.env.BOOKING_TEST_DATABASE_URL;
test("booking integrity: actual controllers, PostgreSQL constraints, concurrent captures and refund recovery", { skip: !url, timeout: 120000 }, async (t) => {
	const { Pool } = require("pg");
	const admin = new Pool({ connectionString: url });
	const schema = `booking_test_${randomUUID().replaceAll("-", "")}`;
	await admin.query(`CREATE SCHEMA ${schema}`);
	const pool = new Pool({ connectionString: url, options: `-c search_path=${schema},public` });
	t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); });
	const stubDb = { query: (...args) => pool.query(...args), connect: () => pool.connect() };
	const ddl = load("../migrations/create_tables.js", { "../config/db": stubDb }).queries;
	for (const table of ["users", "services", "providers", "provider_services", "availability_slots", "bookings", "provider_master_availability", "provider_date_exceptions", "reviews"]) {
		await pool.query(ddl.find((query) => query.startsWith(`CREATE TABLE IF NOT EXISTS public.${table} (`)).replaceAll("public.", `${schema}.`));
	}
	await pool.query("ALTER TABLE providers ADD COLUMN status text NOT NULL DEFAULT 'pending'");
	const migration = fs.readFileSync(path.join(__dirname, "../migrations/20261011_booking_integrity.sql"), "utf8").replaceAll("public.", `${schema}.`);
	await pool.query(migration); await pool.query(migration);
	await pool.query("CREATE FUNCTION fixture_coordinate_sync() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$");
	await pool.query("CREATE TRIGGER fixture_user_sync BEFORE INSERT OR UPDATE OF lat,lng ON users FOR EACH ROW EXECUTE FUNCTION fixture_coordinate_sync()");
	await pool.query("CREATE TRIGGER fixture_booking_sync BEFORE UPDATE OF latitude,longitude ON bookings FOR EACH ROW EXECUTE FUNCTION fixture_coordinate_sync()");
	await pool.query("ALTER TABLE bookings DISABLE TRIGGER fixture_booking_sync");
	const triggerDefinitions=(await pool.query("SELECT tgname,tgenabled,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgname IN ('fixture_user_sync','fixture_booking_sync') ORDER BY tgname")).rows;
	const locationMigration = fs.readFileSync(path.join(__dirname,"../migrations/20261014_booking_search_radius.sql"),"utf8").replaceAll("public.",`${schema}.`);
	await pool.query(locationMigration); await pool.query(locationMigration);
	assert.deepEqual((await pool.query("SELECT tgname,tgenabled,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgname IN ('fixture_user_sync','fixture_booking_sync') ORDER BY tgname")).rows,triggerDefinitions);
	const customer=randomUUID(), other=randomUUID(), provider=randomUUID(), service=randomUUID();
	for (const [id,role] of [[customer,"customer"],[other,"customer"],[provider,"provider"]]) await pool.query("INSERT INTO users(id,name,email,password,role,custom_id,lat,lng) VALUES($1,'Test',$2,'unused',$3,$4,12,77)", [id,`${id}@example.com`,role,`${role === "provider" ? "SRV" : "CUS"}${id.replaceAll("-", "").slice(0,20).toUpperCase()}`]);
	await pool.query("UPDATE users SET location='Confirmed fixture base' WHERE id=$1",[provider]);
	await pool.query("CREATE TABLE user_addresses(id serial PRIMARY KEY,user_id uuid REFERENCES users(id),full_address text,lat double precision,lng double precision,updated_at timestamptz DEFAULT NOW())");
	await pool.query("INSERT INTO services(id,name,description,price,slug) VALUES($1,'House Cleaning','Test',1200,'cleaning')", [service]);
	await pool.query("INSERT INTO providers(user_id,status) VALUES($1,'approved')", [provider]);
	await pool.query("INSERT INTO provider_services(provider_id,service_id,price) VALUES($1,$2,1200)", [provider,service]);
	for(let day=0;day<7;day++) await pool.query("INSERT INTO provider_master_availability(provider_id,day_of_week,start_time,end_time) VALUES($1,$2,'08:00','20:00')", [provider,day]);
	process.env.RAZORPAY_KEY_ID="rzp_live_testfixture"; process.env.RAZORPAY_KEY_SECRET="isolated-secret"; process.env.RAZORPAY_WEBHOOK_SECRET="isolated-webhook";
	const payments=new Map(), refunds=[], notices=[]; let orderSequence=0, refundCalls=0, loseRefundResponse=false;
	const gateway = { orders: {
		create: async (options) => ({...options,id:`order_${++orderSequence}`}),
		fetchPayments: async (id) => ({items:[...payments.values()].filter((p)=>p.order_id===id)}),
	}, payments: {
		fetch: async(id) => { if(!payments.has(id)) throw new Error("Unknown fixture payment"); return payments.get(id); },
		fetchMultipleRefund: async(id,{skip=0,count=100}={}) => ({items:refunds.filter((r)=>r.payment_id===id).slice(skip,skip+count)}),
		refund: async(id,input) => { refundCalls++; const result={id:`rfnd_${refundCalls}`,payment_id:id,amount:input.amount,receipt:input.receipt,status:"processed"}; refunds.push(result); if(loseRefundResponse) {loseRefundResponse=false;throw new Error("Lost gateway response");} return result; },
	}, refunds: { fetch: async(id)=>refunds.find((r)=>r.id===id) } };
	const schedule=load("../services/bookingSchedule.js", {"../utils/geoUtils":{...require("../utils/geoUtils"),getDirectionalTravelDurations:async(origin,destinations)=>({to:destinations.map(()=>5),from:destinations.map(()=>7)})}});
	const payment=load("../services/paymentService.js", {"./bookingSchedule":schedule});
	const controller=load("../controllers/bookingController.js", { "../services/paymentService":payment,"../services/bookingSchedule":schedule, "../config/db":stubDb, razorpay:class {constructor(){Object.assign(this,gateway);}}, "../utils/eventQueue":{publish:()=>{}}, "../utils/sendEmail":async()=>{}, "../utils/notificationService":{sendNotification:async(input)=>notices.push(input)}, "../utils/distributedLock":{acquireLock:async()=>({acquired:true}),releaseLock:async()=>{}}, "../utils/circuitBreaker":{createProtectedBreaker:(action)=>({fire:action})} });
	const actor = {id:customer,role:"customer"};
	const book = async (start="10:00", method="online", extra={}) => { const res=response(); await controller.createBooking({user:actor,body:{provider_id:provider,service_id:service,date:"2040-01-02",start_time:start,address:"Test service address",payment_method:method,latitude:12,longitude:77,...extra}},res); return res; };
	const capture = (booking,id=`pay_${randomUUID().replaceAll("-", "")}`) => {const payment={id,order_id:booking.razorpay_order_id,amount:120000,currency:"INR",status:"captured",captured:true};payments.set(id,payment);return payment;};
	await t.test("customer coordinates, default/expanded radius and address edits survive actual PostgreSQL storage",async()=>{
		const missing=await book("10:00","cod",{date:"2040-04-01",latitude:null,longitude:null});assert.equal(missing.statusCode,400);
		const far=await book("10:00","cod",{date:"2040-04-01",latitude:12.05,longitude:77.7});assert.equal(far.statusCode,409);assert.match(far.data.message,/50 km/);
		const created=await book("10:00","cod",{date:"2040-04-01",latitude:12.05,longitude:77.7,radius:100});assert.equal(created.statusCode,201,JSON.stringify(created.data));
		const b=(await pool.query("SELECT * FROM bookings WHERE booking_id=$1",[created.data.booking.booking_id])).rows[0];
		assert.equal(b.search_radius_km,100);assert.equal(b.latitude,12.05);assert.equal(b.longitude,77.7);
		assert.notEqual(b.latitude,12);assert.notEqual(b.longitude,77);
		const denied=response();await controller.updateBookingAddress({user:actor,params:{booking_id:b.booking_id},body:{address:"Customer moved outside radius",latitude:12,longitude:79}},denied);assert.equal(denied.statusCode,409);
		assert.equal((await pool.query("SELECT address FROM bookings WHERE booking_id=$1",[b.booking_id])).rows[0].address,b.address);
		const changed=response();await controller.updateBookingAddress({user:actor,params:{booking_id:b.booking_id},body:{address:"Confirmed customer address",latitude:12.06,longitude:77.71}},changed);assert.equal(changed.statusCode,200,JSON.stringify(changed.data));
	});
	await t.test("a just-inside-radius customer point retains precision through persistence and payment finalization",async()=>{
		const latitude=12+(0.9999999/6371.00877141506)*(180/Math.PI),longitude=77;
		const created=await book("10:00","online",{date:"2040-04-05",latitude,longitude,radius:1});assert.equal(created.statusCode,201,JSON.stringify(created.data));
		const b=(await pool.query("SELECT * FROM bookings WHERE booking_id=$1",[created.data.booking.booking_id])).rows[0];
		assert.equal(b.latitude,latitude);assert.equal(b.longitude,longitude);assert.equal(b.search_radius_km,1);
		const result=await controller.paymentService.finalize(b.razorpay_order_id,capture(b),actor);assert.equal(result.late,false);assert.equal(result.booking.status,"booked");
	});
	await t.test("legacy missing locations block travel and require owner confirmation of the unchanged address",async()=>{
		const b=(await book("10:00","cod",{date:"2040-04-02"})).data.booking;
		await pool.query("UPDATE bookings SET latitude=NULL,longitude=NULL,created_at=NOW()-INTERVAL '1 hour' WHERE booking_id=$1",[b.booking_id]);
		await assert.rejects(schedule.getAvailability(stubDb,{provider_id:provider,service_id:service,latitude:12,longitude:77,from:"2040-04-02",days:1}),{status:409});
		assert.equal((await book("16:00","cod",{date:"2040-04-02"})).statusCode,409);
		for(const [user,body,status] of [[{id:other,role:"customer"},{address:b.address,confirm_location:true},403],[actor,{address:"Moved elsewhere",confirm_location:true},409],[actor,{address:b.address},409]]) {
			const res=response();await controller.updateBookingAddress({user,params:{booking_id:b.booking_id},body:{...body,latitude:12.01,longitude:77.01}},res);assert.equal(res.statusCode,status);
		}
		const repaired=response();await controller.updateBookingAddress({user:actor,params:{booking_id:b.booking_id},body:{address:b.address,latitude:12.01,longitude:77.01,confirm_location:true}},repaired);assert.equal(repaired.statusCode,200,JSON.stringify(repaired.data));
		const days=await schedule.getAvailability(stubDb,{provider_id:provider,service_id:service,latitude:12,longitude:77,from:"2040-04-02",days:1});assert.ok(days[0].free_slots.length>0);
		for(const slot of days[0].free_slots)await schedule.validateSchedule(stubDb,{provider_id:provider,service_id:service,date:"2040-04-02",start_time:slot.start,latitude:12,longitude:77});
	});
	await t.test("confirmed batch repairs validate all jobs together and roll back stale or unsafe input",async()=>{
		const jobs=[(await book("10:00","cod",{date:"2040-04-03"})).data.booking,(await book("16:00","cod",{date:"2040-04-03"})).data.booking];
		await pool.query("UPDATE bookings SET latitude=NULL,longitude=NULL WHERE booking_id=ANY($1::uuid[])",[jobs.map(b=>b.booking_id)]);
		const {repairLocations}=require("../scripts/locationIntegrity");
		const manifest=jobs.map(b=>({kind:"booking",id:b.booking_id,expected_address:b.address,latitude:12,longitude:77,confirmed:true}));
		await assert.rejects(repairLocations(stubDb,[manifest[0],{...manifest[1],expected_address:"Stale address"}],schedule,{delPattern:()=>{}}),{status:409});
		assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM bookings WHERE booking_id=ANY($1::uuid[]) AND latitude IS NULL",[jobs.map(b=>b.booking_id)])).rows[0].count,2);
		assert.equal((await repairLocations(stubDb,manifest,schedule,{delPattern:()=>{}})).repaired.length,2);
	});
	await t.test("captured payment with an unconfirmed legacy location is recorded and refunded rather than activating",async()=>{
		const b=(await book("10:00","online",{date:"2040-04-04"})).data.booking;
		await pool.query("UPDATE bookings SET latitude=NULL,longitude=NULL WHERE booking_id=$1",[b.booking_id]);
		const result=await controller.paymentService.finalize(b.razorpay_order_id,capture(b),actor);
		assert.equal(result.late,true);assert.equal(result.booking.status,"expired");assert.equal(result.booking.payment_status,"refund_pending");
		assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM booking_refunds WHERE booking_id=$1",[b.booking_id])).rows[0].count,1);
	});
	await t.test("location audit is read-only and confirmed saved/provider repairs preserve labels and recheck booked jobs",async()=>{
		const {auditLocations,repairLocations}=require("../scripts/locationIntegrity");
		const a=(await pool.query("INSERT INTO user_addresses(user_id,full_address) VALUES($1,'Unchanged fixture saved address') RETURNING id",[customer])).rows[0];
		const audit=await auditLocations(stubDb);assert.ok(audit.issues.some(r=>r.kind==="address"&&r.id===String(a.id)));assert.ok(!JSON.stringify(audit).includes("Unchanged fixture saved address"));
		await repairLocations(stubDb,[{kind:"address",id:String(a.id),expected_address:"Unchanged fixture saved address",latitude:0,longitude:0,confirmed:true}],schedule,{delPattern:()=>{}});
		assert.deepEqual((await pool.query("SELECT full_address,lat,lng FROM user_addresses WHERE id=$1",[a.id])).rows[0],{full_address:"Unchanged fixture saved address",lat:0,lng:0});
		const base={kind:"provider",id:provider,expected_address:"Confirmed fixture base",latitude:14,longitude:79,confirmed:true};
		await assert.rejects(repairLocations(stubDb,[base],schedule,{delPattern:()=>{}}),{status:409});
		assert.equal((await pool.query("SELECT lat FROM users WHERE id=$1",[provider])).rows[0].lat,12);
		await repairLocations(stubDb,[{...base,latitude:12.001,longitude:77.001}],schedule,{delPattern:()=>{}});
		assert.equal((await pool.query("SELECT location FROM users WHERE id=$1",[provider])).rows[0].location,base.expected_address);
	});
	await t.test("forged prefixes/signatures and unbound booking IDs cannot mark paid", async()=>{
		const created=await book(); assert.equal(created.statusCode,201,JSON.stringify(created.data)); const b=created.data.booking;
		const res=response(); await controller.verifyPayment({user:actor,body:{razorpay_order_id:"test_order_fake",razorpay_payment_id:"pay_fake",razorpay_signature:"fake",booking_id:b.booking_id}},res); assert.equal(res.statusCode,400);
		const payment=capture(b);const sig=createHmac("sha256",process.env.RAZORPAY_KEY_SECRET).update(`${payment.order_id}|${payment.id}`).digest("hex");
		const denied=response(); await controller.verifyPayment({user:{id:other,role:"customer"},body:{razorpay_order_id:payment.order_id,razorpay_payment_id:payment.id,razorpay_signature:sig}},denied);assert.equal(denied.statusCode,403);
		await controller.cancelUnpaidBooking({user:actor,params:{booking_id:b.booking_id}},response());
	});
	await t.test("expired hold replacement survives concurrent callback/webhook finalization",async()=>{
		const a=(await book()).data.booking; await pool.query("UPDATE bookings SET hold_expires_at=NOW()-INTERVAL '1 minute' WHERE booking_id=$1",[a.booking_id]);
		const replacement=await book("10:00","cod");assert.equal(replacement.statusCode,201,JSON.stringify(replacement.data));
		const payment=capture(a);const outcomes=await Promise.all([controller.paymentService.finalize(payment.order_id,payment,actor),controller.paymentService.finalize(payment.order_id,payment)]);
		assert.equal(outcomes.filter((r)=>r.duplicate).length,1);
		const saved=(await pool.query("SELECT * FROM bookings WHERE booking_id=$1",[a.booking_id])).rows[0];assert.equal(saved.status,"expired");assert.equal(saved.payment_status,"refund_pending");
		assert.equal((await pool.query("SELECT * FROM booking_refunds WHERE booking_id=$1",[a.booking_id])).rows.length,1);
	});
	await t.test("valid concurrent captures activate once; mismatch cannot change financial state",async()=>{
		const created=await book("16:00");assert.equal(created.statusCode,201,JSON.stringify(created.data));const b=created.data.booking,payment=capture(b);
		await assert.rejects(controller.paymentService.finalize(payment.order_id,{...payment,amount:1},actor),{status:409});
		const result=await Promise.all([controller.paymentService.finalize(payment.order_id,payment,actor),controller.paymentService.finalize(payment.order_id,payment)]);
		assert.equal(result.filter((r)=>!r.duplicate).length,1);
	});
	await t.test("address IDOR, terminal resurrection, and admin/provider OTP disclosures are rejected",async()=>{
		const b=(await pool.query("SELECT * FROM bookings WHERE status='booked' LIMIT 1")).rows[0];
		const denied=response();await controller.updateBookingAddress({user:{id:other,role:"customer"},params:{booking_id:b.booking_id},body:{address:"Attacker address",latitude:12,longitude:77}},denied);assert.equal(denied.statusCode,403);
		const moved=response();await controller.updateBookingAddress({user:actor,params:{booking_id:b.booking_id},body:{address:"Customer's corrected address",latitude:12,longitude:77}},moved);assert.equal(moved.statusCode,200);
		const cancelled=response();await controller.updateBookingStatus({user:actor,params:{booking_id:b.booking_id},body:{status:"cancelled"}},cancelled);assert.equal(cancelled.statusCode,200,JSON.stringify(cancelled.data));assert.equal(cancelled.data.booking.payment_status,"refund_pending");
		const revived=response();await controller.updateBookingStatus({user:{id:provider,role:"provider"},params:{booking_id:b.booking_id},body:{status:"confirmed"}},revived);assert.equal(revived.statusCode,409);
		const {serializeBooking}=require("../utils/bookingLifecycle");for(const user of [{id:provider,role:"provider"},{id:randomUUID(),role:"admin"}])assert.equal(serializeBooking(b,user).otp,undefined);
	});
	await t.test("refund submission with lost response reconciles without double refund",async()=>{
		const intent=(await pool.query("SELECT * FROM booking_refunds ORDER BY created_at LIMIT 1")).rows[0];loseRefundResponse=true;
		await assert.rejects(controller.paymentService.reconcileRefund(intent.id));assert.equal(refundCalls,1);
		await controller.paymentService.reconcileRefund(intent.id);assert.equal(refundCalls,1);
		assert.equal((await pool.query("SELECT payment_status FROM bookings WHERE booking_id=$1",[intent.booking_id])).rows[0].payment_status,"refunded");
	});
	await t.test("database rejects duplicate payment, invalid states/times and overlapping active bookings",async()=>{
		const b=(await pool.query("SELECT * FROM bookings WHERE payment_method='cod' LIMIT 1")).rows[0];
		await assert.rejects(pool.query("UPDATE bookings SET end_time=start_time WHERE booking_id=$1",[b.booking_id]),{code:"23514"});
		await assert.rejects(pool.query("UPDATE bookings SET status='invented' WHERE booking_id=$1",[b.booking_id]),{code:"23514"});
		const existing=(await pool.query("SELECT razorpay_payment_id FROM bookings WHERE razorpay_payment_id IS NOT NULL LIMIT 1")).rows[0];
		await assert.rejects(pool.query("UPDATE bookings SET razorpay_payment_id=$1 WHERE booking_id=$2",[existing.razorpay_payment_id,b.booking_id]),{code:"23505"});
		await assert.rejects(pool.query("INSERT INTO bookings(booking_id,provider_id,user_id,service_id,date,start_time,end_time,status,price,payment_method) VALUES($1,$2,$3,$4,'2040-01-02','10:00','11:00','booked',100,'cod')",[randomUUID(),provider,customer,service]),{code:"23P01"});
	});
	await t.test("simultaneous COD bookings allocate only one interval",async()=>{
		const result=await Promise.all([book("10:00","cod",{date:"2040-01-03"}),book("10:00","cod",{date:"2040-01-03"})]);assert.deepEqual(result.map((r)=>r.statusCode).sort(),[201,409]);
	});
	await t.test("server rejects unavailable providers, hidden services and out-of-hours slots",async()=>{
		assert.equal((await book("03:00")).statusCode,409);
		assert.equal((await book("12:00","invented")).statusCode,400);
		await pool.query("UPDATE providers SET status='suspended' WHERE user_id=$1",[provider]);assert.equal((await book("12:00")).statusCode,409);
		await pool.query("UPDATE providers SET status='approved' WHERE user_id=$1",[provider]);
		await pool.query("UPDATE provider_services SET is_visible=FALSE WHERE provider_id=$1",[provider]);assert.equal((await book("12:00")).statusCode,409);
		await pool.query("UPDATE provider_services SET is_visible=TRUE WHERE provider_id=$1",[provider]);
		const created=await book("12:00","cod",{date:"2040-01-04",end_time:"12:01",price:1});assert.equal(created.statusCode,201);assert.equal(Number(created.data.booking.price),1200);assert.notEqual(created.data.booking.end_time,"12:01:00");
	});
	await t.test("webhooks require raw-body signatures; replay cannot resurrect refunded booking",async()=>{
		const b=(await pool.query("SELECT * FROM bookings WHERE payment_status='refunded' LIMIT 1")).rows[0];
		const payment=payments.get(b.razorpay_payment_id);payment.status="refunded";
		const body={event:"payment.captured",payload:{payment:{entity:{id:payment.id}}}},rawBody=Buffer.from(JSON.stringify(body));
		const bad=response();await controller.handleRazorpayWebhook({body,rawBody,headers:{"x-razorpay-signature":"mock"}},bad);assert.equal(bad.statusCode,400);
		const good=response();await controller.handleRazorpayWebhook({body,rawBody,headers:{"x-razorpay-signature":createHmac("sha256",process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex")}},good);assert.equal(good.statusCode,200);
		const saved=(await pool.query("SELECT status,payment_status FROM bookings WHERE booking_id=$1",[b.booking_id])).rows[0];assert.equal(saved.status,b.status);assert.equal(saved.payment_status,"refunded");
	});
	await t.test("pending and failed refunds never claim refunded; concurrent workers submit once",async()=>{
		const intent=(await pool.query("SELECT * FROM booking_refunds WHERE state='pending' LIMIT 1")).rows[0];
		const original=gateway.payments.refund;
		gateway.payments.refund=async(id,input)=>{const refund=await original(id,input);refund.status="pending";return refund;};
		const calls=refundCalls;await Promise.all([controller.paymentService.reconcileRefund(intent.id),controller.paymentService.reconcileRefund(intent.id)]);assert.equal(refundCalls,calls+1);
		assert.equal((await pool.query("SELECT payment_status FROM bookings WHERE booking_id=$1",[intent.booking_id])).rows[0].payment_status,"refund_pending");
		refunds.find((r)=>r.receipt===intent.id).status="failed";await controller.paymentService.reconcileRefund(intent.id);
		assert.equal((await pool.query("SELECT payment_status FROM bookings WHERE booking_id=$1",[intent.booking_id])).rows[0].payment_status,"refund_failed");assert.equal(refundCalls,calls+1);
		gateway.payments.refund=original;
	});
	await t.test("actual HTTP routes strip codes from every provider/admin response",async()=>{
		const express=require("express"),http=require("node:http"),jwt=require("jsonwebtoken");
		process.env.JWT_SECRET="isolated-http-secret";
		const app=express();app.use(express.json());app.use("/api/bookings",load("../routes/bookingRoutes.js",{"../config/db":stubDb,"../controllers/bookingController":controller}));
		const server=http.createServer(app);await new Promise((resolve)=>server.listen(0,"127.0.0.1",resolve));
		try {
			const b=(await pool.query("SELECT * FROM bookings WHERE payment_method='cod' AND status='pending' LIMIT 1")).rows[0];
			const request=async(user,route,method="GET",body)=>{
				const response=await fetch(`http://127.0.0.1:${server.address().port}/api/bookings/${route}`,{method,headers:{Authorization:`Bearer ${jwt.sign(user,process.env.JWT_SECRET,{expiresIn:"1h"})}`,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
				return {status:response.status,data:await response.json()};
			};
			const p={id:provider,role:"provider"},a={id:other,role:"admin"};
			for(const [user,route] of [[p,"provider/history/all"],[p,"provider/list"],[a,"admin/all"],[p,b.booking_id],[a,b.booking_id]]) {
				const result=await request(user,route);assert.equal(result.status,200);
				const rows=Array.isArray(result.data)?result.data:Array.isArray(result.data.data)?result.data.data:[result.data];
				for(const row of rows){assert.equal(row.otp,undefined);assert.equal(row.completion_otp,undefined);}
			}
			const status=await request(p,`${b.booking_id}/status`,"PUT",{status:"confirmed"});assert.equal(status.status,200);assert.equal(status.data.booking.otp,undefined);
			assert.equal((await request({id:other,role:"customer"},b.booking_id)).status,403);
			assert.match((await request(actor,b.booking_id)).data.otp,/^\d{4}$/);
		} finally { server.closeAllConnections();await new Promise((resolve)=>server.close(resolve)); }
	});
	await t.test("periodic reconciliation recovers missed callbacks and order failures create no fake booking",async()=>{
		const created=await book("14:00","online",{date:"2040-01-05"});assert.equal(created.statusCode,201);const b=created.data.booking;capture(b);
		await controller.paymentService.reconcile();
		assert.equal((await pool.query("SELECT status FROM bookings WHERE booking_id=$1",[b.booking_id])).rows[0].status,"booked");
		const count=Number((await pool.query("SELECT COUNT(*) FROM bookings")).rows[0].count), original=gateway.orders.create;
		gateway.orders.create=async()=>{throw new Error("Gateway unavailable");};
		const failed=await book("14:00","online",{date:"2040-01-06"});assert.ok(failed.statusCode>=500);gateway.orders.create=original;
		assert.equal(Number((await pool.query("SELECT COUNT(*) FROM bookings")).rows[0].count),count);
	});
	await t.test("signed webhook before browser confirmation and repeated events activate and notify once", async () => {
		const created = await book("10:00", "online", { date: "2040-02-01" });
		assert.equal(created.statusCode, 201);
		const b = created.data.booking, payment = capture(b), before = notices.length;
		const body = { event: "payment.captured", payload: { payment: { entity: { id: payment.id } } } };
		const rawBody = Buffer.from(JSON.stringify(body));
		const webhook = () => controller.handleRazorpayWebhook({ body, rawBody, headers: {
			"x-razorpay-signature": createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex"),
		} }, response());
		assert.equal((await webhook()).statusCode, 200);
		const signature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${payment.order_id}|${payment.id}`).digest("hex");
		const callback = response();
		await controller.verifyPayment({ user: actor, body: { razorpay_order_id: payment.order_id,
			razorpay_payment_id: payment.id, razorpay_signature: signature } }, callback);
		assert.equal(callback.statusCode, 200);
		assert.equal(callback.data.already_paid, true);
		await Promise.all(Array.from({ length: 8 }, webhook));
		const saved = (await pool.query("SELECT status,payment_status FROM bookings WHERE booking_id=$1", [b.booking_id])).rows[0];
		assert.deepEqual(saved, { status: "booked", payment_status: "paid" });
		assert.equal(notices.length - before, 2);
		assert.equal((await pool.query("SELECT id FROM booking_refunds WHERE booking_id=$1", [b.booking_id])).rowCount, 0);
	});
	await t.test("hold expiring while finalization waits for a schedule lock cannot be resurrected", async () => {
		const created = await book("10:00", "online", { date: "2040-02-02" });
		assert.equal(created.statusCode, 201);
		const b = created.data.booking, payment = capture(b), blocker = await pool.connect();
		let pending;
		try {
			await blocker.query("BEGIN");
			await require("../utils/bookingLifecycle").lockSchedule(blocker, provider, "2040-02-02");
			await pool.query("UPDATE bookings SET hold_expires_at=clock_timestamp()+INTERVAL '2 seconds' WHERE booking_id=$1", [b.booking_id]);
			pending = controller.paymentService.finalize(payment.order_id, payment, actor);
			// Wait for an actual lock waiter, rather than assume timing from a sleep.
			const deadline = Date.now() + 1500;
			let waiting = false;
			while (!waiting && Date.now() < deadline) {
				waiting = (await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND query LIKE 'SELECT pg_advisory_xact_lock%' LIMIT 1")).rowCount > 0;
				if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
			}
			assert.equal(waiting, true, "Finalizer must begin before expiry and wait for the held lock");
			assert.equal((await pool.query("SELECT hold_expires_at > clock_timestamp() AS valid FROM bookings WHERE booking_id=$1", [b.booking_id])).rows[0].valid, true);
			await blocker.query("SELECT pg_sleep(2.1)");
			await blocker.query("COMMIT");
			const result = await pending;
			assert.equal(result.late, true);
			assert.equal(result.booking.status, "expired");
			assert.equal(result.booking.payment_status, "refund_pending");
		} finally {
			await blocker.query("ROLLBACK").catch(() => {}); blocker.release();
			await pending?.catch(() => {});
		}
	});
	await t.test("hold expiring behind a chat-style booking row lock is checked after acquiring the row", async () => {
		const created = await book("10:00", "online", { date: "2040-02-04" });
		assert.equal(created.statusCode, 201);
		const b = created.data.booking, payment = capture(b), blocker = await pool.connect();
		let pending;
		try {
			await pool.query("UPDATE bookings SET hold_expires_at=clock_timestamp()+INTERVAL '2 seconds' WHERE booking_id=$1", [b.booking_id]);
			await blocker.query("BEGIN");
			await blocker.query("SELECT booking_id FROM bookings WHERE booking_id=$1 FOR UPDATE", [b.booking_id]);
			pending = controller.paymentService.finalize(payment.order_id, payment, actor);
			const deadline = Date.now() + 1500;
			let waiting = false;
			while (!waiting && Date.now() < deadline) {
				waiting = (await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT *, TO_CHAR(date%' LIMIT 1")).rowCount > 0;
				if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
			}
			assert.equal(waiting, true);
			assert.equal((await pool.query("SELECT hold_expires_at > clock_timestamp() AS valid FROM bookings WHERE booking_id=$1", [b.booking_id])).rows[0].valid, true);
			await blocker.query("SELECT pg_sleep(2.1)");
			await blocker.query("COMMIT");
			assert.equal((await pending).late, true);
		} finally {
			await blocker.query("ROLLBACK").catch(() => {}); blocker.release();
			await pending?.catch(() => {});
		}
	});
	await t.test("uncertain refund with no discoverable receipt is never blindly submitted again", async () => {
		const created = await book("10:00", "online", { date: "2040-02-03" });
		assert.equal(created.statusCode, 201);
		const b = created.data.booking, payment = capture(b);
		await pool.query("UPDATE bookings SET hold_expires_at=clock_timestamp()-INTERVAL '1 second' WHERE booking_id=$1", [b.booking_id]);
		await controller.paymentService.finalize(payment.order_id, payment);
		const intent = (await pool.query("SELECT * FROM booking_refunds WHERE booking_id=$1", [b.booking_id])).rows[0];
		const original = gateway.payments.refund;
		let attempted = 0;
		gateway.payments.refund = async () => { attempted++; throw new Error("Uncertain gateway timeout"); };
		try {
			await assert.rejects(controller.paymentService.reconcileRefund(intent.id));
			await controller.paymentService.reconcileRefund(intent.id);
			await controller.paymentService.reconcileRefund(intent.id);
			assert.equal(attempted, 1);
			assert.equal((await pool.query("SELECT state FROM booking_refunds WHERE id=$1", [intent.id])).rows[0].state, "unknown");
		} finally { gateway.payments.refund = original; }
	});
	await t.test("HTTP contention evidence: 50 COD and 50 online requests each reserve only one slot", async () => {
		const express = require("express"), http = require("node:http"), jwt = require("jsonwebtoken");
		process.env.JWT_SECRET = "isolated-evidence-secret";
		const app = express(); app.use(express.json());
		app.use("/api/bookings", load("../routes/bookingRoutes.js", {
			"../config/db": stubDb, "../controllers/bookingController": controller,
			"../middleware/rateLimiter": { bookingLimiter: (req, res, next) => next() },
		}));
		const server = http.createServer(app);
		await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
		const rounds = [];
		try {
			for (const [method, date] of [["cod", "2040-03-01"], ["online", "2040-03-02"]]) {
				const start = performance.now();
				const outcomes = await Promise.all(Array.from({ length: 50 }, async () => {
					const began = performance.now();
					const reply = await fetch(`http://127.0.0.1:${server.address().port}/api/bookings`, {
						method: "POST", signal: AbortSignal.timeout(30000),
						headers: { Authorization: `Bearer ${jwt.sign(actor, process.env.JWT_SECRET)}`, "Content-Type": "application/json" },
						body: JSON.stringify({ provider_id: provider, service_id: service, date, start_time: "10:00", address: "Synthetic contention fixture", payment_method: method,latitude:12,longitude:77 }),
					});
					await reply.json();
					return { status: reply.status, ms: performance.now() - began };
				}));
				const committed = Number((await pool.query("SELECT COUNT(*) FROM bookings WHERE provider_id=$1 AND date=$2", [provider, date])).rows[0].count);
				const accepted = outcomes.filter((r) => r.status === 201).length;
				const rejected = outcomes.filter((r) => r.status === 409).length;
				const errors = outcomes.filter((r) => ![201, 409].includes(r.status)).length;
				const timings = outcomes.map((r) => r.ms).sort((a, b) => a - b);
				rounds.push({ method, requests: 50, accepted, rejected, errors, committed,
					elapsedMs: Math.round(performance.now() - start), p50Ms: Math.round(timings[24]), p95Ms: Math.round(timings[47]) });
				assert.deepEqual({ accepted, rejected, errors, committed }, { accepted: 1, rejected: 49, errors: 0, committed: 1 });
			}
			const report = { measuredAt: new Date().toISOString(), node: process.version,
				postgres: (await pool.query("SHOW server_version")).rows[0].server_version, poolMax: 10,
				conditions: "Loopback HTTP; actual JWT middleware, routes, controllers and PostgreSQL. Synthetic provider, 1200 INR service, one slot per round. Redis admission lock, rate limiter, gateway and notification delivery stubbed. This verifies DB contention correctness, not production throughput.", rounds };
			console.log("CONTENTION_REPORT " + JSON.stringify(report));
			if (process.env.TASKGENIE_EVIDENCE_DIR) {
				fs.mkdirSync(process.env.TASKGENIE_EVIDENCE_DIR, { recursive: true });
				fs.writeFileSync(path.join(process.env.TASKGENIE_EVIDENCE_DIR, "concurrency.json"), JSON.stringify(report, null, 2) + "\n");
			}
		} finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
	});
});
