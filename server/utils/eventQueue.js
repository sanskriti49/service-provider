const { EventEmitter } = require("node:events");
const { Queue, Worker, UnrecoverableError } = require("bullmq");
const { NotificationOutbox, jobIdFor } = require("./notificationOutbox");

// Durable intent lives in PostgreSQL; BullMQ schedules delivery and retries.
// No volatile execution fallback: Redis downtime leaves work in the outbox.
class EventQueue extends EventEmitter {
	constructor(options = {}) {
		super();
		this.options = options;
		this.concurrency = options.concurrency ?? 5;
		this.maxAttempts = options.maxAttempts ?? 3;
		this.queueName = options.queueName || "taskgenie-events-v2";
		this.pollMs = options.pollMs ?? 1000;
		this.reconcileMs = options.reconcileMs ?? 30000;
		this.backoffMs = options.backoffMs ?? 1000;
		this.handlers = new Map();
		this.started = false;
		this.closing = false;
		this.dispatching = null;
		this.background = new Set();
		this.registerDefaultHandlers();
	}

	get store() {
		if (!this._store) this._store = new NotificationOutbox(this.options.db || require("../config/db"));
		return this._store;
	}

	registerHandler(eventType, handler) { this.handlers.set(eventType, handler); }

	registerDefaultHandlers() {
		this.registerHandler("SEND_EMAIL", async (data, job) => {
			if (!data.email || !data.subject || !data.message) throw new UnrecoverableError("Email job is missing required fields");
			const sendEmail = this.options.sendEmail || require("./sendEmail");
			// Stable across automatic retries. SMTP still cannot guarantee exactly-once delivery.
			await sendEmail({ ...data, messageId: `<${job.id}@taskgenie.local>` });
		});
		this.registerHandler("SEND_NOTIFICATION", async (data) => {
			if (!data.userId || !data.title || !data.message) throw new UnrecoverableError("Notification job is missing required fields");
			const { sendNotification } = require("./notificationService");
			const result = await sendNotification({ ...data, data: data.notifData || data.data || {} }, undefined, { throwOnError: true });
			if (!result) throw new Error("Notification was not persisted");
		});
	}

	async publish(eventType, data = {}, options = {}) {
		if (!this.handlers.has(eventType)) throw new Error(`No registered handler for ${eventType}`);
		const row = await this.store.enqueue(eventType, data, {
			client: options.client, maxAttempts: options.maxAttempts ?? options.maxRetries ?? this.maxAttempts,
		});
		// Caller-owned transactions must commit before another connection can dispatch.
		return { jobId: row.id, status: options.client ? "recorded-in-transaction" : "pending", engine: "postgres-outbox" };
	}

	start() {
		if (this.started) return;
		this.started = true;
		this.closing = false;
		this.redis = this.options.redis || require("../config/redisClient");
		this.onRedisReady = () => {
			if (!this.closing && !this.bullQueue) this.setupBullMq();
		};
		this.redis.getRedisClient().on("ready", this.onRedisReady);
		if (this.redis.isRedisReady()) this.setupBullMq();
		this.timer = setInterval(() => {
			this.flush().catch((error) => console.error("Notification outbox dispatch failed:", error.message));
		}, this.pollMs);
		this.timer.unref();
	}

	setupBullMq() {
		// Fail producer commands promptly; the outbox retries dispatch later.
		this.producerClient = this.redis.createRedisClient({ maxRetriesPerRequest: 1, enableOfflineQueue: false, commandTimeout: 5000 });
		this.workerClient = this.redis.createRedisClient({ maxRetriesPerRequest: null });
		this.bullQueue = new Queue(this.queueName, { connection: this.producerClient });
		this.bullWorker = new Worker(this.queueName, (job) => this.processJob(job), {
			connection: this.workerClient, concurrency: this.concurrency,
			...(this.options.workerOptions || {}),
		});
		for (const emitter of [this.bullQueue, this.bullWorker]) {
			emitter.on("error", (error) => {
				if (!this.closing) console.warn("Notification queue connection:", error.message);
			});
		}
		this.bullWorker.on("failed", (job, error) => {
			if (!job || (job.attemptsMade < job.opts.attempts && !(error instanceof UnrecoverableError))) return;
			const task = this.store.fail(job.data.outboxId, job.data.generation, error, true)
				.then(() => this.emit("job:failed", { id: job.data.outboxId, error: error.message }))
				.catch((err) => console.error("Recording notification failure failed:", err.message));
			this.background.add(task);
			task.finally(() => this.background.delete(task));
		});
	}

