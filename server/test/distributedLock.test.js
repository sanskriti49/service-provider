const { test, describe } = require("node:test");
const assert = require("node:assert");
const {
	acquireLock,
	releaseLock,
	withDistributedLock,
	LockAcquisitionError,
} = require("../utils/distributedLock");

describe("distributedLock: Redis / Fallback Distributed Concurrency Control", () => {
	test("successfully acquires and releases an exclusive lock", async () => {
		const lockKey = "slot:provider-101:2026-10-01:10:00";
		const lock = await acquireLock(lockKey, 2000);

		assert.strictEqual(lock.acquired, true);
		assert.ok(lock.token);
		assert.strictEqual(lock.key, `lock:${lockKey}`);

		// Re-acquiring while locked must fail
		const secondLock = await acquireLock(lockKey, 2000);
		assert.strictEqual(secondLock.acquired, false);

		// Releasing lock with the correct token
		const released = await releaseLock(lock.key, lock.token);
		assert.strictEqual(released, true);

		// Now another acquire should succeed
		const thirdLock = await acquireLock(lockKey, 2000);
		assert.strictEqual(thirdLock.acquired, true);
		await releaseLock(thirdLock.key, thirdLock.token);
	});

	test("rejects release with an invalid token", async () => {
		const lockKey = "slot:provider-102:2026-10-01:11:00";
		const lock = await acquireLock(lockKey, 2000);
		assert.strictEqual(lock.acquired, true);

		const fakeRelease = await releaseLock(lock.key, "invalid_token_xyz");
		assert.strictEqual(fakeRelease, false);

		// Clean up
		await releaseLock(lock.key, lock.token);
	});

	test("withDistributedLock executes protected block and releases automatically", async () => {
		const lockKey = "slot:provider-103:2026-10-01:12:00";

		let executed = false;
		const result = await withDistributedLock(lockKey, 2000, async () => {
			executed = true;
			return "booking_success";
		});

		assert.strictEqual(executed, true);
		assert.strictEqual(result, "booking_success");

		// Lock should have been released automatically
		const nextLock = await acquireLock(lockKey, 2000);
		assert.strictEqual(nextLock.acquired, true);
		await releaseLock(nextLock.key, nextLock.token);
	});

	test("withDistributedLock throws LockAcquisitionError on collision", async () => {
		const lockKey = "slot:provider-104:2026-10-01:13:00";
		const lock = await acquireLock(lockKey, 2000);

		await assert.rejects(
			async () => {
				await withDistributedLock(lockKey, 2000, async () => {
					return "should_not_run";
				});
			},
			(err) => {
				return err instanceof LockAcquisitionError && err.statusCode === 409;
			},
		);

		await releaseLock(lock.key, lock.token);
	});
});
