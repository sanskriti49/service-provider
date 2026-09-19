import { useEffect, useRef } from "react";
import { hasActiveModals } from "../utils/modalStack.js";

/**
 * Check if the event target is an interactive form element where typing occurs
 * @param {KeyboardEvent} e
 * @returns {boolean}
 */
export function isTypingInInput(e) {
	const target = e.target;
	if (!target) return false;
	const tagName = target.tagName;
	return (
		tagName === "INPUT" ||
		tagName === "TEXTAREA" ||
		tagName === "SELECT" ||
		Boolean(target.isContentEditable)
	);
}

/**
 * Parse shortcut combo string into normalized components
 * Examples: "ctrl+k", "cmd+k", "ctrl+shift+enter", "escape", "/", "alt+s"
 * @param {string} combo
 */
export function parseCombo(combo) {
	if (!combo || typeof combo !== "string") return null;
	const parts = combo.toLowerCase().split("+").map((p) => p.trim());
	let key = parts[parts.length - 1];
	const hasCtrl = parts.includes("ctrl") || parts.includes("cmd") || parts.includes("meta");
	const hasShift = parts.includes("shift");
	const hasAlt = parts.includes("alt") || parts.includes("option");

	// Key normalization
	if (key === "esc") key = "escape";
	if (key === "return") key = "enter";
	if (key === "space") key = " ";

	return {
		key,
		ctrlOrCmd: hasCtrl,
		shift: hasShift,
		alt: hasAlt,
		explicitShift: hasShift,
	};
}

/**
 * Matches a KeyboardEvent against a parsed shortcut definition
 * @param {KeyboardEvent} e
 * @param {Object} parsed
 * @returns {boolean}
 */
export function matchesCombo(e, parsed) {
	if (!parsed) return false;
	const eventKey = e.key.toLowerCase();
	const targetKey = parsed.key.toLowerCase();

	const keyMatches = eventKey === targetKey || e.code.toLowerCase() === targetKey;
	if (!keyMatches) return false;

	const eventCtrlOrCmd = Boolean(e.ctrlKey || e.metaKey);
	const eventShift = Boolean(e.shiftKey);
	const eventAlt = Boolean(e.altKey);

	if (parsed.ctrlOrCmd !== eventCtrlOrCmd) return false;
	if (parsed.alt !== eventAlt) return false;

	// If shortcut explicitly specified shift (e.g. "shift+enter" or "ctrl+shift+k")
	if (parsed.explicitShift && !eventShift) return false;

	// If shift was not specified, but user pressed Shift with a non-character key like "Enter" or "Escape"
	if (!parsed.explicitShift && eventShift && targetKey.length > 1) {
		return false;
	}

	return true;
}

/**
 * Custom React Hook for flexible, standardized keyboard shortcuts.
 *
 * Supports:
 * - Single keys ("/", "t", "Escape")
 * - Combos ("ctrl+k", "cmd+k", "ctrl+enter", "alt+1")
 * - Form input guarding (bypasses shortcuts while user types in input/textarea/select unless enableInInputs is true)
 * - Modal stack awareness (ignoreWhenModalOpen: true suppresses page shortcuts when any modal is open)
 *
 * @param {string|Array<string>} combo - e.g. "ctrl+k", ["ctrl+k", "cmd+k"], "/"
 * @param {Function} handler - Callback (e) => void
 * @param {Object} options
 * @param {boolean} [options.enableInInputs=false] - Whether shortcut fires while focused in inputs/textareas
 * @param {boolean} [options.ignoreWhenModalOpen=false] - Ignore if any modal is active in modalStack
 * @param {boolean} [options.preventDefault=true] - Prevent default browser behavior
 * @param {boolean} [options.stopPropagation=false] - Stop propagation
 * @param {boolean} [options.enabled=true] - Toggle shortcut listener
 * @param {EventTarget} [options.target=window] - Event listener target
 */
export function useKeyboardShortcut(combo, handler, options = {}) {
	const {
		enableInInputs = false,
		ignoreWhenModalOpen = false,
		preventDefault = true,
		stopPropagation = false,
		enabled = true,
		target = typeof window !== "undefined" ? window : null,
	} = options;

	const handlerRef = useRef(handler);
	useEffect(() => {
		handlerRef.current = handler;
	});

	useEffect(() => {
		if (!enabled || !target || !combo) return;

		const combos = Array.isArray(combo) ? combo : [combo];
		const parsedCombos = combos.map(parseCombo).filter(Boolean);

		if (parsedCombos.length === 0) return;

		const handleKeyDown = (e) => {
			// Check modal stack: if modal is open and page shortcut requested ignore
			if (ignoreWhenModalOpen && hasActiveModals()) {
				return;
			}

			// Check input focus: if user is typing in input and shortcut didn't explicitly enable it
			if (!enableInInputs && isTypingInInput(e)) {
				return;
			}

			// Check if event matches any combo
			const matched = parsedCombos.some((p) => matchesCombo(e, p));
			if (matched) {
				if (preventDefault) e.preventDefault();
				if (stopPropagation) e.stopPropagation();
				if (handlerRef.current) {
					handlerRef.current(e);
				}
			}
		};

		target.addEventListener("keydown", handleKeyDown);
		return () => {
			target.removeEventListener("keydown", handleKeyDown);
		};
	}, [combo, enabled, target, enableInInputs, ignoreWhenModalOpen, preventDefault, stopPropagation]);
}

/**
 * Register multiple keyboard shortcuts simultaneously.
 *
 * @param {Array<{ combo: string|Array<string>, handler: Function, options?: Object }>} shortcuts
 */
export function useKeyboardShortcuts(shortcuts = []) {
	const shortcutsRef = useRef(shortcuts);
	useEffect(() => {
		shortcutsRef.current = shortcuts;
	});

	useEffect(() => {
		if (typeof window === "undefined" || !shortcuts || shortcuts.length === 0) return;

		const handleKeyDown = (e) => {
			const currentShortcuts = shortcutsRef.current || [];

			for (const item of currentShortcuts) {
				if (!item || item.enabled === false) continue;

				const {
					combo,
					handler,
					enableInInputs = false,
					ignoreWhenModalOpen = false,
					preventDefault = true,
					stopPropagation = false,
				} = item;

				if (ignoreWhenModalOpen && hasActiveModals()) {
					continue;
				}

				if (!enableInInputs && isTypingInInput(e)) {
					continue;
				}

				const combos = Array.isArray(combo) ? combo : [combo];
				const matched = combos.some((c) => matchesCombo(e, parseCombo(c)));

				if (matched) {
					if (preventDefault) e.preventDefault();
					if (stopPropagation) e.stopPropagation();
					if (typeof handler === "function") {
						handler(e);
					}
					break; // Only match first matching shortcut in this batch
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [shortcuts.length]);
}

export default useKeyboardShortcut;
