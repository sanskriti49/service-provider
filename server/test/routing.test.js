const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  Module = require('node:module');
function fixture(response, fail = false) {
  const calls = [];
  const filename = path.resolve(__dirname, '../utils/geoUtils.js'),
    instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = instance.require.bind(instance);
  instance.require = id => id === 'axios' ? {
    get: async url => {
      calls.push(url);
      if (fail) throw Error('offline');
      return {
        data: response
      };
    }
  } : original(id);
  instance._compile(fs.readFileSync(filename, 'utf8'), filename);
  return {
    geo: instance.exports,
    calls
  };
}
test('OSRM matrix yields distinct outgoing and incoming travel durations and caches the confirmed pair', async () => {
  const f = fixture({
    durations: [[0, 120], [600, 0]]
  });
  const value = await f.geo.getDirectionalTravelDurations([0, 0], [[1, 1]]);
  assert.deepEqual(value, {
    to: [2],
    from: [10]
  });
  await f.geo.getDirectionalTravelDurations([0, 0], [[1, 1]]);
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0], /sources=0;1&destinations=0;1/);
});
test('offline, malformed and unreachable routes cannot manufacture verified travel times', async () => {
  for (const f of [fixture({}, true), fixture({
    durations: [[0, null], [null, 0]]
  }), fixture({
    durations: [[0, 120]]
  })]) await assert.rejects(f.geo.getDirectionalTravelDurations([0, 0], [[1, 1]]), {
    code: 'ROUTING_UNAVAILABLE'
  });
});
