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
test("booking integrity: actual controllers, PostgreSQL constraints, concurrent captures and refund recovery", { skip: !url, timeout: 60000 }, async (t) => {
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
	const customer=randomUUID(), other=randomUUID(), provider=randomUUID(), service=randomUUID();
	for (const [id,role] of [[customer,"customer"],[other,"customer"],[provider,"provider"]]) await pool.query("INSERT INTO users(id,name,email,password,role,custom_id) VALUES($1,'Test',$2,'unused',$3,$4)", [id,`${id}@example.com`,role,`${role === "provider" ? "SRV" : "CUS"}${id.replaceAll("-", "").slice(0,20).toUpperCase()}`]);
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
	const controller=load("../controllers/bookingController.js", { "../config/db":stubDb, razorpay:class {constructor(){Object.assign(this,gateway);}}, "../utils/eventQueue":{publish:()=>{}}, "../utils/sendEmail":async()=>{}, "../utils/notificationService":{sendNotification:async(input)=>notices.push(input)}, "../utils/distributedLock":{acquireLock:async()=>({acquired:true}),releaseLock:async()=>{}}, "../utils/circuitBreaker":{createProtectedBreaker:(action)=>({fire:action})} });
	const actor = {id:customer,role:"customer"};
	const book = async (start="10:00", method="online", extra={}) => { const res=response(); await controller.createBooking({user:actor,body:{provider_id:provider,service_id:service,date:"2040-01-02",start_time:start,address:"Test service address",payment_method:method,...extra}},res); return res; };
	const capture = (booking,id=`pay_${randomUUID().replaceAll("-", "")}`) => {const payment={id,order_id:booking.razorpay_order_id,amount:120000,currency:"INR",status:"captured",captured:true};payments.set(id,payment);return payment;};
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
});
