const express = require("express");
const router = express.Router();
const crypto = require("node:crypto");
const db = require("../config/db");
const { customAlphabet } = require("nanoid");
const verifyToken = require("../middleware/verifyToken");

const genTicketId = customAlphabet("1234567890ABCDEFGHJKLMNPQRSTUVWXYZ", 6);
const { requireSecret, generateTicketToken, isValidTicketToken } = require("../utils/ticketAccess");

/**
 * Optional authentication extractor: parses user if Bearer token present,
 * but allows unauthenticated guest requests to proceed to token verification
 */
function optionalAuth(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader) return next();
	if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Invalid authorization header" });
	return verifyToken(req, res, next);
}

/**
 * Self-healing table initialization
 */
let tableInitialized = false;
async function ensureSupportTable() {
	if (tableInitialized) return;
	try {
		await db.query(`
			CREATE TABLE IF NOT EXISTS public.support_tickets (
				id serial PRIMARY KEY,
				ticket_number varchar(20) UNIQUE NOT NULL,
				user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
				name varchar(100) NOT NULL,
				email varchar(150) NOT NULL,
				role varchar(20) DEFAULT 'customer',
				category varchar(50) NOT NULL,
				priority varchar(20) DEFAULT 'normal',
				subject text NOT NULL,
				message text NOT NULL,
				status varchar(20) DEFAULT 'open',
				assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
				resolution_notes text,
				resolved_at timestamptz,
				resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
				created_at timestamptz DEFAULT now(),
				updated_at timestamptz DEFAULT now()
			);
			ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL;
			ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS resolution_notes text;
			ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
			ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
			ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
			CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
			CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
			CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON public.support_tickets(assigned_to);
			CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number ON public.support_tickets(ticket_number);

			CREATE TABLE IF NOT EXISTS public.support_ticket_replies (
				id serial PRIMARY KEY,
				ticket_id int NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
				sender_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
				sender_name varchar(100) NOT NULL,
				sender_role varchar(20) DEFAULT 'customer',
				message text NOT NULL,
				is_internal bool DEFAULT false,
				created_at timestamptz DEFAULT now()
			);
			CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON public.support_ticket_replies(ticket_id);
		`);
		tableInitialized = true;
	} catch (err) {
		console.warn("Could not ensure support_tickets table:", err.message);
	}
}

/**
 * Authorize ticket access for both reading and replying
 */
function authorizeTicketAccess(req, ticket) {
	// 1. Staff administrators have access
	if (req.user && req.user.role === "admin") {
		return { authorized: true, isStaff: true, senderName: req.user.name || "Support Staff", senderRole: "admin", senderId: req.user.id };
	}

	// Ownership is based on the user ID; email is not proof of ownership.
	if (req.user) {
		const isOwnerId = ticket.user_id && req.user.id === ticket.user_id;
		if (isOwnerId) {
			return {
				authorized: true,
				isStaff: false,
				senderName: req.user.name || ticket.name,
				senderRole: req.user.role || "customer",
				senderId: req.user.id,
			};
		}
	}

	// 3. Guest with valid signed access token
	const providedToken = req.headers["x-ticket-token"] || req.body?.token;
	if (isValidTicketToken(providedToken, ticket.ticket_number, ticket.email)) {
		return {
			authorized: true,
			isStaff: false,
			isGuest: true,
			senderName: ticket.name,
			senderRole: "customer",
			senderId: null,
		};
	}

	return { authorized: false };
}

/**
 * POST /api/support/tickets
 * Create support ticket (authenticated or guest)
 */
