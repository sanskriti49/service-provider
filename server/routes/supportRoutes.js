const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { customAlphabet } = require("nanoid");

const genTicketId = customAlphabet("1234567890ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

// Self-healing table initialization
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
				created_at timestamptz DEFAULT now()
			);
			CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
			CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
		`);
		tableInitialized = true;
	} catch (err) {
		console.warn("Could not ensure support_tickets table:", err.message);
	}
}

/**
 * POST /api/support/tickets
 * Public or authenticated endpoint for creating support tickets
 */
router.post("/tickets", async (req, res, next) => {
	try {
		await ensureSupportTable();

		const { name, email, role = "customer", category, priority = "normal", subject, message, user_id } = req.body;

		if (!name || !name.trim()) {
			return res.status(400).json({ error: "Your name is required." });
		}
		if (!email || !email.includes("@")) {
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
				user_id || null,
				name.trim(),
				email.trim().toLowerCase(),
				role,
				cleanCategory,
				cleanPriority,
				subject.trim(),
				message.trim(),
			],
		);

		const created = insertResult.rows[0];

		// If user_id is provided, dispatch in-app notification
		if (user_id) {
			try {
				await db.query(
					`INSERT INTO notifications (user_id, title, message, type, data)
					 VALUES ($1, $2, $3, 'system', $4)`,
					[
						user_id,
						`🎫 Support Ticket #${ticketNumber}`,
						`We received your inquiry regarding "${subject.trim()}". Our support team typically replies within 2–4 hours.`,
						JSON.stringify({ ticket_number: ticketNumber, category: cleanCategory, priority: cleanPriority }),
					],
				);
			} catch (notifErr) {
				console.warn("Could not dispatch ticket notification:", notifErr.message);
			}
		}

		res.status(201).json({
			success: true,
			ticket_number: ticketNumber,
			message: `Ticket #${ticketNumber} created successfully. Our team will review and reply within 2–4 hours.`,
			ticket: created,
		});
	} catch (err) {
		console.error("Support ticket error:", err);
		next(err);
	}
});

module.exports = router;
