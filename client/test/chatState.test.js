import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPeerReceipt, chatErrorMessage, clientMessageId, compareIds, mergeMessages } from "../src/chat/chatState.js";

const pending = { sender_id: "customer", client_message_id: "retry-1", body: "Hello", created_at: "2026-10-10T10:00:00Z", status: "sending" };
test("chat: push before ack reconciles optimistic send without a duplicate", () => {
	const saved = { ...pending, id: "9007199254740993", status: undefined };
	const result = mergeMessages(mergeMessages([pending], [saved]), [saved]);
	assert.equal(result.length, 1);
	assert.equal(result[0].id, saved.id);
	assert.equal(result[0].status, undefined);
});
test("chat: bigint order is exact and retry IDs are scoped by sender", () => {
	const messages = mergeMessages([], [
		{ ...pending, id: "9007199254740993" },
		{ ...pending, sender_id: "provider", id: "9007199254740992" },
	]);
	assert.equal(messages.length, 2);
	assert.equal(messages[0].sender_id, "provider");
	assert.equal(compareIds(messages[0].id, messages[1].id), -1);
});
test("chat: stale history and receipts never clear or move a read receipt backwards", () => {
	const saved = { ...pending, id: "1", read_at: "2026-10-10T10:01:00Z" };
	const merged = mergeMessages([saved], [{ ...saved, read_at: null }]);
	assert.equal(merged[0].read_at, saved.read_at);
	assert.equal(applyPeerReceipt(merged, "customer", "1", "2026-10-10T10:02:00Z")[0].read_at, saved.read_at);
	assert.equal(applyPeerReceipt([{ ...saved, sender_id: "provider", read_at: null }], "customer", "1")[0].read_at, null);
});
test("chat: failed sends are replaced by committed history, not duplicated", () => {
	const result = mergeMessages([{ ...pending, status: "failed" }], [{ ...pending, id: "1" }]);
	assert.equal(result.length, 1);
	assert.equal(result[0].status, undefined);
});
test("chat: retry UUIDs and useful error messages", () => {
	assert.match(clientMessageId(), /^[0-9a-f-]{36}$/);
	assert.notEqual(clientMessageId(), clientMessageId());
	assert.match(chatErrorMessage({ status: 404 }), /Only the booking/);
	assert.match(chatErrorMessage({ response: { status: 429 } }), /wait/);
});
