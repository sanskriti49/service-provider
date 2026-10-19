const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module");
function fixture({
  jobs = [],
  intervals = [{
    start_time: '09:00',
    end_time: '20:00'
  }],
  service = 'Electrical Repair',
  durations = {
    to: [2],
    from: [2]
  },
  routingError = false,
  exceptions = []
} = {}) {
  const routes = [],
    queries = [];
  const filename = path.resolve(__dirname, '../services/bookingSchedule.js'),
    instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = instance.require.bind(instance);
  instance.require = id => id === '../utils/geoUtils' ? {
    calculateHaversineDistance: require("../utils/geoUtils").calculateHaversineDistance,
    getDirectionalTravelDurations: async (origin, destinations) => {
      routes.push({
        origin,
        destinations
      });
      if (routingError) {
        const e = new Error('Routing unavailable');
        e.code = 'ROUTING_UNAVAILABLE';
        throw e;
      }
      return durations;
    }
  } : original(id);
  instance._compile(fs.readFileSync(filename, 'utf8'), filename);
  const client = {
    query: async (sql, params) => {
      queries.push({
        sql,
        params
      });
      if (sql.includes('SELECT ps.price')) return {
        rows: [{
          price: 500,
          name: service,
          service_id: 'service',
          provider_lat: 0,
          provider_lng: 0
        }]
      };
      if (sql.includes('AS valid')) return {
        rows: [{
          valid: true
        }]
      };
      if (sql.includes('provider_date_exceptions')) return {
        rows: exceptions.map(row => ({
          ...row,
          date_str: row.date_str || params[1]
        }))
      };
      if (sql.includes('provider_master_availability')) return {
        rows: sql.includes('SELECT day_of_week') ? [0, 1, 2, 3, 4, 5, 6].flatMap(day => intervals.map(row => ({
          ...row,
          day_of_week: day
        }))) : intervals
      };
      if (sql.includes('FROM bookings')) return {
        rows: jobs.map(row => ({
          ...row,
          date_str: row.date_str || params[1]
        }))
      };
      return {
        rows: []
      };
    }
  };
  const booking = {
    provider_id: 'provider',
    service_id: 'service',
    date: '2030-01-01',
    latitude: 0,
    longitude: 0
  };
  return {
    schedule: instance.exports,
    client,
    booking,
    routes,
    queries,
    async availability() {
      return (await instance.exports.getAvailability(client, {
        ...booking,
        from: booking.date,
        days: 1
      }, new Date('2026-01-01T00:00:00Z')))[0].free_slots;
    }
  };
}
const job = (start, end) => ({
  start_time: start,
  end_time: end,
  latitude: 1,
  longitude: 1
});
test('gaps of 120 minutes still require the actual travel buffer', async () => {
  const f = fixture({
    jobs: [job('14:00', '15:00')],
    durations: {
      to: [180],
      from: [180]
    }
  });
  const slots = await f.availability();
  assert.ok(!slots.some(s => s.start === '17:00'));
  await assert.rejects(f.schedule.validateSchedule(f.client, {
    ...f.booking,
    start_time: '17:00'
  }), {
    status: 409
  });
});
test('short trips never reduce the minimum service buffer', async () => {
  const f = fixture({
    jobs: [job('14:00', '15:00')],
    intervals: [{
      start_time: '15:10',
      end_time: '17:10'
    }]
  });
  assert.ok(!(await f.availability()).some(s => s.start === '15:10'));
  await assert.rejects(f.schedule.validateSchedule(f.client, {
    ...f.booking,
    start_time: '15:10'
  }), {
    status: 409
  });
});
test('travel before and after a booking uses the appropriate direction, including zero coordinates', async () => {
  const f = fixture({
    jobs: [job('14:00', '15:00')],
    durations: {
      to: [120],
      from: [10]
    }
  });
  const slots = await f.availability();
  assert.ok(!slots.some(s => s.start === '12:00'));
  assert.ok(slots.some(s => s.start === '16:00'));
  assert.deepEqual(f.routes[0], {
    origin: [0, 0],
    destinations: [[1, 1]]
  });
});
test('every advertised slot passes the final validator with identical data and routing', async () => {
  const f = fixture({
    jobs: [job('14:00', '15:00')],
    durations: {
      to: [120],
      from: [10]
    }
  });
  const slots = await f.availability();
  assert.ok(slots.length > 0);
  for (const slot of slots) await f.schedule.validateSchedule(f.client, {
    ...f.booking,
    start_time: slot.start
  });
});
test('routing failures fail closed consistently for displayed slots and final bookings', async () => {
  const f = fixture({
    jobs: [job('14:00', '15:00')],
    routingError: true
  });
  await assert.rejects(f.availability(), {
    status: 503
  });
  await assert.rejects(f.schedule.validateSchedule(f.client, {
    ...f.booking,
    start_time: '10:00'
  }), {
    status: 503
  });
});
test('unpublished schedules and date exceptions never generate default bookable hours', async () => {
  assert.deepEqual(await fixture({
    intervals: []
  }).availability(), []);
  assert.deepEqual(await fixture({
    exceptions: [{
      is_available: false
    }]
  }).availability(), []);
});
test('service durations and existing service buffers are respected', async () => {
  const f = fixture({
    service: 'House Cleaning',
    jobs: [{
      ...job('14:00', '15:00'),
      service_name: 'Painting'
    }]
  });
  const slots = await f.availability();
  assert.ok(slots.every(s => Number(s.end.slice(0, 2)) - Number(s.start.slice(0, 2)) === 2));
  assert.ok(!slots.some(s => s.start === '16:00'));
});
test('lead time is calculated in Asia/Kolkata even when the server timezone differs', async () => {
  const f = fixture({
    intervals: [{
      start_time: '01:00',
      end_time: '05:00'
    }]
  });
  const rows = await f.schedule.getAvailability(f.client, {
    ...f.booking,
    from: '2026-10-15',
    days: 1
  }, new Date('2026-10-14T20:00:00Z'));
  assert.ok(!rows[0].free_slots.some(s => s.start === '01:00'));
  assert.ok(rows[0].free_slots.some(s => s.start === '03:00'));
});
test('availability batches database reads across all requested dates', async () => {
  const f = fixture();
  const result = await f.schedule.getAvailability(f.client, {
    ...f.booking,
    from: f.booking.date,
    days: 14
  }, new Date('2026-01-01T00:00:00Z'));
  assert.equal(result.length, 14);
  assert.equal(f.queries.length, 5);
  assert.ok(result.every(day => day.free_slots.length > 0));
});
test('changing the customer address rechecks the selected radius in availability and final validation', async () => {
  const f = fixture();
  const changed = {
    ...f.booking,
    longitude: 1,
    radius: 50,
    start_time: '10:00'
  };
  await assert.rejects(f.schedule.validateSchedule(f.client, changed), {
    status: 409
  });
  await assert.rejects(f.schedule.getAvailability(f.client, {
    ...changed,
    from: changed.date,
    days: 1
  }), {
    status: 409
  });
  await f.schedule.validateSchedule(f.client, {
    ...changed,
    radius: 200
  });
  await assert.rejects(f.schedule.validateSchedule(f.client, {
    ...changed,
    latitude: null,
    longitude: null
  }), {
    status: 400
  });
});

test('internal scheduling callers cannot bypass location or radius by omitting parameters', async()=>{
  const f=fixture();
  for(const location of [{latitude:null,longitude:null},{latitude:undefined,longitude:undefined},{latitude:0,longitude:1}]) {
    const booking={...f.booking,...location,start_time:'10:00'};
    await assert.rejects(f.schedule.validateSchedule(f.client,booking),{status:location.longitude===1?409:400});
    await assert.rejects(f.schedule.getAvailability(f.client,{...booking,from:booking.date,days:1}),{status:location.longitude===1?409:400});
  }
  await f.schedule.validateLocationChange(f.client,{...f.booking,longitude:1,search_radius_km:200,start_time:'10:00',end_time:'11:00'});
});
test('an unpositioned existing booking blocks travel verification consistently', async()=>{
  const f=fixture({jobs:[{...job('14:00','15:00'),latitude:null,longitude:null}]});
  await assert.rejects(f.availability(),{status:409,message:/location confirmed/});
  await assert.rejects(f.schedule.validateSchedule(f.client,{...f.booking,start_time:'10:00'}),{status:409});
  assert.equal(f.routes.length,0);
});
