function normalizeEmail(email) {
	if (!email || typeof email !== "string") return "";

	email = email.trim().toLowerCase();

	let [local, domain] = email.split("@");

	if (domain === "gmail.com" || domain === "googlemail.com") {
		local = local.replace(/\./g, "");
		domain = "gmail.com";
	}

	return `${local}@${domain}`;
}

module.exports = { normalizeEmail };
