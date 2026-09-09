import { toast } from "sonner";

/**
 * Coherent, B2B-grade notification utility wrapping Sonner.
 * Ensures consistent title/description layout, compact footprint,
 * and restrained semantic styling across the application.
 */
export const notify = {
	success: (title, description) => {
		return toast.success(title, {
			description,
			duration: 3500,
		});
	},

	error: (title, description) => {
		return toast.error(title, {
			description,
			duration: 4500,
		});
	},

	warning: (title, description) => {
		return toast.warning(title, {
			description,
			duration: 4000,
		});
	},

	info: (title, description) => {
		return toast.info(title, {
			description,
			duration: 3500,
		});
	},

	loading: (title, description) => {
		return toast.loading(title, {
			description,
		});
	},

	dismiss: (toastId) => {
		toast.dismiss(toastId);
	},

	promise: (promise, { loading, success, error }) => {
		return toast.promise(promise, {
			loading,
			success,
			error,
		});
	},
};

export default notify;