	async processJob(job) {
		const { outboxId, generation } = job.data;
		const row = await this.store.beginAttempt(outboxId, generation);
		if (!row) {
			const existing = await this.store.get(outboxId);
			if (!existing) throw new UnrecoverableError("Missing notification outbox row");
			if (existing.generation !== generation || ["completed", "failed"].includes(existing.status)) return;
			await this.store.fail(outboxId, generation, new Error("Delivery attempt budget exhausted"), true);
			throw new UnrecoverableError("Delivery attempt budget exhausted");
		}
		try {
			const handler = this.handlers.get(row.event_type);
			if (!handler) throw new UnrecoverableError(`No registered handler for ${row.event_type}`);
			await handler(row.payload, job);
			await this.store.complete(row.id, generation);
			this.count(row.event_type, "success");
			this.emit("job:completed", { id: row.id, eventType: row.event_type });
		} catch (error) {
			const terminal = error instanceof UnrecoverableError || row.attempts >= row.max_attempts;
			await this.store.fail(row.id, generation, error, terminal);
			if (terminal) this.count(row.event_type, "failed");
			throw error;
		}
	}

	count(eventType, status) {
		const { eventQueueJobsTotal } = require("./metrics");
		eventQueueJobsTotal.inc({ event_type: eventType, status });
	}

	async flush() {
		if (this.closing || !this.bullQueue || !this.redis.isRedisReady()) return;
		if (this.dispatching) return this.dispatching;
		this.dispatching = this.dispatchBatch();
		try { return await this.dispatching; }
		finally { this.dispatching = null; }
	}

	async dispatchBatch() {
		const rows = await this.store.claim();
		for (const row of rows) {
			try {
				const id = jobIdFor(row);
				const existing = await this.bullQueue.getJob(id);
				const state = existing && await existing.getState();
				if (state === "failed") {
					await this.store.fail(row.id, row.generation, new Error(existing.failedReason), true);
					continue;
				}
				if (state === "completed") {
					await this.store.complete(row.id, row.generation);
					continue;
				}
				if (!existing || state === "unknown") {
					await this.bullQueue.add(row.event_type, { outboxId: row.id, generation: row.generation }, {
						jobId: id, attempts: Math.max(1, row.max_attempts - row.attempts),
						backoff: { type: "exponential", delay: this.backoffMs },
						removeOnComplete: { age: 3600, count: 500 },
						removeOnFail: { age: 86400, count: 1000 },
					});
				}
				// Await Redis acceptance; retrying dispatch uses the same stable job id.
				await this.store.dispatched(row, this.reconcileMs);
			} catch (error) {
				await this.store.dispatchFailed(row, error);
			}
		}
	}

	async getStats() {
		return {
			...await this.store.summary(),
			engine: this.bullQueue && this.redis?.isRedisReady() ? "bullmq" : "postgres-outbox",
			durable: true,
		};
	}

	async close() {
		this.closing = true;
		clearInterval(this.timer);
		if (this.onRedisReady) this.redis.getRedisClient().off("ready", this.onRedisReady);
		if (this.dispatching) await this.dispatching;
		if (this.bullWorker) await this.bullWorker.close();
		await Promise.allSettled([...this.background]);
		if (this.bullQueue) await this.bullQueue.close();
		// BullMQ doesn't own externally supplied ioredis clients.
		this.producerClient?.disconnect();
		this.workerClient?.disconnect();
	}
}

const eventQueue = new EventQueue();
module.exports = eventQueue;
module.exports.EventQueue = EventQueue;
