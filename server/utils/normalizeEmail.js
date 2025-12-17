function normalizeEmail(email) {
	if (!email) return "";

	email = email.toLowerCase();

	let [local, domain] = email.split("@");

	// 2. Handle Gmail / Googlemail specific rules
	if (domain === "gmail.com" || domain === "googlemail.com") {
		// Gmail ignores dots in the local part
		local = local.replace(/\./g, "");
		domain = "gmail.com";
	}

	return `${local}@${domain}`;
}

module.exports = { normalizeEmail };
