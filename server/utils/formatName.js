function formatName(name) {
	if (!name) return "";

	return name
		.toLowerCase()
		.trim()
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

module.exports = { formatName };
