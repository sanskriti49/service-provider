/**
 * Centralized Stack-Safe Modal Registry & Scroll Lock Manager
 *
 * Ensures that:
 * 1. Pressing Escape closes ONLY the topmost active modal layer.
 * 2. Background shortcuts are shielded while any modal is open.
 * 3. Body scroll locking is stack-aware with scrollbar width compensation,
 *    eliminating horizontal layout shifts and scrollbar flickering.
 */

let modalStack = [];
let originalOverflow = "";
let originalPaddingRight = "";
let keydownListenerAttached = false;

function getScrollbarWidth() {
	if (typeof window === "undefined" || typeof document === "undefined") return 0;
	return window.innerWidth - document.documentElement.clientWidth;
}

function handleGlobalEscape(e) {
	if (e.key !== "Escape" || modalStack.length === 0) return;

	// Find the topmost modal that has an onEscape handler
	const topModal = modalStack[modalStack.length - 1];
	if (topModal && typeof topModal.onEscape === "function") {
		e.preventDefault();
		e.stopPropagation();
		topModal.onEscape(e);
	}
}

function ensureKeydownListener() {
	if (typeof window === "undefined" || keydownListenerAttached) return;
	window.addEventListener("keydown", handleGlobalEscape, true); // capture phase to intercept before page listeners
	keydownListenerAttached = true;
}

function removeKeydownListener() {
	if (typeof window === "undefined" || !keydownListenerAttached) return;
	window.removeEventListener("keydown", handleGlobalEscape, true);
	keydownListenerAttached = false;
}

function applyScrollLock() {
	if (typeof document === "undefined") return;

	const scrollbarWidth = getScrollbarWidth();
	originalOverflow = document.body.style.overflow;
	originalPaddingRight = document.body.style.paddingRight;

	document.body.style.overflow = "hidden";
	if (scrollbarWidth > 0) {
		document.body.style.paddingRight = `${scrollbarWidth}px`;
	}
}

function releaseScrollLock() {
	if (typeof document === "undefined") return;

	document.body.style.overflow = originalOverflow || "";
	document.body.style.paddingRight = originalPaddingRight || "";
}

/**
 * Register a modal onto the stack.
 *
 * @param {Object} options
 * @param {string} options.id - Unique modal identifier
 * @param {Function} options.onEscape - Handler called when Escape is pressed while this modal is topmost
 * @param {boolean} [options.lockScroll=true] - Whether this modal locks body scrolling
 * @returns {Function} unregister function
 */
export function registerModal({ id, onEscape, lockScroll = true }) {
	// Remove any existing entry with the same id
	modalStack = modalStack.filter((m) => m.id !== id);

	const wasEmpty = modalStack.length === 0;

	modalStack.push({ id, onEscape, lockScroll });

	ensureKeydownListener();

	if (wasEmpty && lockScroll) {
		applyScrollLock();
	}

	return () => unregisterModal(id);
}

/**
 * Unregister a modal from the stack by ID.
 *
 * @param {string} id
 */
export function unregisterModal(id) {
	const initialLen = modalStack.length;
	modalStack = modalStack.filter((m) => m.id !== id);

	if (initialLen > 0 && modalStack.length === 0) {
		removeKeydownListener();
		releaseScrollLock();
	}
}

/**
 * Check if any modal is currently open.
 * Used by page-level shortcut listeners to avoid background activations.
 *
 * @returns {boolean}
 */
export function hasActiveModals() {
	return modalStack.length > 0;
}

/**
 * Get the ID of the topmost active modal.
 *
 * @returns {string|null}
 */
export function getTopModalId() {
	if (modalStack.length === 0) return null;
	return modalStack[modalStack.length - 1].id;
}

/**
 * Check if the specified modal is currently the topmost layer.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function isTopModal(id) {
	return getTopModalId() === id;
}

export default {
	registerModal,
	unregisterModal,
	hasActiveModals,
	getTopModalId,
	isTopModal,
};
