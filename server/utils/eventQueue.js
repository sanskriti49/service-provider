const { EventEmitter } = require("events");
const sendEmail = require("./sendEmail");
const { sendNotification } = require("./notificationService");

/**
 * EventQueue provides an Event-Driven Architecture (EDA) worker queue.
 * Decouples slow I/O (transactional email, push notifications, external webhooks)
 * from synchronous HTTP request/response lifecycles.
 *
 * Supports:
 * - Asynchronous background execution
 * - Concurrency control
 * - Automatic retry with exponential backoff
 * - Dead-letter failure tracking
 * - Extensible to Redis/BullMQ / AWS SQS
 */
class EventQueue extends EventEmitter {
	constructor(options = {}) {
		super();
		this.concurrency = options.concurrency || 5;
		this.maxRetries = options.maxRetries || 3;
		this.queue = [];
		this.processingCount = 0;
		this.handlers = new Map();
		this.stats = {
			queued: 0,
			processed: 0,
			failed: 0,
		};

		this.registerDefaultHandlers();
	}

	registerHandler(eventType, handler) {
		this.handlers.set(eventType, handler);
	}

	publish(eventType, data = {}, options = {}) {
		const job = {
			id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			eventType,
			data,
			attempts: 0,
			maxRetries: options.maxRetries ?? this.maxRetries,
			createdAt: new Date(),
		};

		this.queue.push(job);
		this.stats.queued++;
		this.emit("job:enqueued", job);

		// Trigger worker process tick asynchronously
		setImmediate(() => this._processNext());

		return {
			jobId: job.id,
			status: "queued",
			enqueuedAt: job.createdAt,
		};
	}

	async _processNext() {
		if (this.processingCount >= this.concurrency || this.queue.length === 0) {
			return;
		}

		const job = this.queue.shift();
		this.processingCount++;

		const handler = this.handlers.get(job.eventType);
		if (!handler) {
			console.warn(`[EventQueue] No registered handler for event type: ${job.eventType}`);
			this.processingCount--;
			this.stats.failed++;
			return;
		}

		try {
			job.attempts++;
			await handler(job.data, job);
			this.stats.processed++;
			try {
				const { eventQueueJobsTotal } = require("./metrics");
				eventQueueJobsTotal.inc({ event_type: job.eventType, status: "success" });
			} catch (_) {}
			this.emit("job:completed", job);
		} catch (err) {
			console.error(`[EventQueue] Error executing job ${job.id} (Attempt ${job.attempts}):`, err.message);

			if (job.attempts < job.maxRetries) {
				// Exponential backoff: 200ms, 400ms, 800ms...
				const delayMs = Math.pow(2, job.attempts) * 100;
				setTimeout(() => {
					this.queue.unshift(job);
					this._processNext();
				}, delayMs);
			} else {
				this.stats.failed++;
				try {
					const { eventQueueJobsTotal } = require("./metrics");
					eventQueueJobsTotal.inc({ event_type: job.eventType, status: "failed" });
				} catch (_) {}
				this.emit("job:dead_letter", { job, error: err.message });
				console.error(`[EventQueue] Job ${job.id} permanently failed and moved to Dead Letter Queue.`);
			}
		} finally {
			this.processingCount--;
			if (this.queue.length > 0) {
				setImmediate(() => this._processNext());
			}
		}
	}

	registerDefaultHandlers() {
		// Handler for sending individual emails
		this.registerHandler("SEND_EMAIL", async (data) => {
			const { email, subject, message } = data;
			if (!email) return;
			await sendEmail({ email, subject, message });
		});

		// Handler for in-app push/socket notifications
		this.registerHandler("SEND_NOTIFICATION", async (data) => {
			const { userId, title, message, notifData } = data;
			if (!userId) return;
			await sendNotification(userId, title, message, notifData);
		});

		// Handler for composite booking status notifications
		this.registerHandler("BOOKING_STATUS_CHANGED", async (data) => {
			const { status, userRole, currentBooking, refundPercentage } = data;
			if (!currentBooking) return;

			const {
				user_email,
				user_name,
				provider_email,
				provider_name,
				service_name,
				booking_date,
				start_time,
			} = currentBooking;

			const signature = "\n\nBest regards,\nTaskGenie Team";
			const emailsToSend = [];

			if (status === "confirmed") {
				if (user_email) {
					emailsToSend.push({
						email: user_email,
						subject: `Booking Confirmed - ${service_name || "Service"}`,
						message: `Hi ${user_name}, your booking for ${service_name || "Service"} on ${booking_date} at ${start_time} is confirmed.` + signature,
					});
				}
				if (provider_email) {
					emailsToSend.push({
						email: provider_email,
						subject: `New Job Assigned - ${service_name || "Service"}`,
						message: `Hi ${provider_name}, you have a confirmed booking for ${service_name || "Service"} on ${booking_date} at ${start_time}.` + signature,
					});
				}
			} else if (status === "completed") {
				if (user_email) {
					emailsToSend.push({
						email: user_email,
						subject: `Service Completed 🎉 - ${service_name || "TaskGenie Service"}`,
						message:
							`Hi ${user_name || "Customer"},\n\nYour service for "${service_name || "Service"}" has been successfully completed and verified with your 4-digit completion OTP.\n\nThank you for choosing TaskGenie!` +
							signature,
					});
				}
				if (provider_email) {
					emailsToSend.push({
						email: provider_email,
						subject: `Job Completed Successfully 💰 - ${service_name || "TaskGenie Service"}`,
						message:
							`Hi ${provider_name || "Partner"},\n\nYou have successfully completed the service for "${user_name || "Customer"}". The completion OTP was verified and your earnings have been credited.` +
							signature,
					});
				}
			} else if (status === "cancelled") {
				const refundMsg = refundPercentage !== undefined
					? `Refund of ${refundPercentage}% has been processed.`
					: "";
				if (user_email) {
					emailsToSend.push({
						email: user_email,
						subject: `Booking Cancelled - ${service_name || "Service"}`,
						message: `Hi ${user_name}, your booking has been cancelled. ${refundMsg}` + signature,
					});
				}
				if (provider_email) {
					emailsToSend.push({
						email: provider_email,
						subject: `Booking Cancelled - ${service_name || "Service"}`,
						message: `Hi ${provider_name}, the booking for ${service_name || "Service"} was cancelled.` + signature,
					});
				}
			}

			for (const emailObj of emailsToSend) {
				try {
					await sendEmail(emailObj);
				} catch (e) {
					console.warn(`[EventQueue] Failed to deliver email to ${emailObj.email}:`, e.message);
				}
			}
		});
	}

	getStats() {
		return {
			...this.stats,
			pending: this.queue.length,
			active: this.processingCount,
		};
	}
}

const eventQueue = new EventQueue();
module.exports = eventQueue;
