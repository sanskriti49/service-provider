const { getProviderAvailability } = require("./providerController");

async function getAvailability(req, res, next) {
	if (!req.params.id && req.params.provider_id) {
		req.params.id = req.params.provider_id;
	}
	return getProviderAvailability(req, res, next);
}

module.exports = { getAvailability };
