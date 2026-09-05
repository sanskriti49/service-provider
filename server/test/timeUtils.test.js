const test = require("node:test");
const assert = require("node:assert/strict");
const {
	timeToMinutes,
	minutesToTime,
	splitIntoChunks,
	generateRealSlots,
} = require("../utils/timeUtils");

test("timeUtils: timeToMinutes converts HH:MM correctly", () => {
	assert.strictEqual(timeToMinutes("00:00"), 0);
	assert.strictEqual(timeToMinutes("09:30"), 570);
	assert.strictEqual(timeToMinutes("18:45"), 1125);
});

test("timeUtils: minutesToTime formats numbers to HH:MM correctly", () => {
	assert.strictEqual(minutesToTime(0), "00:00");
	assert.strictEqual(minutesToTime(570), "09:30");
	assert.strictEqual(minutesToTime(1125), "18:45");
});

test("timeUtils: splitIntoChunks generates uniform intervals", () => {
	const chunks = splitIntoChunks("09:00", "12:00", 60);
	assert.strictEqual(chunks.length, 3);
	assert.deepStrictEqual(chunks[0], { start: "09:00", end: "10:00" });
	assert.deepStrictEqual(chunks[1], { start: "10:00", end: "11:00" });
	assert.deepStrictEqual(chunks[2], { start: "11:00", end: "12:00" });
});

test("timeUtils: generateRealSlots produces valid future date slots without crashing", () => {
	const schedule = [
		{ day: 1, start: "09:00:00", end: "12:00:00" },
		{ day: 2, start: "14:00:00", end: "17:00:00" },
	];
	const slots = generateRealSlots(schedule);
	assert.ok(Array.isArray(slots));
	assert.ok(slots.length > 0);
	assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(slots[0].date));
	assert.ok(/^\d{2}:\d{2}$/.test(slots[0].start_time));
	assert.ok(/^\d{2}:\d{2}$/.test(slots[0].end_time));
});
