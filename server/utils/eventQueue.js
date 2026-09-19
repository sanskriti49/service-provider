const { EventEmitter } = require("events");
const sendEmail = require("./sendEmail");
const { sendNotification } = require("./notificationService");

/**
 * EventQueue provides an Event-Driven Architecture (EDA) worker queue.
 * Decouples slow I/O (transactional email, push notifications, external webhooks)
 * from synchronous HTTP request/response lifecycles.
 *
 * Enterprise Dual-Engine:
 * 1. Redis-backed BullMQ Queue & Worker: distributed, persistent, horizontal scaling.
 * 2. In-Memory Resilient Fallback: zero-downtime execution if Redis is unavailable/offline.
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

		this.bullQueue = null;
		this.bullWorker = null;
		this.isBullMqActive = false;

		this.registerDefaultHandlers();
		this._initBullMq();
	}

	_initBullMq() {
		const isTest =
			process.env.NODE_ENV === "test" ||
			process.argv.includes("--test") ||
			process.argv.some((a) => typeof a === "string" && a.includes("test"));

		// In unit test runs, keep pure in-memory queue to prevent open network handles
		if (isTest && !process.env.TEST_BULLMQ) {
			return;
		}

		try {
			const { getRedisClient, isRedisReady } = require("../config/redisClient");
			const redis = getRedisClient();

			redis.on("ready", () => {
				if (!this.bullQueue) {
					this._setupBullMq();
				}
			});

			if (isRedisReady() && !this.bullQueue) {
				this._setupBullMq();
			}
		} catch (_) {}
	}

	_setupBullMq() {
		try {
			const { Queue, Worker } = require("bullmq");
			const { getRedisClient, createRedisClient } = require("../config/redisClient");

			const queueClient = getRedisClient();
			const workerClient = createRedisClient();

			this.bullQueue = new Queue("taskgenie-events", {
				connection: queueClient,
				defaultJobOptions: {
					attempts: this.maxRetries,
					backoff: {
						type: "exponential",
						delay: 200,
					},
					removeOnComplete: { age: 3600, count: 500 },
					removeOnFail: { age: 86400, count: 1000 },
				},
			});

			this.bullQueue.on("error", (err) => {
				if (process.env.NODE_ENV !== "test") {
					console.warn("[BullMQ Queue Notice]:", err.message);
				}
			});

			this.bullWorker = new Worker(
				"taskgenie-events",
				async (job) => {
					const handler = this.handlers.get(job.name);
					if (!handler) {
						console.warn(`[BullMQ Worker] No registered handler for: ${job.name}`);
						return;
					}
					await handler(job.data, job);
				},
				{
					connection: workerClient,
					concurrency: this.concurrency,
				},
			);

			this.bullWorker.on("completed", (job) => {
				this.stats.processed++;
				try {
					const { eventQueueJobsTotal } = require("./metrics");
					eventQueueJobsTotal.inc({ event_type: job.name, status: "success" });
				} catch (_) {}
				this.emit("job:completed", { id: job.id, eventType: job.name, data: job.data });
			});

			this.bullWorker.on("failed", (job, err) => {
				if (job && job.attemptsMade >= job.opts.attempts) {
					this.stats.failed++;
					try {
						const { eventQueueJobsTotal } = require("./metrics");
						eventQueueJobsTotal.inc({ event_type: job.name, status: "failed" });
					} catch (_) {}
					this.emit("job:dead_letter", { job, error: err.message });
					console.error(`[BullMQ Worker] Job ${job.id} permanently failed and moved to DLQ.`);
				}
			});

			this.bullWorker.on("error", (err) => {
				if (process.env.NODE_ENV !== "test") {
					console.warn("[BullMQ Worker Notice]:", err.message);
				}
			});

			this.isBullMqActive = true;
			if (process.env.NODE_ENV !== "test") {
				console.log("🚀 [EventQueue] BullMQ persistent distributed worker initialized.");
			}
		} catch (err) {
			this.isBullMqActive = false;
		}
	}

	registerHandler(eventType, handler) {
		this.handlers.set(eventType, handler);
	}

	publish(eventType, data = {}, options = {}) {
		const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const job = {
			id: jobId,
			eventType,
			data,
			attempts: 0,
			maxRetries: options.maxRetries ?? this.maxRetries,
			createdAt: new Date(),
		};

		this.stats.queued++;
		this.emit("job:enqueued", job);

		let dispatchedViaBullMq = false;
		if (this.isBullMqActive && this.bullQueue) {
			try {
				const { isRedisReady } = require("../config/redisClient");
				if (isRedisReady()) {
					dispatchedViaBullMq = true;
					this.bullQueue
						.add(eventType, data, {
							jobId: job.id,
							attempts: job.maxRetries,
							backoff: { type: "exponential", delay: 200 },
						})
						.catch((err) => {
							console.warn(`[BullMQ Publish Fallback] routing to in-memory: ${err.message}`);
							this.queue.push(job);
							setImmediate(() => this._processNext());
						});
				}
			} catch (_) {}
		}

		if (!dispatchedViaBullMq) {
			this.queue.push(job);
			setImmediate(() => this._processNext());
		}

		return {
			jobId: job.id,
			status: "queued",
			enqueuedAt: job.createdAt,
			engine: dispatchedViaBullMq ? "bullmq" : "in-memory",
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
			if (process.env.NODE_ENV !== "test") {
				console.error(`[EventQueue] Error executing job ${job.id} (Attempt ${job.attempts}):`, err.message);
			}

			if (job.attempts < job.maxRetries) {
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
				if (process.env.NODE_ENV !== "test") {
					console.error(`[EventQueue] Job ${job.id} permanently failed and moved to Dead Letter Queue.`);
				}
			}
		} finally {
			this.processingCount--;
			if (this.queue.length > 0) {
				setImmediate(() => this._processNext());
			}
		}
	}

	registerDefaultHandlers() {
		this.registerHandler("SEND_EMAIL", async (data) => {
			const { email, subject, message } = data;
			if (!email) return;
			await sendEmail({ email, subject, message });
		});

		this.registerHandler("SEND_NOTIFICATION", async (data) => {
			const { userId, title, message, notifData } = data;
			if (!userId) return;
			await sendNotification(userId, title, message, notifData);
		});

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
		let engine = "in-memory";
		try {
			const { isRedisReady } = require("../config/redisClient");
			if (this.isBullMqActive && isRedisReady()) {
				engine = "bullmq";
			}
		} catch (_) {}

		return {
			...this.stats,
			pending: this.queue.length,
			active: this.processingCount,
			engine,
		};
	}

	async close() {
		if (this.bullWorker) {
			await this.bullWorker.close();
		}
		if (this.bullQueue) {
			await this.bullQueue.close();
		}
	}
}

const eventQueue = new EventQueue();
module.exports = eventQueue;
