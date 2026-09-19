const CircuitBreaker = require("opossum");
const { circuitBreakerStateGauge } = require("./metrics");

const breakers = new Map();

function createProtectedBreaker(actionFn, options = {}) {
	const defaultOptions = {
		timeout: options.timeout || 8000,
		errorThresholdPercentage: options.errorThresholdPercentage || 50,
		resetTimeout: options.resetTimeout || 20000,
		rollingCountTimeout: 10000,
		rollingCountBuckets: 10,
		name: options.name || "generic-breaker",
	};

	const breaker = new CircuitBreaker(actionFn, defaultOptions);
	const name = defaultOptions.name;

	breaker.on("open", () => {
		if (process.env.NODE_ENV !== "test") {
			console.warn(`⚠️ [CircuitBreaker] Circuit opened for ${name}. Downstream service failing.`);
		}
		try {
			circuitBreakerStateGauge.set({ service: name }, 2);
		} catch (_) {}
	});

	breaker.on("halfOpen", () => {
		if (process.env.NODE_ENV !== "test") {
			console.info(`🔄 [CircuitBreaker] Circuit half-open for ${name}. Testing recovery.`);
		}
		try {
			circuitBreakerStateGauge.set({ service: name }, 1);
		} catch (_) {}
	});

	breaker.on("close", () => {
		if (process.env.NODE_ENV !== "test") {
			console.info(`✅ [CircuitBreaker] Circuit closed for ${name}. Downstream service restored.`);
		}
		try {
			circuitBreakerStateGauge.set({ service: name }, 0);
		} catch (_) {}
	});

	// Initialize state gauge to 0 (healthy/closed)
	try {
		circuitBreakerStateGauge.set({ service: name }, 0);
	} catch (_) {}

	breakers.set(name, breaker);
	return breaker;
}

function getCircuitBreakerStatus() {
	const status = {};
	for (const [name, breaker] of breakers.entries()) {
		status[name] = {
			state: breaker.opened ? "open" : breaker.halfOpen ? "half-open" : "closed",
			stats: breaker.stats,
		};
	}
	return status;
}

module.exports = {
	createProtectedBreaker,
	getCircuitBreakerStatus,
	breakers,
};
