const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { customAlphabet } = require("nanoid");
const verifyToken = require("../middleware/verifyToken");

const genTicketId = customAlphabet("1234567890ABCDEFGHJKLMNPQRSTUVWXYZ", 6);
const TICKET_SECRET = process.env.JWT_SECRET || "taskgenie_support_ticket_signature_salt_2026";

/**
 * Generate a cryptographically signed HMAC token for guest ticket access
 */
function generateTicketToken(ticketNumber, email) {
	return crypto
		.createHmac("sha256", TICKET_SECRET)
		.update(`${String(ticketNumber).toUpperCase()}:${String(email).trim().toLowerCase()}`)
		.digest("hex");
}

/**
 * Timing-safe token verification to prevent timing attacks
 */
function isValidTicketToken(token, ticketNumber, email) {
	if (!token || typeof token !== "string") return false;
	try {
		const expected = generateTicketToken(ticketNumber, email);
		if (token.length !== expected.length) return false;
		return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
	} catch {
		return false;
	}
}

/**
 * Optional authentication extractor: parses user if Bearer token present,
 * but allows unauthenticated guest requests to proceed to token verification
 */
function optionalAuth(req, res, next) {
	const authHeader = req.headers.authorization;
	if (authHeader && authHeader.startsWith("Bearer ")) {
		const token = authHeader.split(" ")[1];
		try {
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			req.user = decoded;
		} catch {
			// Token expired or invalid: continue as unauthenticated guest
		}
	}
	next();
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

	// 2. Authenticated user who owns the ticket (by user_id or matching email)
	if (req.user) {
		const isOwnerId = ticket.user_id && req.user.id === ticket.user_id;
		const isOwnerEmail = req.user.email && ticket.email && req.user.email.toLowerCase() === ticket.email.toLowerCase();
		if (isOwnerId || isOwnerEmail) {
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
	const providedToken = req.headers["x-ticket-token"] || req.query.token || req.body?.token;
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

		const insertResult = await db.query(
			`INSERT INTO support_tickets (ticket_number, user_id, name, email, role, category, priority, subject, message)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
			]
		);

		const created = insertResult.rows[0];
		const ticketToken = generateTicketToken(ticketNumber, cleanEmail);

		// If user is authenticated, dispatch in-app notification
		if (userId) {
			try {
				await db.query(
					`INSERT INTO notifications (user_id, title, message, type, data)
					 VALUES ($1, $2, $3, 'support', $4)`,
					[
						userId,
						`🎫 Support Ticket #${ticketNumber}`,
						`We received your inquiry regarding "${subject.trim()}". Our support team typically replies within 2–4 hours.`,
						JSON.stringify({ ticket_number: ticketNumber, category: cleanCategory, priority: cleanPriority }),
					]
				);
			} catch (notifErr) {
				console.warn("Could not dispatch ticket notification:", notifErr.message);
			}
		}

		res.status(201).json({
			success: true,
			ticket_number: ticketNumber,
			ticket_token: ticketToken,
			ticket_url: `/help?ticket=${ticketNumber}&token=${ticketToken}`,
			message: `Ticket #${ticketNumber} created successfully. Our team will review and reply within 2–4 hours.`,
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
			 WHERE t.user_id = $1 OR (t.user_id IS NULL AND LOWER(t.email) = LOWER($2))
			 ORDER BY t.created_at DESC`,
			[req.user.id, req.user.email || ""]
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

		// Derive sender identity strictly from authorization (ignore any forged client sender_name)
		const replyInsert = await db.query(
			`INSERT INTO support_ticket_replies (ticket_id, sender_id, sender_name, sender_role, message, is_internal)
			 VALUES ($1, $2, $3, $4, $5, false)
			 RETURNING id, ticket_id, sender_name, sender_role, message, created_at`,
			[ticket.id, auth.senderId, auth.senderName, auth.senderRole, message.trim()]
		);

		// Reopen ticket if closed/resolved
		if (["resolved", "closed"].includes(ticket.status)) {
			await db.query("UPDATE support_tickets SET status = 'open', updated_at = NOW() WHERE id = $1", [ticket.id]);
		} else {
			await db.query("UPDATE support_tickets SET updated_at = NOW() WHERE id = $1", [ticket.id]);
		}

		// Notify assigned staff
		if (ticket.assigned_to) {
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
			reply: replyInsert.rows[0],
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
