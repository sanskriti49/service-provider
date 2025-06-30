const bcrypt = require("bcrypt");
const SALT_ROUNDS = 10;

// helper function to hash a password only if it's provided
exports.hashIfPresent = async (password) => {
	return password ? await bcrypt.hash(password, SALT_ROUNDS) : undefined;
};
