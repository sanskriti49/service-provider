// Opt-in: KYC_INTEGRATION_TEST=1 KYC_TEST_PORT=<isolated PostgreSQL port> node --test test/kyc.integration.test.js
// Requires an already migrated, disposable local database named taskgenie_kyc_test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('private KYC HTTP flow and versioned reviews against disposable PostgreSQL', {
  skip: process.env.KYC_INTEGRATION_TEST !== '1', timeout: 60000,
}, async t => {
  const port = Number(process.env.KYC_TEST_PORT);
  const dbName = process.env.KYC_TEST_DB_NAME || 'taskgenie_kyc_test';
  assert(Number.isInteger(port) && port > 1024 && port < 65536, 'Specify the disposable local PostgreSQL port');
  assert(/^taskgenie_kyc_test(?:_\d+)?$/.test(dbName), 'Specify an isolated KYC test database');
  const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taskgenie-kyc-fixture-'));
  assert.equal(path.dirname(privateDir), os.tmpdir());
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: '', DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER: 'postgres', DB_PASSWORD: '', DB_NAME: dbName, DB_SSL_MODE: 'disable', DB_SSL_CA_FILE: '', PGSSLMODE: '', JWT_SECRET: 'isolated-kyc-test-secret', KYC_STORAGE_DRIVER: 'local', KYC_PRIVATE_DIRECTORY: privateDir, AWS_ACCESS_KEY_ID: '', AWS_SECRET_ACCESS_KEY: '', AWS_ENDPOINT_URL_S3: '', S3_ENDPOINT: '', CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '' });
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const db = require('../config/db');
  const app = express();
  app.use(express.json());
  app.use('/api/providers', require('../routes/providerRoutes'));
  app.use('/api/admin', require('../routes/adminRoutes'));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: 'Request failed' }));
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await db.end(); if (path.dirname(privateDir) === os.tmpdir() && path.basename(privateDir).startsWith('taskgenie-kyc-fixture-')) await fs.rm(privateDir, { recursive: true, force: true }); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const users = [
    ['11111111-1111-4111-8111-111111111111', 'provider', 'SRVTESTPROVIDER12345'],
    ['22222222-2222-4222-8222-222222222222', 'customer', 'CUSTESTCUSTOMER12345'],
    ['33333333-3333-4333-8333-333333333333', 'admin', 'ADMTESTADMIN123456'],
  ];
  for (const [id, role, custom] of users) await db.query('INSERT INTO users(id,name,email,role,custom_id,password) VALUES($1,$2,$3,$4,$5,$6)', [id, 'Fixture User', `${role}@example.com`, role, custom, 'fixture']);
  await db.query("INSERT INTO services(id,name,description,price,slug) VALUES('44444444-4444-4444-8444-444444444444','Fixture','Fixture',100,'fixture-service')");
  const tokens = Object.fromEntries(users.map(([id, role]) => [role, jwt.sign({ id, role }, process.env.JWT_SECRET)]));
  const call = async (route, role, options = {}) => {
    const headers = { ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}), ...options.headers };
    return fetch(origin + route, { ...options, headers });
  };
  const upload = (role, bytes, type = 'application/pdf') => {
    const form = new FormData();
    if (bytes) form.append('document', new Blob([bytes], { type }), 'fixture.pdf');
    return call('/api/providers/upload-kyc', role, { method: 'POST', body: form });
  };
  const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const pdf = Buffer.from('%PDF-1.4\nsynthetic fixture');
  assert.equal((await upload(null, pdf)).status, 401);
  assert.equal((await upload('customer', pdf)).status, 403);
  assert.equal((await upload('provider', null)).status, 400);
  assert.equal((await upload('provider', Buffer.from('invalid'), 'image/png')).status, 400);
  assert.equal((await upload('provider', Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
  process.env.KYC_STORAGE_DRIVER = 'disabled';
  assert.equal((await upload('provider', pdf)).status, 503);
  process.env.KYC_STORAGE_DRIVER = 'local';
  const uploaded = await upload('provider', pdf);
  assert.equal(uploaded.status, 200);
  const front = (await uploaded.json()).url;
  const application = { name: 'Fixture User', email: 'provider@example.com', service: 'fixture-service', lat: 0, lng: 0, price: 100, kyc_doc_type: 'certificate', kyc_doc_number: 'TEST1234', kyc_doc_front: front, kyc_declaration: true };
  assert.equal((await call('/api/providers/v1', null, json('POST', application))).status, 401);
  assert.equal((await call('/api/providers/v1', 'provider', json('POST', { ...application, kyc_doc_front: '' }))).status, 400);
  assert.equal((await call('/api/providers/v1', 'provider', json('POST', { ...application, kyc_doc_type: 'aadhaar' }))).status, 400);
  assert.equal((await call('/api/providers/v1', 'provider', json('POST', { ...application, kyc_doc_type: 'aadhaar', kyc_doc_back: front }))).status, 400);
  assert.equal((await call('/api/providers/v1', 'provider', json('POST', { ...application, kyc_doc_front: 'data:application/pdf;base64,AAAA' }))).status, 400);
  const createResponse = await call('/api/providers/v1', 'provider', json('POST', application));
  assert.equal(createResponse.status, 201, createResponse.status === 201 ? '' : (await createResponse.json()).error);
  assert.equal((await call('/api/providers/v1', 'provider', json('POST', application))).status, 409);
  const id = users[0][0];
  const view = `/api/providers/v1/${id}/kyc/documents/front`;
  assert.equal((await call(view, null)).status, 401);
  assert.equal((await call(view, 'customer')).status, 403);
  const ownerDocument = await call(view, 'provider');
  assert.equal(ownerDocument.status, 200); assert.equal(ownerDocument.headers.get('cache-control'), 'no-store'); assert.equal(ownerDocument.headers.get('content-type'), 'application/pdf');
  assert.deepEqual(Buffer.from(await ownerDocument.arrayBuffer()), pdf);
  assert.equal((await call(view, 'admin')).status, 200);
  const status = `/api/admin/providers/${id}/status`;
  const review = `/api/admin/providers/${id}/kyc`;
  assert.equal((await call(status, 'admin', json('PUT', { status: 'approved' }))).status, 200);
  const approved = await db.query('SELECT kyc_status,is_verified,kyc_version FROM providers WHERE user_id=$1', [id]);
  assert.equal(approved.rows[0].kyc_status, 'pending'); assert.equal(approved.rows[0].is_verified, false); assert.equal(approved.rows[0].kyc_version, 1);
  assert.equal((await call(review, 'customer', json('PUT', { kyc_status: 'verified', kyc_version: 1 }))).status, 403);
  assert.equal((await call(review, 'admin', json('PUT', { kyc_status: 'rejected', kyc_version: 1, rejection_reason: 'Please upload a clearer document' }))).status, 200);
  const replacement = await upload('provider', pdf); const newFront = (await replacement.json()).url;
  const resubmit = { kyc_doc_type: 'certificate', kyc_doc_number: 'TEST1234', kyc_doc_front: newFront, kyc_declaration: true };
  assert.equal((await call(`/api/providers/v1/${id}/kyc`, 'provider', json('PUT', resubmit))).status, 200);
  assert.equal((await call(`/api/providers/v1/${id}/kyc`, 'provider', json('PUT', resubmit))).status, 200);
  const pending = await db.query('SELECT kyc_version FROM providers WHERE user_id=$1', [id]); assert.equal(pending.rows[0].kyc_version, 2);
  assert.equal((await call(review, 'admin', json('PUT', { kyc_status: 'verified', kyc_version: 1 }))).status, 409);
  assert.equal((await call(review, 'admin', json('PUT', { kyc_status: 'verified', kyc_version: 2 }))).status, 200);
  const verified = await db.query('SELECT is_verified,kyc_reviewed_by FROM providers WHERE user_id=$1', [id]);
  assert.equal(verified.rows[0].is_verified, true); assert.equal(verified.rows[0].kyc_reviewed_by, users[2][0]);
  const history = await db.query('SELECT submission_version,decision,reviewer_id FROM kyc_review_events WHERE provider_id=$1 ORDER BY submission_version', [id]);
  assert.deepEqual(history.rows.map(row => [row.submission_version, row.decision]), [[1, 'rejected'], [2, 'verified']]);
  assert(history.rows.every(row => row.reviewer_id === users[2][0]));
});
