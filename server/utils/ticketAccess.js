const jwt = require('jsonwebtoken');

const AUDIENCE = 'taskgenie-support-ticket';
const LIFETIME_SECONDS = 30 * 24 * 60 * 60;

function requireSecret(secret = process.env.JWT_SECRET) {
  if (typeof secret !== 'string' || !secret.trim()) {
    const error = new Error('Guest ticket access is temporarily unavailable');
    error.status = 503;
    throw error;
  }
  return secret;
}

function generateTicketToken(ticketNumber, _email, secret) {
  return jwt.sign({ ticket: String(ticketNumber).toUpperCase() }, requireSecret(secret), {
    algorithm: 'HS256', audience: AUDIENCE, expiresIn: LIFETIME_SECONDS,
  });
}

function isValidTicketToken(token, ticketNumber, _email, secret) {
  if (typeof token !== 'string' || token.length > 4096) return false;
  try {
    const payload = jwt.verify(token, requireSecret(secret), { algorithms: ['HS256'], audience: AUDIENCE, maxAge: LIFETIME_SECONDS });
    return payload.ticket === String(ticketNumber).toUpperCase() && typeof payload.exp === 'number';
  } catch { return false; }
}

module.exports = { requireSecret, generateTicketToken, isValidTicketToken, LIFETIME_SECONDS };
