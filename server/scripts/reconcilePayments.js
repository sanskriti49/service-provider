const db = require("../config/db");
const Razorpay = require("razorpay");
const { createPaymentService } = require("../services/paymentService");

async function run() {
	const { RAZORPAY_KEY_ID: key_id, RAZORPAY_KEY_SECRET: key_secret } = process.env;
	if (!key_id || !key_secret || key_secret === "placeholder_secret") {
		console.error("Razorpay credentials are required");
		process.exitCode = 1;
		return;
	}
	const gateway = new Razorpay({ key_id, key_secret });
	gateway.api.rq.defaults.timeout = 8000;
	const result = await createPaymentService({ db, gateway }).reconcile();
	if (result.skipped) console.info("Another payment reconciliation worker owns the lease");
	if (result.gatewayFailures) process.exitCode = 1;
}

run().catch(() => {
	console.error(JSON.stringify({ event: "booking_reconciliation_failed" }));
	process.exitCode = 1;
}).finally(() => db.end());
