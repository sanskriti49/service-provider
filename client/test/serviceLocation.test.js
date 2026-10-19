import test from "node:test";
import { addressCandidates, reverseLocation } from "../src/utils/serviceLocation.js";
import assert from "node:assert/strict";
import { initialCustomerLocation, serviceLocation, editServiceAddress, bookingCoordinates, locationParams, requestCacheKey, createRequestGuard, indiaDate } from "../src/utils/serviceLocation.js";
test("provider coordinates can never initialize or enter customer booking coordinates", () => {
  const state = {
    provider: {
      lat: 12.97,
      lng: 77.59,
      latitude: 12.97,
      longitude: 77.59
    },
    address: 'Customer address'
  };
  const location = initialCustomerLocation(state);
  assert.equal(location.lat, null);
  assert.equal(location.lng, null);
  assert.throws(() => bookingCoordinates(location));
  const customer = initialCustomerLocation({
    ...state,
    serviceLocation: {
      address: 'Customer address',
      lat: 19,
      lng: 72,
      source: 'browser'
    }
  });
  assert.deepEqual(bookingCoordinates(customer), {
    latitude: 19,
    longitude: 72
  });
  assert.notEqual(customer.lat, state.provider.lat);
});
test("changing an address invalidates its old coordinates; coordinate-less saved addresses clear them", () => {
  const original = serviceLocation({
    address: 'First address',
    lat: 19,
    lng: 72
  });
  assert.equal(editServiceAddress(original, 'First address ').lat, 19);
  const edited = editServiceAddress(original, 'Second address');
  assert.equal(edited.lat, null);
  assert.throws(() => bookingCoordinates(edited));
  const saved = serviceLocation({
    full_address: 'Saved address',
    lat: null,
    lng: null
  });
  assert.equal(saved.lat, null);
  assert.equal(saved.lng, null);
  const confirmed = serviceLocation({
    address: 'Second address',
    lat: 20,
    lng: 73,
    source: 'geocoded'
  });
  assert.deepEqual(bookingCoordinates(confirmed), {
    latitude: 20,
    longitude: 73
  });
});
test("zero coordinates survive discovery, saved addresses and booking payloads", () => {
  const location = serviceLocation({
    full_address: 'Zero coordinate address',
    lat: 0,
    lng: 0
  });
  assert.deepEqual(locationParams(location), {
    lat: '0',
    lng: '0'
  });
  assert.deepEqual(bookingCoordinates(location), {
    latitude: 0,
    longitude: 0
  });
});
test("invalid coordinate pairs cannot enter a service location", () => {
  for (const values of [[91, 0], [0, 181], [null, 0], ['', 0], [NaN, 0], ['1junk', 0]]) assert.equal(serviceLocation({
    lat: values[0],
    lng: values[1]
  }).lat, null);
});
test("cache keys distinguish longitude, service, radius, filters and order independent params", () => {
  const base = {
    lat: 19,
    lng: 72,
    service: 'cleaning',
    radius: 50,
    sort_by: 'distance',
    max_price: 500
  };
  for (const changed of [{
    lng: 73
  }, {
    service: 'plumbing'
  }, {
    radius: 100
  }, {
    max_price: 600
  }, {
    sort_by: 'rating'
  }]) assert.notEqual(requestCacheKey('providers', base), requestCacheKey('providers', {
    ...base,
    ...changed
  }));
  assert.equal(requestCacheKey('providers', base), requestCacheKey('providers', Object.fromEntries(Object.entries(base).reverse())));
});
test("late responses cannot overwrite the newer request even if a transport ignores abort", async () => {
  const guard = createRequestGuard();
  let release;
  let displayed;
  const old = guard.begin();
  const pending = new Promise(r => release = r).then(value => {
    if (old.current()) displayed = value;
  });
  const current = guard.begin();
  assert.equal(old.signal.aborted, true);
  if (current.current()) displayed = 'new location';
  release('old location');
  await pending;
  assert.equal(displayed, 'new location');
  guard.cancel();
  assert.equal(current.current(), false);
});
test("dates use Asia/Kolkata across UTC midnight", () => {
  assert.equal(indiaDate(new Date('2026-10-14T20:00:00Z')), '2026-10-15');
  assert.equal(indiaDate(new Date('2026-10-14T20:00:00Z'), 1), '2026-10-16');
});
test("geocoding retains zero coordinates, rejects malformed results, and combines cancellation with a timeout",async t=>{
  const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});
  let signal;
  globalThis.fetch=async(url,options)=>{signal=options.signal;return{ok:true,json:async()=>[{display_name:'Confirmed zero location',lat:'0',lon:'0'},{display_name:'Invalid',lat:'91',lon:'0'}]};};
  const controller=new AbortController();const results=await addressCandidates('Zero address',controller.signal);
  assert.equal(results.length,1);assert.equal(results[0].lat,0);assert.equal(results[0].lng,0);
  controller.abort();assert.equal(signal.aborted,true);
  globalThis.fetch=async()=>({ok:true,json:async()=>({unexpected:true})});await assert.rejects(addressCandidates('Address'),/unavailable/);
  globalThis.fetch=async()=>({ok:false});await assert.rejects(reverseLocation(0,0),/resolve/);
});
