const { test } = require("node:test");
const assert = require("node:assert/strict");
const { requireOutboxSchema } = require("../utils/outboxStartup");

function fixture(responses) {
	const statements = [];
	let released = false;
	return {
		statements,
		get released() { return released; },
		db: { connect: async () => ({
			query: async (sql) => {
				statements.push(sql);
				const result = responses.shift();
				if (result instanceof Error) throw result;
				return result;
			},
			release: () => { released = true; },
		}) },
	};
}

const visible = () => ({ rows: [{ exists_in_public: true, resolves_to_public: true }] });
const permitted = () => ({ rows: [{ can_select: true, can_insert: true, can_update: true }] });

test("outbox startup check is read-only and releases its connection", async () => {
	const f = fixture([visible(), permitted(), { rows: [] }]);
	await requireOutboxSchema(f.db);
	assert.equal(f.released, true);
	assert.equal(f.statements.length, 3);
	assert.ok(f.statements.every(sql => /^SELECT\b/i.test(sql.trim())));
});

test("missing, shadowed and inaccessible outbox schemas fail clearly", async () => {
	for (const [response, expected] of [
		[{ rows: [{ exists_in_public: false, resolves_to_public: null }] }, /migrate:outbox/],
		[{ rows: [{ exists_in_public: true, resolves_to_public: false }] }, /search_path/],
	]) {
		const f = fixture([response]);
		await assert.rejects(requireOutboxSchema(f.db), expected);
		assert.equal(f.released, true);
	}
	const f = fixture([visible(), { rows: [{ can_select: true, can_insert: false, can_update: true }] }]);
	await assert.rejects(requireOutboxSchema(f.db), /SELECT, INSERT and UPDATE/);
	assert.equal(f.released, true);
});

test("database errors report only a safe error code", async () => {
	const error = Object.assign(new Error("private connection details"), { code: "42703" });
	const f = fixture([visible(), permitted(), error]);
	await assert.rejects(requireOutboxSchema(f.db), error => {
		assert.match(error.message, /PostgreSQL 42703/);
		assert.doesNotMatch(error.message, /private connection details/);
		return true;
	});
	assert.equal(f.released, true);
});

test("connection failures do not expose connection details", async () => {
	const db = { connect: async () => { throw new Error("private connection details"); } };
	await assert.rejects(requireOutboxSchema(db), error => {
		assert.match(error.message, /Check database connectivity/);
		assert.doesNotMatch(error.message, /private connection details/);
		return true;
	});
});