router.post("/tickets", optionalAuth, async (req, res, next) => {
	try {
		if (!req.user) {
			try { requireSecret(); } catch { return res.status(503).json({ error: "Guest ticket access is temporarily unavailable. Please try again later." }); }
		}
		await ensureSupportTable();

		const { name, email, role = "customer", category, priority = "normal", subject, message } = req.body;

		// When authenticated, derive identity from authenticated session rather than client body
		const cleanName = (req.user?.name || name || "").trim();
		const cleanEmail = (req.user?.email || email || "").trim().toLowerCase();
		const cleanRole = req.user?.role || role;
		const userId = req.user?.id || null;

		if (!cleanName) {
			return res.status(400).json({ error: "Your name is required." });
		}
		if (!cleanEmail || !cleanEmail.includes("@")) {
			return res.status(400).json({ error: "A valid contact email is required." });
		}
		if (!subject || !subject.trim()) {
			return res.status(400).json({ error: "Ticket subject is required." });
		}
		if (!message || !message.trim()) {
			return res.status(400).json({ error: "Ticket description/message is required." });
		}

		const ticketNumber = `TKT-${genTicketId()}`;
		const cleanCategory = (category || "general").toLowerCase();
		const cleanPriority = ["urgent", "high"].includes(String(priority).toLowerCase()) ? "urgent" : "normal";
		const requestId = req.headers['idempotency-key'] || null;
		if (requestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return res.status(400).json({ error: 'Invalid request identifier' });
		const requestHash = requestId ? crypto.createHash('sha256').update(JSON.stringify([userId, cleanName, cleanEmail, cleanRole, cleanCategory, cleanPriority, subject.trim(), message.trim()])).digest('hex') : null;

		const insertResult = await db.query(
			`INSERT INTO support_tickets (ticket_number, user_id, name, email, role, category, priority, subject, message, client_request_id, client_request_hash)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			 ON CONFLICT (client_request_id) DO NOTHING
			 RETURNING id, ticket_number, created_at, status`,
			[
				ticketNumber,
				userId,
				cleanName,
				cleanEmail,
				cleanRole,
				cleanCategory,
				cleanPriority,
				subject.trim(),
				message.trim(),
				requestId,
				requestHash,
			]
		);

		let created = insertResult.rows[0];
		const inserted = Boolean(created);
		if (!created && requestId) {
			const prior = await db.query('SELECT id, ticket_number, created_at, status, client_request_hash FROM support_tickets WHERE client_request_id=$1', [requestId]);
			if (!prior.rows.length || prior.rows[0].client_request_hash !== requestHash) return res.status(409).json({ error: 'This request identifier was used for different ticket details.' });
			const { id, ticket_number, created_at, status } = prior.rows[0];
			created = { id, ticket_number, created_at, status };
		}
		if (!created) return res.status(500).json({ error: 'Unable to create ticket' });
		const ticketToken = userId ? null : generateTicketToken(created.ticket_number, cleanEmail);

		// If user is authenticated, dispatch in-app notification
		if (userId && inserted) {
			try {
				await db.query(
					`INSERT INTO notifications (user_id, title, message, type, data)
					 VALUES ($1, $2, $3, 'support', $4)`,
					[
						userId,
						`🎫 Support Ticket #${created.ticket_number}`,
						`We received your inquiry regarding "${subject.trim()}". Check your ticket for updates.`,
						JSON.stringify({ ticket_number: created.ticket_number, category: cleanCategory, priority: cleanPriority }),
					]
				);
			} catch (notifErr) {
				console.warn("Could not dispatch ticket notification:", notifErr.message);
			}
		}

		res.status(201).json({
			success: true,
			ticket_number: created.ticket_number,
			ticket_token: ticketToken,
			message: `Ticket #${created.ticket_number} created successfully. Check your ticket for updates.`,
			ticket: created,
		});
	} catch (err) {
		console.error("Support ticket error:", err);
		next(err);
	}
});

/**
 * GET /api/support/my-tickets
 * Authenticated customer endpoint: lists their submitted tickets
 */
router.get("/my-tickets", verifyToken, async (req, res, next) => {
	try {
		await ensureSupportTable();
		const result = await db.query(
			`SELECT t.id, t.ticket_number, t.category, t.priority, t.subject, t.status, t.created_at, t.updated_at,
			        (SELECT COUNT(*) FROM support_ticket_replies r WHERE r.ticket_id = t.id AND r.is_internal = false) AS reply_count
			 FROM support_tickets t
			 WHERE t.user_id = $1
			 ORDER BY t.created_at DESC`,
			[req.user.id]
		);
		res.json({ success: true, tickets: result.rows });
	} catch (err) {
		next(err);
	}
});

/**
 * GET /api/support/tickets/:ticketNumber
 * Fetch ticket thread. Requires authenticated ownership OR signed access token for guest tickets.
 */
router.get("/tickets/:ticketNumber", optionalAuth, async (req, res, next) => {
	try {
		await ensureSupportTable();
		const { ticketNumber } = req.params;

		// Strictly match ticket_number; reject sequential ID guessing
		const ticketRes = await db.query(
			`SELECT t.id, t.ticket_number, t.user_id, t.name, t.email, t.role, t.category, t.priority,
			        t.subject, t.message, t.status, t.created_at, t.updated_at, t.resolved_at,
			        u_assigned.name AS assignee_name
			 FROM support_tickets t
			 LEFT JOIN users u_assigned ON u_assigned.id = t.assigned_to
			 WHERE t.ticket_number = $1`,
			[ticketNumber]
		);
		if (!ticketRes.rows.length) {
			return res.status(404).json({ error: "Support ticket not found" });
		}
		const ticket = ticketRes.rows[0];

		// Authorize access
		const auth = authorizeTicketAccess(req, ticket);
		if (!auth.authorized) {
			return res.status(403).json({
				error: "Access denied. Sign in to your account or provide a valid ticket access token to view this ticket.",
			});
		}

		// Staff admins see all replies; customers/guests see only non-internal replies
		const repliesRes = await db.query(
			`SELECT id, sender_id, sender_name, sender_role, message, is_internal, created_at
			 FROM support_ticket_replies
			 WHERE ticket_id = $1 ${auth.isStaff ? "" : "AND is_internal = false"}
			 ORDER BY created_at ASC`,
			[ticket.id]
		);

		res.json({
			success: true,
			ticket: {
				id: ticket.id,
				ticket_number: ticket.ticket_number,
				name: ticket.name,
				email: ticket.email,
				role: ticket.role,
				category: ticket.category,
				priority: ticket.priority,
				subject: ticket.subject,
				message: ticket.message,
				status: ticket.status,
				assignee_name: ticket.assignee_name,
				created_at: ticket.created_at,
				updated_at: ticket.updated_at,
				resolved_at: ticket.resolved_at,
			},
			replies: repliesRes.rows,
		});
	} catch (err) {
		next(err);
	}
});

/**
 * POST /api/support/tickets/:ticketNumber/reply
 * Post customer or guest reply to ticket. Requires ownership or signed access token.
 */
router.post("/tickets/:ticketNumber/reply", optionalAuth, async (req, res, next) => {
	try {
		await ensureSupportTable();
		const { ticketNumber } = req.params;
		const { message } = req.body;

		if (!message || !message.trim()) {
			return res.status(400).json({ error: "Reply message cannot be empty" });
		}

		const ticketRes = await db.query(
			`SELECT id, ticket_number, user_id, name, email, status, assigned_to
			 FROM support_tickets
			 WHERE ticket_number = $1`,
			[ticketNumber]
		);
		if (!ticketRes.rows.length) {
			return res.status(404).json({ error: "Support ticket not found" });
		}
		const ticket = ticketRes.rows[0];

		// Authorize access
		const auth = authorizeTicketAccess(req, ticket);
		if (!auth.authorized) {
			return res.status(403).json({
				error: "Access denied. Sign in to your account or provide a valid ticket access token to reply to this ticket.",
			});
		}

		const requestId = req.headers['idempotency-key'] || null;
		if (requestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return res.status(400).json({ error: 'Invalid request identifier' });
		const requestHash = requestId ? crypto.createHash('sha256').update(JSON.stringify([ticket.id, auth.senderId, auth.senderRole, message.trim()])).digest('hex') : null;
		// Derive sender identity strictly from authorization (ignore any forged client sender_name)
		const replyInsert = await db.query(
			`WITH added AS (
			 INSERT INTO support_ticket_replies (ticket_id, sender_id, sender_name, sender_role, message, is_internal, client_request_id, client_request_hash)
			 VALUES ($1, $2, $3, $4, $5, false, $6, $7)
			 ON CONFLICT (client_request_id) DO NOTHING
			 RETURNING id, ticket_id, sender_name, sender_role, message, created_at
			), touched AS (
			 UPDATE support_tickets SET status = CASE WHEN status IN ('resolved','closed') THEN 'open' ELSE status END, updated_at=NOW()
			 WHERE id=$1 AND EXISTS (SELECT 1 FROM added)
			) SELECT * FROM added`,
			[ticket.id, auth.senderId, auth.senderName, auth.senderRole, message.trim(), requestId, requestHash]
		);
		let reply = replyInsert.rows[0];
		const inserted = Boolean(reply);
		if (!reply && requestId) {
			const prior = await db.query('SELECT id, ticket_id, sender_name, sender_role, message, created_at, client_request_hash FROM support_ticket_replies WHERE client_request_id=$1', [requestId]);
			if (!prior.rows.length || prior.rows[0].ticket_id !== ticket.id || prior.rows[0].client_request_hash !== requestHash) return res.status(409).json({ error: 'This request identifier was used for a different reply.' });
			const { id, ticket_id, sender_name, sender_role, message, created_at } = prior.rows[0];
			reply = { id, ticket_id, sender_name, sender_role, message, created_at };
		}
		if (!reply) return res.status(500).json({ error: 'Unable to submit reply' });

		// Notify assigned staff
		if (ticket.assigned_to && inserted) {
			try {
				await db.query(
					`INSERT INTO notifications (user_id, title, message, type, data)
					 VALUES ($1, $2, $3, 'support', $4)`,
					[
						ticket.assigned_to,
						`💬 New reply on #${ticket.ticket_number}`,
						`${auth.senderName} replied: "${message.trim().slice(0, 80)}..."`,
						JSON.stringify({ ticket_id: ticket.id, ticket_number: ticket.ticket_number }),
					]
				);
			} catch (_) {}
		}

		res.status(201).json({
			success: true,
			reply,
			message: "Reply submitted successfully",
		});
	} catch (err) {
		next(err);
	}
});

const accountController = require("../controllers/accountController");
router.post("/feedback", accountController.submitFeedback);

module.exports = router;
module.exports.ensureSupportTable = ensureSupportTable;
module.exports.generateTicketToken = generateTicketToken;
module.exports.isValidTicketToken = isValidTicketToken;
