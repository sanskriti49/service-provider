const db = require("../config/db");
const Razorpay = require("razorpay");
const { createPaymentService } = require("../services/paymentService");
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET === "placeholder_secret") {
 console.error("Real Razorpay test/live credentials required");process.exitCode=1;db.end();
} else {
 const gateway=new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET});
 gateway.api.rq.defaults.timeout=8000;
 createPaymentService({db,gateway}).reconcile().catch((error)=>{console.error(error.message);process.exitCode=1;}).finally(()=>db.end());
}
