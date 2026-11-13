const path = require('node:path');

// Evaluate the same decoded, normalized path that the static handler would see.
module.exports = function blockLegacyKyc(req, res, next) {
  let requested;
  try { requested = path.posix.normalize(decodeURIComponent(req.path).replace(/\\/g, '/')); }
  catch { return res.status(400).end(); }
  if (/(?:^|\/)kyc-documents(?:\/|$)/i.test(requested)) return res.status(404).end();
  return next();
};
