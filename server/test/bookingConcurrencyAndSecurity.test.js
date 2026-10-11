const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { verifyHmac, createPaymentService } = require("../services/paymentService");
test("production HMAC verifier fails closed for missing secrets, forged prefixes and tampered bodies", async () => {
 const body=Buffer.from('{"event":"payment.captured"}'),secret="unit-secret";
 const signature=crypto.createHmac("sha256",secret).update(body).digest("hex");
 assert.equal(verifyHmac(secret,body,signature),true);
 for(const supplied of [undefined,"", "mock_test_signature", "f".repeat(64)]) assert.equal(verifyHmac(secret,body,supplied),false);
 for(const missing of [undefined,"","placeholder_secret"]) assert.equal(verifyHmac(missing,body,signature),false);
 assert.equal(verifyHmac(secret,Buffer.from("tampered"),signature),false);
 process.env.NODE_ENV="test";process.env.RAZORPAY_KEY_SECRET=secret;
 const service=createPaymentService({db:{query:()=>{throw new Error("Must not query database for forged payment");}},gateway:{}});
 await assert.rejects(service.verify({razorpay_order_id:"test_order_forged",razorpay_payment_id:"pay_test_fake",razorpay_signature:"mock"},{id:"customer",role:"customer"}),{status:400});
});
