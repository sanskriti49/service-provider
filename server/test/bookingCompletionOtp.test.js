const test = require("node:test");
const assert = require("node:assert/strict");
const { generateOtp, serializeBooking, assertTransition } = require("../utils/bookingLifecycle");
test("codes use four digits and serializers disclose codes only to the owning customer", () => {
 const row = { user_id: "customer", provider_id: "provider", otp: generateOtp(), completion_otp: generateOtp() };
 assert.match(row.otp, /^\d{4}$/);
 for (const actor of [{id:"provider",role:"provider"},{id:"admin",role:"admin"},{id:"stranger",role:"customer"}]) {
  const response = serializeBooking(row,actor); assert.equal(response.otp,undefined);assert.equal(response.completion_otp,undefined);
 }
 assert.equal(serializeBooking(row,{id:"customer",role:"customer"}).otp,row.otp);
});
test("terminal states cannot be resurrected and completion requires in-progress", () => {
 const booking = { user_id:"customer",provider_id:"provider",payment_method:"cod",payment_status:"pending" };
 for (const status of ["completed","cancelled","expired","no_show"]) for (const role of ["customer","provider","admin"]) assert.throws(()=>assertTransition({...booking,status},{id:role,role},"booked"));
 assert.throws(()=>assertTransition({...booking,status:"confirmed"},{id:"provider",role:"provider"},"completed"));
 assert.doesNotThrow(()=>assertTransition({...booking,status:"in_progress"},{id:"provider",role:"provider"},"completed"));
 assert.throws(()=>assertTransition({...booking,status:"pending",payment_method:"online"},{id:"provider",role:"provider"},"confirmed"));
});
