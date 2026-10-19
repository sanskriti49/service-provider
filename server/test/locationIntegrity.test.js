const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  Module = require('node:module');
const response = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.data = data;
    return this;
  }
});
function load(file, stubs) {
  const filename = path.resolve(__dirname, file),
    instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = instance.require.bind(instance);
  instance.require = id => Object.hasOwn(stubs, id) ? stubs[id] : original(id);
  instance._compile(fs.readFileSync(filename, 'utf8'), filename);
  return instance.exports;
}

test('availability and dated discovery require a complete customer location and default to 50 km',()=>{
  const {availabilitySchema,discoverySchema}=require('../utils/location');
  for(const query of [{},{lat:0},{lat:null,lng:null},{lat:0,lng:181}]) assert.ok(availabilitySchema.validate(query).error);
  assert.equal(availabilitySchema.validate({lat:0,lng:0}).value.radius,50);
  assert.ok(discoverySchema.validate({date:'2030-01-01'}).error);
  assert.ok(!discoverySchema.validate({}).error,'Undated location-free browsing remains available with unknown distance');
});
test('legacy repair rejects guessed coordinates, missing confirmation and duplicate targets before connecting',async()=>{
  const {repairLocations}=require('../scripts/locationIntegrity');
  const db={connect:()=>{throw Error('Invalid repair must not reach the database');}};
  const valid={kind:'provider',id:'11111111-1111-4111-8111-111111111111',expected_address:'Owner confirmed base',latitude:0,longitude:0,confirmed:true};
  for(const manifest of [[{...valid,confirmed:false}],[{...valid,confirmed:'true'}],[{...valid,latitude:'0'}],[{...valid,latitude:null}],[{...valid,longitude:181}],[{...valid,id:'invalid'}],[valid,valid]]) await assert.rejects(repairLocations(db,manifest),{status:400});
});
test('changed profile locations clear stale coordinates, never geocode a city automatically, and invalidate discovery', async () => {
  const queries = [],
    invalidations = [];
  const controller = load('../controllers/usersController.js', {
    '../config/db': {
      query: async (sql, params) => {
        queries.push({
          sql,
          params
        });
        return {
          rowCount: 1,
          rows: sql.startsWith('SELECT location') ? [{
            location: 'Old city',
            address: 'Old address'
          }] : [{
            id: 'provider'
          }]
        };
      }
    },
    '../utils/cache': {
      delPattern: p => invalidations.push(p)
    },
    axios: {
      default: {
        get: () => {
          throw Error('Automatic geocoding is forbidden');
        }
      }
    }
  });
  const res = response();
  await controller.updateUser({
    params: {
      id: 'provider'
    },
    body: {
      location: 'New city'
    }
  }, res, e => {
    throw e;
  });
  assert.equal(res.statusCode, 200);
  const update = queries.find(q => q.sql.includes('UPDATE users'));
  assert.match(update.sql, /"lat" =/);
  assert.match(update.sql, /"lng" =/);
  assert.deepEqual(update.params.slice(0, 3), ['New city', null, null]);
  assert.deepEqual(invalidations, ['providers_']);
  queries.length = 0;
  await controller.updateUser({
    params: {
      id: 'provider'
    },
    body: {
      location: 'New city',
      lat: 0,
      lng: 0
    }
  }, response(), e => {
    throw e;
  });
  const explicit = queries.find(q => q.sql.includes('UPDATE users'));
  assert.deepEqual(explicit.params.slice(0, 3), ['New city', 0, 0]);
  queries.length = 0;
  const invalid = response();
  await controller.updateUser({
    params: {
      id: 'provider'
    },
    body: {
      lat: 91,
      lng: 0
    }
  }, invalid, () => {});
  assert.equal(invalid.statusCode, 400);
  assert.equal(queries.length, 0);
});
test('saved address changes clear old coordinates while label-only edits preserve them', async () => {
  for (const [body, clear] of [[{
    full_address: 'New address'
  }, true], [{
    label: 'Work'
  }, false], [{
    lat: null,
    lng: null
  }, true]]) {
    const queries = [];
    const controller = load('../controllers/accountController.js', {
      '../config/db': {
        query: async (sql, params) => {
          queries.push({
            sql,
            params
          });
          if (sql.startsWith('SELECT *')) return {
            rows: [{
              full_address: 'Old address',
              lat: 19,
              lng: 72
            }]
          };
          return {
            rows: [{}]
          };
        }
      }
    });
    await controller.updateAddress({
      user: {
        id: 'customer'
      },
      params: {
        id: '1'
      },
      body
    }, response(), e => {
      throw e;
    });
    const update = queries.find(q => q.sql.includes('UPDATE user_addresses SET\n'));
    assert.equal(update.params[12], clear);
    assert.equal(update.params[7], null);
    assert.equal(update.params[8], null);
  }
});
test('saved addresses store zero coordinates and reject malformed or partial pairs', async () => {
  const queries = [];
  const controller = load('../controllers/accountController.js', {
    '../config/db': {
      query: async (sql, params) => {
        queries.push({
          sql,
          params
        });
        return {
          rows: sql.includes('SELECT COUNT') ? [{
            count: '0'
          }] : [{}]
        };
      }
    }
  });
  const req = {
    user: {
      id: 'customer'
    },
    body: {
      full_address: 'Zero address',
      lat: 0,
      lng: 0
    }
  };
  const res = response();
  await controller.createAddress(req, res, e => {
    throw e;
  });
  assert.equal(res.statusCode, 201);
  const insert = queries.find(q => q.sql.includes('INSERT INTO user_addresses'));
  assert.equal(insert.params[8], 0);
  assert.equal(insert.params[9], 0);
  for (const coords of [{
    lat: 0
  }, {
    lat: '19junk',
    lng: 72
  }, {
    lat: 0,
    lng: 181
  }]) {
    const denied = response();
    await controller.createAddress({
      user: req.user,
      body: {
        full_address: 'Bad address',
        ...coords
      }
    }, denied, () => {});
    assert.equal(denied.statusCode, 400);
  }
});
