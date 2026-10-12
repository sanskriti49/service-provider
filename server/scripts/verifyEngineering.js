// Intentionally does not load dotenv or application credentials. Every DB test
// opts into disposable fixtures; Razorpay, email and push delivery are stubbed.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "../..");
if (!process.env.BOOKING_TEST_DATABASE_URL || !process.env.CHAT_TEST_DATABASE_URL) {
	console.error("Set BOOKING_TEST_DATABASE_URL and CHAT_TEST_DATABASE_URL to a disposable PostgreSQL database. No application DATABASE_URL fallback is allowed.");
	process.exit(1);
}
const outputIndex = process.argv.indexOf("--output");
if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new Error("--output needs a directory");
const output = path.resolve(root, outputIndex >= 0 ? process.argv[outputIndex + 1] : "work/engineering-evidence");
fs.mkdirSync(output, { recursive: true });
const concurrencyFile = path.join(output, "concurrency.json");
if (fs.existsSync(concurrencyFile)) fs.unlinkSync(concurrencyFile);
const suites = [{ name: "backend", files: [
	"server/test/bookingIntegrity.integration.test.js", "server/test/chat.test.js",
	"server/test/bookingConcurrencyAndSecurity.test.js", "server/test/bookingPaymentFlow.test.js",
	"server/test/bookingCompletionOtp.test.js", "server/test/health.test.js",
] }, { name: "client-state", files: ["client/test/chatState.test.js"] }];
if (process.argv.includes("--browser")) suites.push({ name: "browser", files: ["client/test/chat.browser.cjs"] });
const sourceFiles = [...new Set([...suites.flatMap((suite) => suite.files),
	"server/scripts/verifyEngineering.js", "server/utils/bookingLifecycle.js", "server/services/paymentService.js",
	"server/services/bookingSchedule.js", "server/controllers/bookingController.js", "server/utils/chatService.js",
	"server/utils/socket.js", "server/routes/bookingRoutes.js", "server/routes/chatRoutes.js", "server/routes/healthRoutes.js",
	"server/migrations/20261011_booking_integrity.sql", "server/migrations/20261010_booking_chat.sql",
	"client/src/chat/useConversation.js", "client/src/chat/chatTransport.js", "client/src/chat/chatState.js",
	"client/src/chat/ChatPanel.jsx", "client/package-lock.json", "server/package-lock.json",
])].sort();
const sourceHash = createHash("sha256");
for (const filename of sourceFiles) sourceHash.update(filename + "\0").update(fs.readFileSync(path.join(root, filename))).update("\0");
let revision = "unavailable", dirty = true;
try {
	revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
	dirty = Boolean(execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim());
} catch { /* Git is optional for downloaded source archives. */ }
const report = { measuredAt: new Date().toISOString(), revision, dirty, node: process.version,
	sourceSha256: sourceHash.digest("hex"), sourceFiles,
	platform: process.platform, browserRequested: process.argv.includes("--browser"), suites: [],
	limitations: ["Synthetic local fixtures; external gateway and notification delivery stubbed.",
		"Contention disables Redis admission and rate limiting to exercise PostgreSQL protection.",
		"Not a production throughput benchmark, real payment capture, or AWS deployment verification."] };
for (const suite of suites) {
	console.log(`Verifying ${suite.name}...`);
	const child = spawnSync(process.execPath, ["--test", ...suite.files], {
		cwd: root, encoding: "utf8", timeout: 210000, maxBuffer: 8 * 1024 * 1024,
		env: { ...process.env, NODE_ENV: "test", TASKGENIE_EVIDENCE_DIR: output },
	});
	const log = (child.stdout || "") + (child.stderr || "");
	fs.writeFileSync(path.join(output, `${suite.name}.tap`), log);
	const count = (label) => { const match = log.match(new RegExp(`^# ${label} (\\d+)$`, "m")); return match ? Number(match[1]) : null; };
	const result = { name: suite.name, passed: child.status === 0 && count("fail") === 0 && count("skipped") === 0 && count("pass") > 0,
		tests: count("tests"), pass: count("pass"), fail: count("fail"), skipped: count("skipped"), exitCode: child.status,
		...(child.error ? { error: child.error.code || "runner-error" } : {}) };
	report.suites.push(result);
	console.log(JSON.stringify(result));
}
report.passed = report.suites.every((suite) => suite.passed) && fs.existsSync(concurrencyFile);
fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(report, null, 2) + "\n");
console.log(`Evidence saved to ${output}`);
process.exitCode = report.passed ? 0 : 1;
