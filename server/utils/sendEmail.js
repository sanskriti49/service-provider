const nodemailer = require("nodemailer");
const { createProtectedBreaker } = require("./circuitBreaker");

const executeSmtpSend = async (options) => {
	const transporter = nodemailer.createTransport({
		service: "gmail",
		auth: {
			user: process.env.EMAIL_USER,
			pass: process.env.EMAIL_PASS,
		},
	});

	const message = {
		from: `TaskGenie <${process.env.EMAIL_USER}>`,
		to: options.email,
		subject: options.subject,
		text: options.message,
	};

	const info = await transporter.sendMail(message);
	if (process.env.NODE_ENV !== "test") {
		console.log("Message sent: %s", info.messageId);
	}
	return info;
};

// Protect SMTP delivery with circuit breaker (trip after repeated timeouts/failures)
const emailCircuitBreaker = createProtectedBreaker(executeSmtpSend, {
	name: "smtp-email-delivery",
	timeout: 7000,
	errorThresholdPercentage: 50,
	resetTimeout: 20000,
});

const sendEmail = async (options) => {
	try {
		return await emailCircuitBreaker.fire(options);
	} catch (error) {
		if (process.env.NODE_ENV !== "test") {
			console.error("Nodemailer Circuit Breaker caught error:", error.message);
		}
		throw error;
	}
};

module.exports = sendEmail;
