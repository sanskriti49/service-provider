const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDocument, assertKey, storeDocument, documentExists, readDocument, LIMIT } = require('../services/kycStorage');
const { S3Client } = require('@aws-sdk/client-s3');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const owner = '11111111-1111-4111-8111-111111111111';
const key = `kyc/${owner}/22222222-2222-4222-8222-222222222222`;

test('KYC file signatures must match supported types and size limits', () => {
  assert.equal(validateDocument(Buffer.from('%PDF-1.4\nfixture'), 'application/pdf'), 'application/pdf');
  assert.throws(() => validateDocument(Buffer.from('not an image'), 'image/png'));
  assert.throws(() => validateDocument(Buffer.alloc(0), 'application/pdf'));
  assert.throws(() => validateDocument(Buffer.alloc(LIMIT + 1), 'image/png'));
  assert.throws(() => validateDocument(Buffer.from('%PDF-1.4'), 'image/png'));
  assert.throws(() => validateDocument(Buffer.from('%PDF-1.4'), 'text/html'));
});

test('remote KYC storage is disabled even when legacy S3 settings are present', async () => {
  const previousDriver = process.env.KYC_STORAGE_DRIVER, previousBucket = process.env.KYC_PRIVATE_S3_BUCKET;
  const originalSend = S3Client.prototype.send;
  process.env.KYC_STORAGE_DRIVER = 's3'; process.env.KYC_PRIVATE_S3_BUCKET = 'synthetic-test-bucket';
  let calls = 0;
  try {
    S3Client.prototype.send = async () => { calls++; throw new Error('unexpected remote request'); };
    await assert.rejects(storeDocument(owner, Buffer.from('%PDF-fixture'), 'application/pdf'), { code: 'KYC_STORAGE_DISABLED' });
    assert.equal(calls, 0);
  } finally {
    S3Client.prototype.send = originalSend;
    if (previousDriver === undefined) delete process.env.KYC_STORAGE_DRIVER; else process.env.KYC_STORAGE_DRIVER = previousDriver;
    if (previousBucket === undefined) delete process.env.KYC_PRIVATE_S3_BUCKET; else process.env.KYC_PRIVATE_S3_BUCKET = previousBucket;
  }
});

test('synthetic KYC documents round-trip locally but local storage is disabled on Render', async () => {
  const names = ['NODE_ENV', 'KYC_STORAGE_DRIVER', 'KYC_PRIVATE_DIRECTORY', 'RENDER', 'RENDER_SERVICE_ID'];
  const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'taskgenie-kyc-unit-'));
  try {
    Object.assign(process.env, { NODE_ENV: 'development', KYC_STORAGE_DRIVER: 'local', KYC_PRIVATE_DIRECTORY: root });
    delete process.env.RENDER; delete process.env.RENDER_SERVICE_ID;
    const fixture = Buffer.from('%PDF-1.4\nsynthetic only');
    const reference = await storeDocument(owner, fixture, 'application/pdf');
    assert.equal(await documentExists(reference, owner), true);
    assert.deepEqual(await readDocument(reference, owner), fixture);
    process.env.RENDER = 'true';
    await assert.rejects(storeDocument(owner, fixture, 'application/pdf'), { code: 'KYC_STORAGE_DISABLED' });
    delete process.env.RENDER;
    process.env.RENDER_SERVICE_ID = 'fixture';
    await assert.rejects(readDocument(reference, owner), { code: 'KYC_STORAGE_DISABLED' });
    delete process.env.RENDER_SERVICE_ID;
    process.env.NODE_ENV = 'production';
    await assert.rejects(storeDocument(owner, fixture, 'application/pdf'), { code: 'KYC_STORAGE_DISABLED' });
  } finally {
    for (const name of names) if (prior[name] === undefined) delete process.env[name]; else process.env[name] = prior[name];
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('KYC object references cannot escape or cross owner boundaries', () => {
  assert.equal(assertKey(key, owner), key);
  assert.throws(() => assertKey(key, '33333333-3333-4333-8333-333333333333'));
  for (const bad of ['../../etc/passwd', `${key}/../../elsewhere`, '/uploads/kyc/file', 'data:image/png;base64,AA==']) assert.throws(() => assertKey(bad, owner));
});

test('local KYC storage cannot use the application tree or production', async () => {
  const prior = { mode: process.env.NODE_ENV, driver: process.env.KYC_STORAGE_DRIVER, directory: process.env.KYC_PRIVATE_DIRECTORY };
  try {
    process.env.NODE_ENV = 'test'; process.env.KYC_STORAGE_DRIVER = 'local'; process.env.KYC_PRIVATE_DIRECTORY = path.resolve(__dirname, '..');
    await assert.rejects(storeDocument(owner, Buffer.from('%PDF-fixture'), 'application/pdf'));
    process.env.NODE_ENV = 'production';
    await assert.rejects(storeDocument(owner, Buffer.from('%PDF-fixture'), 'application/pdf'));
  } finally {
    for (const [name, value] of [['NODE_ENV', prior.mode], ['KYC_STORAGE_DRIVER', prior.driver], ['KYC_PRIVATE_DIRECTORY', prior.directory]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
