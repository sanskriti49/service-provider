const axios = require("axios");

const verifyRecaptcha = async (req, res, next) => {
	try {
		const { captchaToken } = req.body;

		if (!captchaToken) {
			return res.status(400).json({ error: "Please verify you are human" });
		}
		const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

		const formData = new URLSearchParams();
		formData.append("secret", process.env.TURNSTILE_SECRET_KEY);
		formData.append("response", captchaToken);
		formData.append("remoteip", ip);

		const response = await axios.post(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			formData
		);

		const { success } = response.data;

		if (!success) {
			return res
				.status(403)
				.json({ error: "Verification failed. Please try again." });
		}

		next();
	} catch (err) {
		console.error("Turnstile verification error:", err);
		return res.status(500).json({ error: "Verification server error" });
	}
};

module.exports = verifyRecaptcha;
