const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
	try {
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
		console.log("Message sent: %s", info.messageId);
	} catch (error) {
		console.error("Nodemailer Error:", error);
		throw error;
	}
};

module.exports = sendEmail;
