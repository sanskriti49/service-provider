import ConfirmDialog from "./ConfirmDialog";

/**
 * Backwards-compatible ConfirmModal adapter that renders the unified ConfirmDialog.
 */
export default function ConfirmModal({
	isOpen,
	onClose,
	onConfirm,
	title = "Are you sure?",
	message = "This action cannot be undone.",
	confirmText = "Yes, continue",
	cancelText = "Cancel",
	variant = "danger",
	loading = false,
}) {
	return (
		<ConfirmDialog
			isOpen={isOpen}
			onClose={onClose}
			onConfirm={onConfirm}
			title={title}
			description={message}
			confirmText={confirmText}
			cancelText={cancelText}
			variant={variant}
			loading={loading}
		/>
	);
}
