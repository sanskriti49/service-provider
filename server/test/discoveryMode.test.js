const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

test('provider discovery requires coordinates unless unfiltered mode is explicit', async () => {
  const filename = path.resolve(__dirname, '../controllers/providerController.js');
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = instance.require.bind(instance);
  let queries = 0;
  const stubs = {
    '../config/db': { query: async sql => {
      queries++;
      if (sql.includes('pg_extension')) return { rows: [{ supported: false }] };
      return { rows: [{ user_id: 'example', lat: 1, lng: 1, price: 100, rating: 4 }] };
    } },
    '../utils/cache': { get: () => null, set: () => {} },
  };
  instance.require = id => Object.hasOwn(stubs, id) ? stubs[id] : original(id);
  instance._compile(fs.readFileSync(filename, 'utf8'), filename);
  async function request(query) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
    await instance.exports.getProviders({ query }, res, err => { throw err; });
    return res;
  }
  const missing = await request({ service: 'cleaning', radius: '50' });
  assert.equal(missing.statusCode, 400);
  assert.match(missing.data.error, /mode=all/);
  assert.equal(queries, 0);
  const explicit = await request({ service: 'cleaning', mode: 'all' });
  assert.equal(explicit.statusCode, 200);
  assert.equal(explicit.data.length, 1);
  const nearby = await request({ service: 'cleaning', lat: 1, lng: 1, radius: 50 });
  assert.equal(nearby.statusCode, 200);
  assert.equal(nearby.data.length, 1);
});
