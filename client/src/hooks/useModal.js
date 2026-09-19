import { useEffect, useId, useRef } from "react";
import { registerModal, unregisterModal, isTopModal, hasActiveModals } from "../utils/modalStack.js";

/**
 * Standardized Hook for Modal / Sheet / Dialog lifecycle management.
 *
 * Integrates with modalStack:
 * - Stack-safe Escape key handling (closes only the topmost modal layer)
 * - Coordinated scroll locking with scrollbar width compensation (no layout shift/flickering)
 * - Optional Ctrl+Enter / Cmd+Enter form submission on the topmost modal
 *
 * @param {Object} options
 * @param {boolean} options.isOpen - Modal visibility flag
 * @param {Function} options.onClose - Close callback invoked on Escape or backdrop click
 * @param {string} [options.id] - Optional custom modal ID
 * @param {boolean} [options.lockScroll=true] - Whether to lock body scrolling
 * @param {boolean} [options.submitOnCtrlEnter=false] - Whether Ctrl+Enter triggers onSubmit
 * @param {Function} [options.onSubmit] - Form submission handler
 * @returns {{ modalId: string, isTop: boolean, hasActiveModals: () => boolean }}
 */
export function useModal({
	isOpen,
	onClose,
	id: customId,
	lockScroll = true,
	submitOnCtrlEnter = false,
	onSubmit = null,
}) {
	const generatedId = useId();
	const modalId = customId || generatedId;

	const onCloseRef = useRef(onClose);
	const onSubmitRef = useRef(onSubmit);

	useEffect(() => {
		onCloseRef.current = onClose;
		onSubmitRef.current = onSubmit;
	});

	// Register with modalStack for Escape management & scroll locking
	useEffect(() => {
		if (!isOpen) return;

		const unregister = registerModal({
			id: modalId,
			onEscape: (e) => {
				if (onCloseRef.current) {
					onCloseRef.current(e);
				}
			},
			lockScroll,
		});

		return () => {
			unregister();
		};
	}, [isOpen, modalId, lockScroll]);

	// Optional Ctrl+Enter submission for modal forms
	useEffect(() => {
		if (!isOpen || !submitOnCtrlEnter) return;

		const handleKeyDown = (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
				if (isTopModal(modalId) && onSubmitRef.current) {
					e.preventDefault();
					onSubmitRef.current(e);
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, submitOnCtrlEnter, modalId]);

	return {
		modalId,
		isTop: isTopModal(modalId),
		hasActiveModals,
	};
}

export default useModal;
