const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const geo = require("../utils/geoUtils");
function fixture(rows, supported = false, schemaError = false) {
  const queries = [],
    filename = path.resolve(__dirname, "../controllers/providerController.js"),
    instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = instance.require.bind(instance);
  const stubs = {
    "../config/db": {
      query: async (sql, params) => {
        queries.push({
          sql,
          params
        });
        if (sql.includes("pg_extension")) return {
          rows: [{
            supported
          }]
        };
        if (schemaError && sql.includes("ST_DWithin")) {
          const err = new Error("missing geom");
          err.code = "42703";
          throw err;
        }
        return {
          rows
        };
      }
    },
    "../utils/cache": {
      get: () => null,
      set: () => {}
    },
    "../services/bookingSchedule": {
      getAvailability: async (_, booking) => [{
        free_slots: booking.provider_id === 'unavailable' ? [] : [{
          start: '10:00'
        }]
      }],
      validateSchedule: async (_, booking) => {
        if (booking.provider_id === 'unavailable') {
          const e = new Error('unavailable');
          e.status = 409;
          throw e;
        }
      }
    }
  };
  instance.require = id => Object.hasOwn(stubs, id) ? stubs[id] : original(id);
  instance._compile(fs.readFileSync(filename, "utf8"), filename);
  return {
    queries,
    async request(query) {
      const res = {
        statusCode: 200,
        status(n) {
          this.statusCode = n;
          return this;
        },
        json(data) {
          this.data = data;
          return this;
        }
      };
      await instance.exports.getProviders({
        query
      }, res, e => {
        throw e;
      });
      return res;
    }
  };
}
const provider = (id, lat, lng, extra = {}) => ({
  user_id: id,
  lat,
  lng,
  price: 500,
  rating: 4.5,
  service_id: 'service',
  availability: [],
  ...extra
});
test("default radius excludes distant and unknown providers without any fallback", async () => {
  const f = fixture([provider('near', 0, 0), provider('far', 0, 1), provider('unknown', null, null)]);
  const res = await f.request({
    service: 'cleaning',
    lat: '0',
    lng: '0'
  });
  assert.deepEqual(res.data.map(p => p.user_id), ['near']);
  assert.equal(res.data[0].distance_km, 0);
  const empty = await fixture([provider('far', 0, 1)]).request({
    service: 'cleaning',
    lat: 0,
    lng: 0
  });
  assert.deepEqual(empty.data, []);
});
test("radius and service/price/rating filters stay in the sole SQL query", async () => {
  const f = fixture([], true);
  const res = await f.request({
    service: 'missing',
    lat: 0,
    lng: 0,
    radius: 100,
    min_rating: 5,
    max_price: 0
  });
  assert.deepEqual(res.data, []);
  assert.equal(f.queries.length, 2);
  const q = f.queries[1];
  assert.match(q.sql, /ST_DWithin/);
  assert.match(q.sql, /COALESCE\(p.rating,0\)>=/);
  assert.match(q.sql, /ps.price<=/);
  assert.ok(q.params.includes('missing'));
  assert.ok(q.params.includes(0));
  assert.ok(q.params.includes(100000.01));
  assert.doesNotMatch(q.sql, /LIMIT/);
});
test("invalid, partial coordinates, malformed dates and unsupported parameters return 400", async () => {
  for (const query of [{
    lat: 0
  }, {
    lat: 91,
    lng: 0
  }, {
    lat: '19junk',
    lng: 0
  }, {
    lat: Infinity,
    lng: 0
  }, {
    radius: 0
  }, {
    radius: -1
  }, {
    radius: 501
  }, {
    sort_by: 'random'
  }, {
    date: '2030-02-30'
  }, {
    start_time: '10:00'
  }]) {
    const f = fixture([]);
    const res = await f.request(query);
    assert.equal(res.statusCode, 400, JSON.stringify(query));
    assert.equal(f.queries.length, 0);
  }
});
test("both spatial and fallback paths use full precision at the radius boundary", async () => {
  const lng = 50.04 / 6371.00877141506 * 180 / Math.PI;
  for (const supported of [false, true]) {
    const res = await fixture([provider('outside', 0, lng), provider('inside', 0, lng - 0.001)], supported).request({
      lat: 0,
      lng: 0,
      radius: 50,
      sort_by: 'distance'
    });
    assert.deepEqual(res.data.map(p => p.user_id), ['inside']);
    assert.ok(res.data[0].distance_km % 0.1 !== 0);
  }
});
test("unknown distance stays unknown and does not receive proximity or guaranteed availability credit", async () => {
  const res = await fixture([provider('unknown', null, null, {
    is_verified: false
  })]).request({});
  assert.equal(res.data[0].is_nearby, null);
  assert.equal(res.data[0].availability_status, 'unknown');
  assert.equal(res.data[0].is_verified, false);
  assert.ok(geo.calculateMatchScore({
    distanceKm: null
  }) < geo.calculateMatchScore({
    distanceKm: 25
  }));
});
test("partial spatial migrations gracefully use the same strict fallback", async () => {
  const f = fixture([provider('near', 0, 0), provider('far', 0, 1)], true, true);
  const res = await f.request({
    lat: 0,
    lng: 0
  });
  assert.deepEqual(res.data.map(p => p.user_id), ['near']);
  assert.equal(f.queries.length, 3);
});
test("dated discovery checks actual schedule availability", async () => {
  for (const extra of [{}, {
    start_time: '10:00'
  }]) {
    const res = await fixture([provider('available', 0, 0), provider('unavailable', 0, 0)]).request({
      date: '2030-01-01',
      lat: 0, lng: 0, radius: 100,
      ...extra
    });
    assert.deepEqual(res.data.map(p => p.user_id), ['available']);
    assert.equal(res.data[0].availability_status, 'available');
  }
});
