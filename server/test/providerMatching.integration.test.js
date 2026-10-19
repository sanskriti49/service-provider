// Opt-in checks of the configured database. Every query runs inside BEGIN READ ONLY.
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  Module = require('node:module');
test('real SQL spatial/fallback discovery and advertised slots agree', {
  skip: process.env.MATCHING_DATABASE_TEST !== '1',
  timeout: 60000
}, async () => {
  process.env.NODE_ENV = 'test';
  const db = require('../config/db');
  let client;
  try {
    client = await db.connect();
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout='8s'");
    const sample = (await client.query("SELECT u.lat,u.lng,p.user_id,s.id AS service_id,s.slug FROM users u JOIN providers p ON p.user_id=u.id JOIN provider_services ps ON ps.provider_id=u.id JOIN services s ON s.id=ps.service_id WHERE u.lat BETWEEN -90 AND 90 AND u.lng BETWEEN -180 AND 180 AND p.status='approved' AND ps.is_visible=TRUE ORDER BY u.id LIMIT 1")).rows[0];
    assert.ok(sample, 'An approved provider with coordinates and a visible service is required');
    function load(forceFallback) {
      const filename = path.resolve(__dirname, '../controllers/providerController.js'),
        instance = new Module(filename, module);
      instance.filename = filename;
      instance.paths = Module._nodeModulePaths(path.dirname(filename));
      const original = instance.require.bind(instance);
      instance.require = id => id === '../config/db' ? {
        query: (sql, params) => forceFallback && sql.includes('AS supported') ? Promise.resolve({
          rows: [{
            supported: false
          }]
        }) : client.query(sql, params)
      } : id === '../utils/cache' ? {
        get: () => null,
        set: () => {}
      } : original(id);
      instance._compile(fs.readFileSync(filename, 'utf8'), filename);
      return instance.exports;
    }
    const spatial = load(false),
      fallback = load(true);
    let detail;
    await spatial.getProviderById({
      params: {
        custom_id: sample.user_id
      },
      query: {
        service_id: String(sample.service_id)
      }
    }, {
      status(code) {
        throw Error(`Unexpected detail status ${code}`);
      },
      json(value) {
        detail = value;
      }
    }, e => {
      throw e;
    });
    assert.equal(detail.provider.service_id, sample.service_id);
    async function request(controller, query) {
      let data;
      await controller.getProviders({
        query
      }, {
        status(code) {
          throw Error(`Unexpected status ${code}`);
        },
        json(value) {
          data = value;
        }
      }, e => {
        throw e;
      });
      return data;
    }
    for (const query of [{
      service: sample.slug,
      lat: sample.lat,
      lng: sample.lng
    }, {
      service: sample.slug,
      lat: sample.lat,
      lng: sample.lng,
      radius: 100
    }, {
      service: sample.slug,
      lat: sample.lat,
      lng: sample.lng,
      max_price: 0
    }, {
      service: 'no-such-matching-test-service',
      lat: 0,
      lng: 0
    }]) {
      const a = await request(spatial, query),
        b = await request(fallback, query);
      assert.deepEqual(a.map(p => p.user_id), b.map(p => p.user_id));
      assert.ok(a.every(p => p.is_nearby === true && p.distance_km <= (query.radius || 50)));
      if (query.service.startsWith('no-such')) assert.deepEqual(a, []);
    }
    const schedule = require('../services/bookingSchedule');
    const date = '2040-01-03';
    const days = await schedule.getAvailability(client, {
      provider_id: sample.user_id,
      service_id: sample.service_id,
      from: date,
      days: 1,
      latitude: sample.lat,
      longitude: sample.lng
    });
    for (const slot of days[0].free_slots) await schedule.validateSchedule(client, {
      provider_id: sample.user_id,
      service_id: sample.service_id,
      date,
      start_time: slot.start,
      latitude: sample.lat,
      longitude: sample.lng
    });
    await client.query('ROLLBACK');
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client?.release();
    await db.end();
  }
});
