const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const chat = require("../utils/chatService");

router.use(authMiddleware);
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
const handle = (operation) => async (req, res) => {
	try {
		res.json(await operation(req));
	} catch (err) {
		const error = chat.errorPayload(err);
		res.status(error.status).json({ error });
	}
};

router.get("/unread", handle((req) => chat.unread(req.user.id)));
router.get("/:bookingId/messages", handle((req) => chat.history(req.user.id, req.params.bookingId, req.query)));
router.post("/:bookingId/messages", handle((req) => chat.send(req.user.id, req.params.bookingId, req.body)));
router.post("/:bookingId/read", handle((req) => chat.markRead(req.user.id, req.params.bookingId, req.body)));

module.exports = router;
