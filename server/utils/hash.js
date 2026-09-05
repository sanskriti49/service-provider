const bcrypt = require("bcrypt");
const SALT_ROUNDS = 10;

exports.hashIfPresent = async (password) => {
	return password ? await bcrypt.hash(password, SALT_ROUNDS) : undefined;
};
