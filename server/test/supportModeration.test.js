const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

function mockResponse() {
	let resolveDone;
	const donePromise = new Promise((resolve) => {
		resolveDone = resolve;
	});

	return {
		statusCode: 200,
		data: null,
		headers: {},
		done: donePromise,
		status(code) {
			this.statusCode = code;
			return this;
		},
		json(payload) {
			this.data = payload;
			resolveDone();
			return this;
		},
		send(payload) {
			this.data = payload;
			resolveDone();
			return this;
		},
		setHeader(k, v) {
			this.headers[k] = v;
			return this;
		},
	};
}

function createSupportModerationHarness(options = {}) {
	const users = [
		{
			id: "11111111-1111-4111-8111-111111111111",
			name: "Admin User",
			email: "admin@taskgenie.com",
			role: "admin",
		},
		{
			id: "22222222-2222-4222-8222-222222222222",
			name: "Staff Moderator",
			email: "mod@taskgenie.com",
			role: "admin",
		},
		{
			id: "33333333-3333-4333-8333-333333333333",
			name: "Customer Jane",
			email: "jane@example.com",
			role: "customer",
		},
		{
			id: "44444444-4444-4444-8444-444444444444",
			name: "Provider Bob",
			email: "bob@example.com",
			role: "provider",
			custom_id: "SRVBOB1234567890",
		},
		{
			id: "77777777-7777-4777-8777-777777777777",
			name: "Customer Alice",
			email: "alice@example.com",
			role: "customer",
		},
	];

	const providers = [
		{
			user_id: "44444444-4444-4444-8444-444444444444",
			status: "approved",
		},
	];

	const supportTickets = [
		{
			id: 1,
			ticket_number: "TK1001",
			user_id: "33333333-3333-4333-8333-333333333333",
			name: "Customer Jane",
			email: "jane@example.com",
			role: "customer",
			category: "refund",
			priority: "urgent",
			subject: "Duplicate charge on booking",
			message: "I was billed twice for my plumbing service.",
			status: "open",
			assigned_to: null,
			resolution_notes: null,
			resolved_at: null,
			resolved_by: null,
			created_at: new Date("2026-10-20T08:00:00Z"),
			updated_at: new Date("2026-10-20T08:00:00Z"),
		},
		{
			id: 2,
			ticket_number: "TK1002",
			user_id: "44444444-4444-4444-8444-444444444444",
			name: "Provider Bob",
			email: "bob@example.com",
			role: "provider",
			category: "kyc",
			priority: "normal",
			subject: "Aadhaar verification update",
			message: "Uploaded my new address proof.",
			status: "in_progress",
			assigned_to: "11111111-1111-4111-8111-111111111111",
			resolution_notes: null,
			resolved_at: null,
			resolved_by: null,
			created_at: new Date("2026-10-19T10:00:00Z"),
			updated_at: new Date("2026-10-19T12:00:00Z"),
		},
		{
			id: 3,
			ticket_number: "TK1003",
			user_id: null,
			name: "Guest Dave",
			email: "dave.guest@example.com",
			role: "customer",
			category: "booking",
			priority: "normal",
			subject: "Cannot access confirmation email",
			message: "Booked as guest and need my slot details.",
			status: "open",
			assigned_to: null,
			resolution_notes: null,
			resolved_at: null,
			resolved_by: null,
			created_at: new Date("2026-10-20T07:30:00Z"),
			updated_at: new Date("2026-10-20T07:30:00Z"),
		},
	];

	const supportReplies = [
		{
			id: 1,
			ticket_id: 2,
			sender_id: "11111111-1111-4111-8111-111111111111",
			sender_name: "Admin User",
			sender_role: "admin",
			message: "Checking the new document scan.",
			is_internal: true,
			created_at: new Date("2026-10-19T12:00:00Z"),
		},
	];

	const chatReports = [
		{
			id: "55555555-5555-4555-8555-555555555555",
			booking_id: "66666666-6666-4666-8666-666666666666",
			reporter_id: "33333333-3333-4333-8333-333333333333",
			reported_user_id: "44444444-4444-4444-8444-444444444444",
			message_id: "62",
			reason: "off_platform_payment",
			details: "Provider asked for direct UPI transfer outside app.",
			status: "pending",
			action_taken: null,
			assigned_to: null,
			resolution_notes: null,
			resolved_at: null,
			resolved_by: null,
			created_at: new Date("2026-10-20T09:00:00Z"),
			updated_at: new Date("2026-10-20T09:00:00Z"),
		},
		{
			id: "88888888-8888-4888-8888-888888888888",
			booking_id: "66666666-6666-4666-8666-666666666666",
			reporter_id: "33333333-3333-4333-8333-333333333333",
			reported_user_id: "44444444-4444-4444-8444-444444444444",
			message_id: "62",
			reason: "harassment",
			details: "Past resolved report.",
			status: "actioned",
			action_taken: "Official warning issued.",
			assigned_to: "11111111-1111-4111-8111-111111111111",
			resolution_notes: "Resolved previously.",
			resolved_at: new Date("2026-10-18T10:00:00Z"),
			resolved_by: "11111111-1111-4111-8111-111111111111",
			created_at: new Date("2026-10-18T09:00:00Z"),
			updated_at: new Date("2026-10-18T10:00:00Z"),
		},
	];

	// Create 65 messages fixture to verify context window centering on reported message (message 62)
	const chatMessages = [];
	for (let i = 1; i <= 65; i++) {
		chatMessages.push({
			id: String(i),
			booking_id: "66666666-6666-4666-8666-666666666666",
			sender_id: i % 2 === 1 ? users[2].id : users[3].id,
			body:
				i === 62
					? "Please pay me ₹500 directly on GPay before arrival."
					: `Booking conversation message #${i}`,
			created_at: new Date(new Date("2026-10-20T08:00:00Z").getTime() + i * 60000),
		});
	}

	const notifications = [];
	const queries = [];
	const cacheDeletions = [];
	const transactionState = { open: false, committed: false, rolledBack: false };
	let providersSnapshot = null;
	let reportsSnapshot = null;

	const queryHandler = async (sql, params = []) => {
		queries.push({ sql, params });

		if (sql.startsWith("BEGIN")) {
			transactionState.open = true;
			providersSnapshot = JSON.parse(JSON.stringify(providers));
			reportsSnapshot = JSON.parse(JSON.stringify(chatReports));
			return { rows: [] };
		}
		if (sql.startsWith("COMMIT")) {
			transactionState.open = false;
			transactionState.committed = true;
			return { rows: [] };
		}
		if (sql.startsWith("ROLLBACK")) {
			transactionState.open = false;
			transactionState.rolledBack = true;
			if (providersSnapshot) {
				providers.length = 0;
				providers.push(...providersSnapshot);
			}
			if (reportsSnapshot) {
				chatReports.length = 0;
				chatReports.push(...reportsSnapshot);
			}
			return { rows: [] };
		}

		// Users queries
		if (sql.includes("FROM users") && sql.includes("role = 'admin'")) {
			if (sql.includes("WHERE id = $1")) {
				const u = users.find((x) => x.id === params[0] && x.role === "admin");
				return { rows: u ? [u] : [] };
			}
			return { rows: users.filter((u) => u.role === "admin") };
		}
		if (sql.includes("SELECT name FROM users WHERE id = $1")) {
			const u = users.find((x) => x.id === params[0]);
			return { rows: u ? [{ name: u.name }] : [] };
		}

		// Support tickets queries
		if (sql.includes("FROM support_tickets")) {
			if (sql.includes("SELECT COUNT(*) AS total")) {
				return { rows: [{ total: String(supportTickets.length) }] };
			}
			if (sql.includes("COUNT(CASE WHEN status = 'open' THEN 1 END) AS open_count")) {
				const open = supportTickets.filter((t) => t.status === "open").length;
				const inProg = supportTickets.filter((t) => t.status === "in_progress").length;
				const resolved = supportTickets.filter((t) => t.status === "resolved").length;
				const closed = supportTickets.filter((t) => t.status === "closed").length;
				const unassigned = supportTickets.filter(
					(t) => !t.assigned_to && (t.status === "open" || t.status === "in_progress")
				).length;
				return {
					rows: [
						{
							all_count: String(supportTickets.length),
							open_count: String(open),
							in_progress_count: String(inProg),
							resolved_count: String(resolved),
							closed_count: String(closed),
							unassigned_count: String(unassigned),
						},
					],
				};
			}
			if (sql.includes("WHERE t.user_id = $1") || sql.includes("WHERE user_id = $1")) {
				const uid = params[0];
				const userTickets = supportTickets
					.filter((t) => t.user_id === uid)
					.map((t) => {
						const repCount = supportReplies.filter((r) => r.ticket_id === t.id && !r.is_internal).length;
						return { ...t, reply_count: repCount };
					});
				return { rows: userTickets };
			}
			if (
				sql.includes("WHERE st.id = $1") ||
				sql.includes("WHERE st.ticket_number = $1") ||
				sql.includes("WHERE t.ticket_number = $1") ||
				sql.includes("WHERE ticket_number = $1") ||
				sql.includes("WHERE id = $1")
			) {
				const target = params[0];
				const t = supportTickets.find((x) => x.ticket_number === target || x.id === target);
				if (!t) return { rows: [] };
				const au = users.find((u) => u.id === t.assigned_to);
				const ru = users.find((u) => u.id === t.resolved_by);
				return {
					rows: [
						{
							...t,
							assigned_to_name: au?.name || null,
							assigned_to_email: au?.email || null,
							assignee_name: au?.name || null,
							resolved_by_name: ru?.name || null,
						},
					],
				};
			}
			if (sql.includes("LEFT JOIN users au")) {
				const list = supportTickets.map((t) => {
					const au = users.find((u) => u.id === t.assigned_to);
					const repCount = supportReplies.filter((r) => r.ticket_id === t.id).length;
					return {
						...t,
						assigned_to_name: au?.name || null,
						assigned_to_email: au?.email || null,
						reply_count: repCount,
					};
				});
				return { rows: list };
			}
		}

		// Support replies
		if (sql.includes("FROM support_ticket_replies") && (sql.includes("ticket_id = $1") || sql.includes("r.ticket_id = $1"))) {
			const ticketId = params[0];
			let reps = supportReplies.filter((r) => r.ticket_id === ticketId);
			if (sql.includes("AND is_internal = false")) {
				reps = reps.filter((r) => !r.is_internal);
			}
			return { rows: reps };
		}
		if (sql.includes("INSERT INTO support_ticket_replies")) {
			const isInternal = sql.includes(", true)") ? true : (params[4] !== undefined ? Boolean(params[4]) : Boolean(params[5]));
			const message = params[3] !== undefined ? params[3] : params[4];
			const role = sql.includes("'admin'") ? "admin" : (params[3] || "customer");
			const newRep = {
				id: supportReplies.length + 1,
				ticket_id: params[0],
				sender_id: params[1],
				sender_name: params[2],
				sender_role: role,
				message: message,
				is_internal: isInternal,
				created_at: new Date(),
			};
			supportReplies.push(newRep);
			return { rows: [newRep] };
		}

		// Update support ticket
		if (sql.includes("UPDATE support_tickets")) {
			const ticketId = params[params.length - 1];
			const t = supportTickets.find((x) => x.id === ticketId);
			if (t) {
				if (sql.includes("SET assigned_to = $1, status = $2")) {
					t.assigned_to = params[0];
					t.status = params[1];
				} else if (sql.includes("SET status = $1")) {
					t.status = params[0];
					if (sql.includes("resolution_notes")) t.resolution_notes = params[1];
					if (params[2]) {
						t.resolved_at = new Date();
						t.resolved_by = params[3];
					}
				}
				t.updated_at = new Date();
				return { rows: [t] };
			}
			return { rows: [] };
		}

		// Chat reports queries
		if (sql.includes("FROM chat_reports")) {
			if (sql.includes("SELECT COUNT(*) AS total")) {
				return { rows: [{ total: String(chatReports.length) }] };
			}
			if (sql.includes("COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count")) {
				const pending = chatReports.filter((r) => r.status === "pending").length;
				const investigating = chatReports.filter((r) => r.status === "investigating").length;
				const actioned = chatReports.filter((r) => r.status === "actioned").length;
				const dismissed = chatReports.filter((r) => r.status === "dismissed").length;
				const unassigned = chatReports.filter(
					(r) => !r.assigned_to && (r.status === "pending" || r.status === "investigating")
				).length;
				return {
					rows: [
						{
							all_count: String(chatReports.length),
							pending_count: String(pending),
							investigating_count: String(investigating),
							actioned_count: String(actioned),
							dismissed_count: String(dismissed),
							unassigned_count: String(unassigned),
						},
					],
				};
			}
			if (sql.includes("WHERE cr.id = $1") || sql.includes("WHERE id = $1")) {
				const cr = chatReports.find((r) => r.id === params[0]);
				if (!cr) return { rows: [] };
				const rep = users.find((u) => u.id === cr.reporter_id) || {};
				const tar = users.find((u) => u.id === cr.reported_user_id) || {};
				const au = users.find((u) => u.id === cr.assigned_to);
				return {
					rows: [
						{
							...cr,
							reporter_name: rep.name,
							reporter_email: rep.email,
							reporter_role: rep.role,
							reported_name: tar.name,
							reported_email: tar.email,
							reported_role: tar.role,
							reported_custom_id: tar.custom_id || null,
							assigned_to_name: au?.name || null,
						},
					],
				};
			}
			if (sql.includes("JOIN users rep")) {
				const list = chatReports.map((cr) => {
					const rep = users.find((u) => u.id === cr.reporter_id) || {};
					const tar = users.find((u) => u.id === cr.reported_user_id) || {};
					const au = users.find((u) => u.id === cr.assigned_to);
					return {
						...cr,
						reporter_name: rep.name,
						reporter_email: rep.email,
						reporter_role: rep.role,
						reported_name: tar.name,
						reported_email: tar.email,
						reported_role: tar.role,
						reported_custom_id: tar.custom_id || null,
						assigned_to_name: au?.name || null,
					};
				});
				return { rows: list };
			}
		}

		// Chat messages queries (handles Postgres 'body' and context window around reported message)
		if (sql.includes("FROM chat_messages") || sql.includes("chat_messages cm")) {
			// Windowed context query around flagged message
			let msgs = chatMessages.map((m) => {
				const sender = users.find((u) => u.id === m.sender_id);
				return {
					id: m.id,
					booking_id: m.booking_id,
					sender_id: m.sender_id,
					body: m.body,
					message: m.body, // Postgres aliased cm.body AS message
					created_at: m.created_at,
					sender_name: sender?.name || "Unknown",
					sender_role: sender?.role || "user",
				};
			});

			if (sql.includes("UNION ALL")) {
				const mid = parseInt(params[1], 10);
				const before = msgs.filter((m) => parseInt(m.id, 10) <= mid).slice(-35);
				const after = msgs.filter((m) => parseInt(m.id, 10) > mid).slice(0, 35);
				msgs = [...before, ...after].sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
			}

			return { rows: msgs };
		}

		// Provider lookup
		if (sql.includes("FROM providers WHERE user_id = $1")) {
			const p = providers.find((x) => x.user_id === params[0]);
			return { rows: p ? [p] : [] };
		}

		// Provider update
		if (sql.includes("UPDATE providers SET status = 'suspended'")) {
			const p = providers.find((x) => x.user_id === params[0]);
			if (p) p.status = "suspended";
			return { rows: [] };
		}

		// Update chat reports
		if (sql.includes("UPDATE chat_reports")) {
			const crId = params[params.length - 1];
			const cr = chatReports.find((r) => r.id === crId);
			if (cr) {
				if (sql.includes("assigned_to = $1")) {
					cr.assigned_to = params[0];
					cr.status = params[1];
				} else if (sql.includes("action_taken = $2")) {
					cr.status = params[0];
					cr.action_taken = params[1];
					cr.resolution_notes = params[2] || cr.resolution_notes;
					cr.resolved_by = params[3];
					cr.resolved_at = new Date();
				}
				cr.updated_at = new Date();
				return { rows: [cr] };
			}
			return { rows: [] };
		}

		// Notifications insert (with failure simulation support)
		if (sql.includes("INSERT INTO notifications")) {
			if (options.failNotification) {
				throw new Error("Simulated Notification Service Failure (500)");
			}
			notifications.push({
				user_id: params[0],
				title: params[1],
				message: params[2],
				type: sql.includes("'support'") ? "support" : "system",
				data: params[3],
			});
			return { rows: [] };
		}

		return { rows: [] };
	};

	const clientMock = {
		query: queryHandler,
		release: () => queries.push({ sql: "release" }),
	};

	const dbMock = {
		connect: async () => clientMock,
		query: queryHandler,
	};

	const cacheMock = {
		delPattern: (pattern) => {
			cacheDeletions.push(pattern);
		},
		get: async () => null,
		set: async () => true,
		del: async () => true,
	};

	// 1. Load adminController
	const adminFilename = path.resolve(__dirname, "../controllers/adminController.js");
	const adminInstance = new Module(adminFilename, module);
	adminInstance.filename = adminFilename;
	adminInstance.paths = Module._nodeModulePaths(path.dirname(adminFilename));
	const origAdminReq = adminInstance.require.bind(adminInstance);
	adminInstance.require = (reqPath) => {
		if (reqPath === "../config/db") return dbMock;
		if (reqPath === "../utils/cache") return cacheMock;
		if (reqPath === "../routes/supportRoutes") return { ensureSupportTable: async () => {} };
		if (reqPath === "../utils/chatService") return { ensureChatReportsTable: async () => {} };
		return origAdminReq(reqPath);
	};
	adminInstance.load(adminFilename);

	// 2. Load supportRoutes
	const supportFilename = path.resolve(__dirname, "../routes/supportRoutes.js");
	const supportInstance = new Module(supportFilename, module);
	supportInstance.filename = supportFilename;
	supportInstance.paths = Module._nodeModulePaths(path.dirname(supportFilename));
	const origSupportReq = supportInstance.require.bind(supportInstance);
	supportInstance.require = (reqPath) => {
		if (reqPath === "../config/db") return dbMock;
		if (reqPath === "../utils/cache") return cacheMock;
		if (reqPath === "../controllers/accountController") return { submitFeedback: (req, res) => res.json({}) };
		return origSupportReq(reqPath);
	};
	supportInstance.load(supportFilename);

	return {
		controller: adminInstance.exports,
		routes: supportInstance.exports,
		generateTicketToken: supportInstance.exports.generateTicketToken,
		isValidTicketToken: supportInstance.exports.isValidTicketToken,
		users,
		supportTickets,
		supportReplies,
		chatReports,
		chatMessages,
		providers,
		notifications,
		cacheDeletions,
		transactionState,
		queries,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("adminController: getSupportTickets returns ticket list, count badges, and assignee details", async () => {
	const harness = createSupportModerationHarness();
	const req = {
		query: { status: "all", priority: "all", category: "all", assigned_to: "all" },
		user: { id: harness.users[0].id, role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.getSupportTickets(req, res, () => {});

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(res.data.tickets.length, 3);
	assert.equal(res.data.counts.all, 3);
	assert.equal(res.data.counts.open, 2);
	assert.equal(res.data.counts.in_progress, 1);
	const t2 = res.data.tickets.find((t) => t.ticket_number === "TK1002");
	assert.equal(t2.reply_count, 1);
	assert.equal(t2.assigned_to_name, "Admin User");
});

test("adminController: getSupportTicketById returns ticket details and all replies (public & internal)", async () => {
	const harness = createSupportModerationHarness();
	const req = {
		params: { id: 2 },
		user: { id: harness.users[0].id, role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.getSupportTicketById(req, res, () => {});

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(res.data.ticket.ticket_number, "TK1002");
	assert.equal(res.data.replies.length, 1);
	assert.equal(res.data.replies[0].is_internal, true);
	assert.equal(res.data.replies[0].message, "Checking the new document scan.");
});

test("adminController: assignSupportTicket sets ownership and advances 'open' ticket to 'in_progress'", async () => {
	const harness = createSupportModerationHarness();
	const req = {
		params: { id: 1 },
		body: { assigned_to: harness.users[1].id },
		user: { id: harness.users[0].id, name: "Admin Lead", role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.assignSupportTicket(req, res, () => {});

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(harness.supportTickets[0].assigned_to, harness.users[1].id);
	assert.equal(harness.supportTickets[0].status, "in_progress");
});

test("adminController: assignSupportTicket rejects non-admin assignee with 400 Bad Request", async () => {
	const harness = createSupportModerationHarness();
	const req = {
		params: { id: 1 },
		body: { assigned_to: harness.users[2].id }, // Customer Jane
		user: { id: harness.users[0].id, name: "Admin Lead", role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.assignSupportTicket(req, res, () => {});

	assert.equal(res.statusCode, 400);
	assert.match(res.data.error, /only be assigned to administrator staff/);
	assert.equal(harness.supportTickets[0].assigned_to, null);
});

test("adminController: replySupportTicket records customer reply and notifies customer", async () => {
	const harness = createSupportModerationHarness();
	const req = {
		params: { id: 1 },
		body: {
			message: "We reviewed your transaction and initiated the refund.",
			is_internal: false,
			status: "resolved",
		},
		user: { id: harness.users[0].id, name: "Admin Lead", role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.replySupportTicket(req, res, () => {});

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(res.data.reply.is_internal, false);
	assert.equal(harness.supportTickets[0].status, "resolved");

	const customerNotif = harness.notifications.find(
		(n) => n.user_id === harness.users[2].id && n.type === "support"
	);
	assert.ok(customerNotif, "Customer should receive notification on reply");
	assert.match(customerNotif.title, /Support Ticket/);
});

test("adminController: replySupportTicket with internal note does NOT notify customer", async () => {
	const harness = createSupportModerationHarness();
	const initialNotifsCount = harness.notifications.length;

	const req = {
		params: { id: 1 },
		body: {
			message: "Private note: Spoke with payment gateway representative.",
			is_internal: true,
		},
		user: { id: harness.users[0].id, name: "Admin Lead", role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.replySupportTicket(req, res, () => {});

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(res.data.reply.is_internal, true);
	assert.equal(harness.notifications.length, initialNotifsCount);
});

test("adminController: resolveSupportTicket tracks resolution notes, resolver user, and timestamp", async () => {
	const harness = createSupportModerationHarness();
	const req = {
		params: { id: 1 },
		body: {
			status: "resolved",
			resolution_notes: "Refund processed under ARN 987654321.",
		},
		user: { id: harness.users[0].id, name: "Admin Lead", role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.resolveSupportTicket(req, res, () => {});

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(harness.supportTickets[0].status, "resolved");
	assert.equal(harness.supportTickets[0].resolution_notes, "Refund processed under ARN 987654321.");
	assert.equal(harness.supportTickets[0].resolved_by, harness.users[0].id);
	assert.ok(harness.supportTickets[0].resolved_at);
});

test("adminController: getModerationReports surfaces reports with reporter and reported subjects", async () => {
	const harness = createSupportModerationHarness();
	const req = {
		query: { status: "all", reason: "all", assigned_to: "all" },
		user: { id: harness.users[0].id, role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.getModerationReports(req, res, () => {});

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(res.data.reports.length, 2);
	const rep = res.data.reports.find((r) => r.id === harness.chatReports[0].id);
	assert.equal(rep.reason, "off_platform_payment");
	assert.equal(rep.reporter_name, "Customer Jane");
	assert.equal(rep.reported_name, "Provider Bob");
	assert.equal(res.data.counts.pending, 1);
});

test("adminController: getModerationReportById includes surrounding chat messages context and centers on flagged message", async () => {
	const harness = createSupportModerationHarness();
	const req = {
		params: { id: harness.chatReports[0].id },
		user: { id: harness.users[0].id, role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.getModerationReportById(req, res, () => {});

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(res.data.report.reason, "off_platform_payment");

	// In a 65-message fixture, reported message #62 must be present in the returned messages context
	const flaggedMsg = res.data.messages.find((m) => m.id === "62");
	assert.ok(flaggedMsg, "Flagged message #62 must be included in surrounding context window");
	assert.match(flaggedMsg.body, /pay me ₹500 directly on GPay/);
	assert.match(flaggedMsg.message, /pay me ₹500 directly on GPay/);
});

test("adminController: assignModerationReport sets investigator, updates pending to investigating, and returns full joined dossier", async () => {
	const harness = createSupportModerationHarness();
	const req = {
		params: { id: harness.chatReports[0].id },
		body: { assigned_to: harness.users[1].id },
		user: { id: harness.users[0].id, role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.assignModerationReport(req, res, () => {});

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(harness.chatReports[0].assigned_to, harness.users[1].id);
	assert.equal(harness.chatReports[0].status, "investigating");

	// P2 #4: Returned report MUST retain joined fields so drawer never loses "Suspend Provider" button
	assert.equal(res.data.report.reported_name, "Provider Bob");
	assert.equal(res.data.report.reported_role, "provider");
	assert.equal(res.data.report.reporter_name, "Customer Jane");
});

test("adminController: assignModerationReport rejects non-admin assignee with 400 Bad Request", async () => {
	const harness = createSupportModerationHarness();
	const req = {
		params: { id: harness.chatReports[0].id },
		body: { assigned_to: harness.users[2].id }, // Customer Jane
		user: { id: harness.users[0].id, role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.assignModerationReport(req, res, () => {});

	assert.equal(res.statusCode, 400);
	assert.match(res.data.error, /only be assigned to administrator staff/);
	assert.equal(harness.chatReports[0].assigned_to, null);
});

test("adminController: actionModerationReport rejects invalid action values with 400 Bad Request", async () => {
	const harness = createSupportModerationHarness();
	const req = {
		params: { id: harness.chatReports[0].id },
		body: { action: "obliterate_account" },
		user: { id: harness.users[0].id, role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.actionModerationReport(req, res, () => {});

	assert.equal(res.statusCode, 400);
	assert.match(res.data.error, /Invalid moderation action/);
	assert.equal(harness.chatReports[0].status, "pending");
});

test("adminController: actionModerationReport prevents duplicate actions on already actioned report (409 Conflict)", async () => {
	const harness = createSupportModerationHarness();
	const req = {
		params: { id: harness.chatReports[1].id }, // Report #2 is already 'actioned'
		body: { action: "warn", warning_message: "Duplicate attempt" },
		user: { id: harness.users[0].id, role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.actionModerationReport(req, res, () => {});

	assert.equal(res.statusCode, 409);
	assert.match(res.data.error, /already been actioned/);
	assert.equal(harness.transactionState.rolledBack, true);
});

test("adminController: actionModerationReport with 'warn' dispatches safety warning to reported user", async () => {
	const harness = createSupportModerationHarness();
	const req = {
		params: { id: harness.chatReports[0].id },
		body: {
			action: "warn",
			warning_message: "Do not solicit payments outside TaskGenie.",
			notes: "First offense warning issued.",
		},
		user: { id: harness.users[0].id, role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.actionModerationReport(req, res, () => {});

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(harness.chatReports[0].status, "actioned");
	assert.equal(harness.chatReports[0].resolved_by, harness.users[0].id);
	assert.equal(harness.transactionState.committed, true);

	const warnNotif = harness.notifications.find(
		(n) => n.user_id === harness.users[3].id && n.title.includes("Trust & Safety Warning")
	);
	assert.ok(warnNotif, "Reported user must receive warning notification");
	assert.equal(warnNotif.message, "Do not solicit payments outside TaskGenie.");
});

test("adminController: actionModerationReport with 'suspend' sets provider status to suspended and purges cache", async () => {
	const harness = createSupportModerationHarness();
	const req = {
		params: { id: harness.chatReports[0].id },
		body: {
			action: "suspend",
			notes: "Suspended due to repeated payment extortion.",
		},
		user: { id: harness.users[0].id, role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.actionModerationReport(req, res, () => {});

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(harness.chatReports[0].status, "actioned");
	assert.equal(harness.providers[0].status, "suspended");
	assert.equal(harness.transactionState.committed, true);
	assert.ok(harness.cacheDeletions.includes("provider"), "Provider cache must be cleared on suspension");
});

test("adminController: actionModerationReport rejecting suspension of non-provider user returns 400 Bad Request", async () => {
	const harness = createSupportModerationHarness();
	// Switch reported user on report 0 to a customer
	harness.chatReports[0].reported_user_id = harness.users[2].id; // Customer Jane

	const req = {
		params: { id: harness.chatReports[0].id },
		body: {
			action: "suspend",
			notes: "Attempt to suspend customer as provider",
		},
		user: { id: harness.users[0].id, role: "admin" },
	};
	const res = mockResponse();

	await harness.controller.actionModerationReport(req, res, () => {});

	assert.equal(res.statusCode, 400);
	assert.match(res.data.error, /not a registered service provider/);
	assert.equal(harness.transactionState.rolledBack, true);
});

test("adminController: actionModerationReport rolls back entire transaction if notification fails", async () => {
	const harness = createSupportModerationHarness({ failNotification: true });
	const req = {
		params: { id: harness.chatReports[0].id },
		body: {
			action: "suspend",
			notes: "Testing rollback",
		},
		user: { id: harness.users[0].id, role: "admin" },
	};
	const res = mockResponse();
	let capturedErr = null;

	await harness.controller.actionModerationReport(req, res, (err) => {
		capturedErr = err;
	});

	assert.ok(capturedErr, "Error must be propagated to next(err)");
	assert.equal(harness.transactionState.rolledBack, true, "Transaction must be rolled back on notification failure");
	assert.equal(harness.providers[0].status, "approved", "Provider must NOT remain suspended after failed transaction");
	assert.equal(harness.chatReports[0].status, "pending", "Chat report must NOT remain actioned after rollback");
});

// ---------------------------------------------------------------------------
// Support Routes & Customer Reply Security Tests (P1 #1 & P2 #5)
// ---------------------------------------------------------------------------

function findRouteHandler(router, method, routePath) {
	for (const layer of router.stack) {
		if (layer.route && layer.route.path === routePath && layer.route.methods[method.toLowerCase()]) {
			return layer.route.stack;
		}
	}
	return null;
}

async function runRouteStack(stack, req, res) {
	for (const layer of stack) {
		let nextCalled = false;
		let nextError = null;

		const handlerResult = layer.handle(req, res, (err) => {
			nextCalled = true;
			nextError = err;
		});

		if (handlerResult && typeof handlerResult.then === "function") {
			await Promise.race([handlerResult, res.done]);
		} else {
			await Promise.race([res.done, new Promise((r) => setImmediate(r))]);
		}

		if (nextError) throw nextError;
		if (res.data !== null && !nextCalled) {
			break;
		}
	}
}

test("supportRoutes: unauthenticated request to /tickets/TK1001 returns 403 Forbidden", async () => {
	const harness = createSupportModerationHarness();
	const stack = findRouteHandler(harness.routes, "get", "/tickets/:ticketNumber");
	assert.ok(stack, "Route GET /tickets/:ticketNumber should exist");

	const req = {
		params: { ticketNumber: "TK1001" },
		headers: {},
		query: {},
	};
	const res = mockResponse();

	await runRouteStack(stack, req, res);

	assert.equal(res.statusCode, 403);
	assert.match(res.data.error, /Access denied/);
});

test("supportRoutes: request to /tickets/TK1001 with invalid guest token returns 403 Forbidden", async () => {
	const harness = createSupportModerationHarness();
	const stack = findRouteHandler(harness.routes, "get", "/tickets/:ticketNumber");

	const req = {
		params: { ticketNumber: "TK1001" },
		headers: { "x-ticket-token": "forged_invalid_signature" },
		query: {},
	};
	const res = mockResponse();

	await runRouteStack(stack, req, res);

	assert.equal(res.statusCode, 403);
	assert.match(res.data.error, /Access denied/);
});

test("supportRoutes: guest request to /tickets/TK1003 with valid HMAC signed token returns 200 and replies", async () => {
	const harness = createSupportModerationHarness();
	const stack = findRouteHandler(harness.routes, "get", "/tickets/:ticketNumber");

	const validToken = harness.generateTicketToken("TK1003", "dave.guest@example.com");

	const req = {
		params: { ticketNumber: "TK1003" },
		headers: { "x-ticket-token": validToken },
		query: {},
	};
	const res = mockResponse();

	await runRouteStack(stack, req, res);

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(res.data.ticket.ticket_number, "TK1003");
	assert.equal(res.data.ticket.name, "Guest Dave");
});

test("supportRoutes: authenticated customer owning ticket accesses /tickets/TK1001 without token", async () => {
	const harness = createSupportModerationHarness();
	const stack = findRouteHandler(harness.routes, "get", "/tickets/:ticketNumber");

	const req = {
		params: { ticketNumber: "TK1001" },
		user: { id: harness.users[2].id, email: harness.users[2].email, role: "customer" }, // Jane
		headers: {},
		query: {},
	};
	const res = mockResponse();

	await runRouteStack(stack, req, res);

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(res.data.ticket.ticket_number, "TK1001");
});

test("supportRoutes: authenticated customer NOT owning ticket receives 403 Forbidden", async () => {
	const harness = createSupportModerationHarness();
	const stack = findRouteHandler(harness.routes, "get", "/tickets/:ticketNumber");

	const req = {
		params: { ticketNumber: "TK1001" },
		user: { id: harness.users[4].id, email: harness.users[4].email, role: "customer" }, // Alice
		headers: {},
		query: {},
	};
	const res = mockResponse();

	await runRouteStack(stack, req, res);

	assert.equal(res.statusCode, 403);
	assert.match(res.data.error, /Access denied/);
});

test("supportRoutes: reply to ticket without auth or token returns 403 Forbidden", async () => {
	const harness = createSupportModerationHarness();
	const stack = findRouteHandler(harness.routes, "post", "/tickets/:ticketNumber/reply");

	const req = {
		params: { ticketNumber: "TK1001" },
		body: { message: "Malicious reply attempting impersonation" },
		headers: {},
		query: {},
	};
	const res = mockResponse();

	await runRouteStack(stack, req, res);

	assert.equal(res.statusCode, 403);
	assert.match(res.data.error, /Access denied/);
});

test("supportRoutes: guest reply with valid token succeeds and derives identity from ticket, ignoring client spoofing", async () => {
	const harness = createSupportModerationHarness();
	const stack = findRouteHandler(harness.routes, "post", "/tickets/:ticketNumber/reply");

	const validToken = harness.generateTicketToken("TK1003", "dave.guest@example.com");

	const req = {
		params: { ticketNumber: "TK1003" },
		body: {
			message: "Here is additional info on my booking.",
			sender_name: "Spoofed Admin Name",
			sender_role: "admin",
		},
		headers: { "x-ticket-token": validToken },
		query: {},
	};
	const res = mockResponse();

	await runRouteStack(stack, req, res);

	assert.equal(res.statusCode, 201);
	assert.equal(res.data.success, true);

	// Verify reply derived legitimate identity "Guest Dave" / "customer", ignoring spoofed body
	const insertedReply = harness.supportReplies.find((r) => r.ticket_id === 3);
	assert.ok(insertedReply, "Reply must be persisted in database");
	assert.equal(insertedReply.sender_name, "Guest Dave");
	assert.equal(insertedReply.sender_role, "customer");
});
