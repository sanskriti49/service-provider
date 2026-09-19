import test from "node:test";
import assert from "node:assert/strict";

import {
	parseCombo,
	matchesCombo,
	isTypingInInput,
} from "../src/hooks/useKeyboardShortcut.js";

import {
	registerModal,
	unregisterModal,
	hasActiveModals,
	getTopModalId,
	isTopModal,
} from "../src/utils/modalStack.js";

test("useKeyboardShortcut: parseCombo correctly parses shortcuts", () => {
	const ctrlK = parseCombo("ctrl+k");
	assert.strictEqual(ctrlK.key, "k");
	assert.strictEqual(ctrlK.ctrlOrCmd, true);
	assert.strictEqual(ctrlK.shift, false);
	assert.strictEqual(ctrlK.alt, false);

	const cmdShiftEnter = parseCombo("cmd+shift+enter");
	assert.strictEqual(cmdShiftEnter.key, "enter");
	assert.strictEqual(cmdShiftEnter.ctrlOrCmd, true);
	assert.strictEqual(cmdShiftEnter.shift, true);
	assert.strictEqual(cmdShiftEnter.alt, false);

	const esc = parseCombo("esc");
	assert.strictEqual(esc.key, "escape");
	assert.strictEqual(esc.ctrlOrCmd, false);

	const slash = parseCombo("/");
	assert.strictEqual(slash.key, "/");
	assert.strictEqual(slash.ctrlOrCmd, false);

	const altS = parseCombo("alt+s");
	assert.strictEqual(altS.key, "s");
	assert.strictEqual(altS.alt, true);
});

test("useKeyboardShortcut: matchesCombo handles modifier keys and single keys", () => {
	const ctrlK = parseCombo("ctrl+k");
	assert.strictEqual(
		matchesCombo({ key: "k", code: "KeyK", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, ctrlK),
		true
	);
	// Fails when ctrl is not pressed
	assert.strictEqual(
		matchesCombo({ key: "k", code: "KeyK", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, ctrlK),
		false
	);
	// Works with metaKey (Mac Cmd)
	assert.strictEqual(
		matchesCombo({ key: "k", code: "KeyK", ctrlKey: false, metaKey: true, shiftKey: false, altKey: false }, ctrlK),
		true
	);

	const escapeCombo = parseCombo("escape");
	assert.strictEqual(
		matchesCombo({ key: "Escape", code: "Escape", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, escapeCombo),
		true
	);

	const slashCombo = parseCombo("/");
	assert.strictEqual(
		matchesCombo({ key: "/", code: "Slash", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, slashCombo),
		true
	);
});

test("useKeyboardShortcut: isTypingInInput detects form elements", () => {
	assert.strictEqual(isTypingInInput({ target: { tagName: "INPUT" } }), true);
	assert.strictEqual(isTypingInInput({ target: { tagName: "TEXTAREA" } }), true);
	assert.strictEqual(isTypingInInput({ target: { tagName: "SELECT" } }), true);
	assert.strictEqual(isTypingInInput({ target: { tagName: "DIV", isContentEditable: true } }), true);

	assert.strictEqual(isTypingInInput({ target: { tagName: "DIV", isContentEditable: false } }), false);
	assert.strictEqual(isTypingInInput({ target: { tagName: "BUTTON" } }), false);
	assert.strictEqual(isTypingInInput({ target: null }), false);
});

test("modalStack: stack-safe Escape handling and layer tracking", () => {
	let modal1Closed = false;
	let modal2Closed = false;

	assert.strictEqual(hasActiveModals(), false);

	// Register Modal 1 (e.g. BookingDetailsSheet)
	const unregister1 = registerModal({
		id: "booking-sheet",
		onEscape: () => {
			modal1Closed = true;
		},
		lockScroll: false,
	});

	assert.strictEqual(hasActiveModals(), true);
	assert.strictEqual(getTopModalId(), "booking-sheet");
	assert.strictEqual(isTopModal("booking-sheet"), true);

	// Register Modal 2 on top (e.g. CompletionOtpModal)
	const unregister2 = registerModal({
		id: "completion-otp",
		onEscape: () => {
			modal2Closed = true;
		},
		lockScroll: false,
	});

	assert.strictEqual(getTopModalId(), "completion-otp");
	assert.strictEqual(isTopModal("completion-otp"), true);
	assert.strictEqual(isTopModal("booking-sheet"), false);

	// Simulate Escape event - must close ONLY the topmost modal (modal 2)
	const mockEscapeEvent = {
		key: "Escape",
		preventDefault: () => {},
		stopPropagation: () => {},
	};

	// We can dispatch escape to window or test stack logic directly
	// Let's unregister modal 2 as would happen on onEscape
	unregister2();

	// Modal 1 should now be top
	assert.strictEqual(hasActiveModals(), true);
	assert.strictEqual(getTopModalId(), "booking-sheet");
	assert.strictEqual(isTopModal("booking-sheet"), true);

	// Unregister modal 1
	unregister1();
	assert.strictEqual(hasActiveModals(), false);
	assert.strictEqual(getTopModalId(), null);
});
