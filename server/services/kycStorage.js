// Dedicated private KYC storage. No public URL, Cloudinary or data-URI fallback.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const KEY = /^kyc\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const LIMIT = 5 * 1024 * 1024;

function detectDocumentType(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > LIMIT) throw new Error('Document must be between 1 byte and 5 MB');
  const jpg = buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  const pdf = buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-';
  if (jpg) return 'image/jpeg';
  if (png) return 'image/png';
  if (webp) return 'image/webp';
  if (pdf) return 'application/pdf';
  throw new Error('Unsupported document contents');
}

function validateDocument(buffer, mime) {
  if (detectDocumentType(buffer) !== mime) throw new Error('Document type does not match its contents');
  return mime;
}

function assertKey(key, userId) {
  const match = typeof key === 'string' && KEY.exec(key);
  if (!match || (userId && match[1].toLowerCase() !== String(userId).toLowerCase())) throw new Error('Invalid document reference');
  return key;
}

function createStorage(env = process.env) {
  const driver = env.KYC_STORAGE_DRIVER;
  // Render's filesystem is ephemeral, even if NODE_ENV is accidentally set to development.
  if (driver === 'local' && !env.RENDER && !env.RENDER_SERVICE_ID && ['development', 'test'].includes(env.NODE_ENV) && path.isAbsolute(env.KYC_PRIVATE_DIRECTORY || '')) {
    const root = path.resolve(env.KYC_PRIVATE_DIRECTORY);
    const project = path.resolve(__dirname, '../..');
    const withinProject = candidate => {
      const relative = path.relative(project, candidate);
      return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
    };
    if (withinProject(root)) throw new Error('KYC storage must be outside the application directory');
    const target = async key => {
      assertKey(key);
      const actualRoot = await fs.realpath(root);
      if (withinProject(actualRoot)) throw new Error('KYC storage must be outside the application directory');
      return path.join(actualRoot, ...key.split('/'));
    };
    return {
      async put(key, buffer) { const file = await target(key); await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 }); await fs.writeFile(file, buffer, { mode: 0o600, flag: 'wx' }); },
      async exists(key) { try { return (await fs.stat(await target(key))).isFile(); } catch (err) { if (err.code === 'ENOENT') return false; throw err; } },
      async read(key) { return fs.readFile(await target(key)); },
    };
  }
  // Remote adapters require an explicit, separately reviewed implementation.
  // The put/exists/read contract above can be implemented by a private provider later.
  const error = new Error('Private KYC storage is unavailable');
  error.code = 'KYC_STORAGE_DISABLED';
  throw error;
}

async function storeDocument(userId, buffer, mime) {
  const key = assertKey(`kyc/${userId}/${crypto.randomUUID()}`, userId);
  validateDocument(buffer, mime);
  await createStorage().put(key, buffer, mime);
  return key;
}

async function documentExists(key, userId) { assertKey(key, userId); return createStorage().exists(key); }
async function readDocument(key, userId) { assertKey(key, userId); return createStorage().read(key); }
module.exports = { detectDocumentType, validateDocument, assertKey, storeDocument, documentExists, readDocument, LIMIT };
