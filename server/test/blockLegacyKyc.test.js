const test = require('node:test');
const assert = require('node:assert/strict');
const block = require('../middleware/blockLegacyKyc');

test('legacy KYC paths cannot reach static serving, including encoded and normalized paths', () => {
  for (const path of ['/kyc-documents/id', '/KYC-DOCUMENTS/id', '/%6byc-documents/id', '/x/%2e%2e/kyc-documents/id', '/kyc-documents%5cid']) {
    let status, next = false;
    block({ path }, { status(value) { status = value; return this; }, end() {} }, () => { next = true; });
    assert.equal(status, 404); assert.equal(next, false);
  }
  let allowed = false;
  block({ path: '/avatars/avatar.png' }, { status() { throw Error('Unrelated upload blocked'); } }, () => { allowed = true; });
  assert.equal(allowed, true);
});
