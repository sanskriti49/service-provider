const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { requireSecret, generateTicketToken, isValidTicketToken } = require('../utils/ticketAccess');
const secret = 'isolated-test-secret-not-used-by-any-service';

test('guest ticket tokens require a configured secret', () => {
  assert.throws(() => requireSecret(''), { status: 503 });
  assert.throws(() => generateTicketToken('TKT-A', null, ''), { status: 503 });
  assert.equal(isValidTicketToken('invalid', 'TKT-A', null, ''), false);
});

test('guest ticket tokens expire and are bound to the ticket and audience', () => {
  const token = generateTicketToken('TKT-A', null, secret);
  assert.equal(isValidTicketToken(token, 'TKT-A', null, secret), true);
  assert.equal(isValidTicketToken(token, 'TKT-B', null, secret), false);
  assert.equal(isValidTicketToken(token, 'TKT-A', null, 'another-secret'), false);
  const expired = jwt.sign({ ticket: 'TKT-A', exp: Math.floor(Date.now() / 1000) - 5 }, secret, { audience: 'taskgenie-support-ticket' });
  const wrongAudience = jwt.sign({ ticket: 'TKT-A' }, secret, { audience: 'other', expiresIn: 60 });
  assert.equal(isValidTicketToken(expired, 'TKT-A', null, secret), false);
  assert.equal(isValidTicketToken(wrongAudience, 'TKT-A', null, secret), false);
});
