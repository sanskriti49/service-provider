const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

// A listening socket alone is insufficient: the API must be able to query its DB.
async function waitForReady(url, { signal, timeoutMs = 60000, intervalMs = 300, probeTimeoutMs = 2000 } = {}) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		signal?.throwIfAborted();
		const ready = await new Promise((resolve, reject) => {
			const request = http.get(url, { signal }, response => {
				let body = '';
				response.on('data', chunk => { body += chunk; });
				response.on('end', () => {
					try { resolve(response.statusCode === 200 && JSON.parse(body).status === 'ready'); }
					catch { resolve(false); }
				});
				response.on('error', () => resolve(false));
			});
			request.setTimeout(Math.min(probeTimeoutMs, Math.max(1, deadline - Date.now())), () => request.destroy());
			request.on('error', error => signal?.aborted ? reject(error) : resolve(false));
		});
		if (ready) return;
		await delay(Math.min(intervalMs, Math.max(1, deadline - Date.now())), undefined, { signal });
	}
	throw new Error(`API did not become ready within ${timeoutMs / 1000}s. Check the server/database logs above.`);
}

async function assertPortAvailable(port) {
	await new Promise((resolve, reject) => {
		// A bind probe can coexist with a dual-stack listener on Windows. Connect
		// to the actual proxy target so an older API cannot satisfy our readiness.
		const probe = net.createConnection({ port, host: '127.0.0.1' });
		probe.once('connect', () => {
			probe.destroy();
			reject(new Error(`Port ${port} is already in use. Stop the existing API before running npm run dev.`));
		});
		probe.once('error', error => error.code === 'ECONNREFUSED' ? resolve() : reject(error));
		probe.setTimeout(1500, () => { probe.destroy(); reject(new Error(`Could not check API port ${port}.`)); });
	});
}

async function stopChild(child) {
	if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
	if (process.platform === 'win32') {
		await new Promise(resolve => {
			const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
			killer.once('error', resolve);
			killer.once('exit', resolve);
		});
	} else {
		try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already exited */ }
	}
}

async function runDev({ root = path.resolve(__dirname, '..'), env = process.env, start, checkPort = assertPortAvailable, readiness = waitForReady, log = console.log } = {}) {
	const dotenv = require(path.join(root, 'server/node_modules/dotenv'));
	const envPath = path.join(root, 'server/.env');
	const fileEnv = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
	const port = Number(env.PORT || fileEnv.PORT || 3000);
	if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
	await checkPort(port);
	const controller = new AbortController();
	const children = [];
	let childFailure;
	let stopping = false;
	const launch = start || ((entry, cwd, childEnv) => spawn(process.execPath, ['--max-http-header-size=16384', entry], {
		cwd, env: childEnv, stdio: 'inherit', windowsHide: true, detached: process.platform !== 'win32',
	}));
	const launchChild = (entry, directory, childEnv) => {
		const child = launch(path.join(root, directory, entry), path.join(root, directory), childEnv);
		children.push(child);
		child.once('error', error => { childFailure = error; controller.abort(); });
		child.once('exit', (code, signal) => {
			if (!stopping) {
				childFailure = new Error(`${directory} exited (${signal || code}).`);
				controller.abort();
			}
		});
		return child;
	};
	const onStop = () => { stopping = true; controller.abort(); };
	process.once('SIGINT', onStop);
	process.once('SIGTERM', onStop);
	try {
		launchChild('node_modules/nodemon/bin/nodemon.js', 'server', env);
		const target = `http://127.0.0.1:${port}`;
		log('[dev] Waiting for API readiness before starting Vite…');
		await readiness(`${target}/health/ready`, { signal: controller.signal });
		controller.signal.throwIfAborted();
		log('[dev] API ready. Starting Vite.');
		launchChild('node_modules/vite/bin/vite.js', 'client', { ...env, TASKGENIE_DEV_API_TARGET: target });
		await new Promise(resolve => {
			if (controller.signal.aborted) resolve();
			else controller.signal.addEventListener('abort', resolve, { once: true });
		});
	} catch (error) {
		if (!stopping) throw childFailure || error;
	} finally {
		stopping = true;
		controller.abort();
		await Promise.all(children.map(stopChild));
		process.removeListener('SIGINT', onStop);
		process.removeListener('SIGTERM', onStop);
	}
	if (childFailure) throw childFailure;
}

if (require.main === module) runDev().catch(error => { console.error(`[dev] ${error.message}`); process.exitCode = 1; });
module.exports = { waitForReady, runDev };
