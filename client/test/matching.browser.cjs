// Real React pages with controlled API/geocoding fixtures; never creates an application booking.
const {
    test
  } = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path'),
  {
    pathToFileURL
  } = require('node:url'),
  {
    tmpdir
  } = require('node:os'),
  {
    mkdirSync
  } = require('node:fs');
test('discovery to booking keeps customer coordinates isolated', {
  skip: process.env.MATCHING_BROWSER_TEST !== '1',
  timeout: 180000
}, async t => {
  const root = path.resolve(__dirname, '../..');
  process.env.VITE_API_URL = '';
  const {
    createServer
  } = await import(pathToFileURL(path.join(root, 'client/node_modules/vite/dist/node/index.js')).href);
  const vite = await createServer({
    root: path.join(root, 'client'),
    server: {
      host: '127.0.0.1',
      port: 5192,
      strictPort: true
    }
  });
  await vite.listen();
  const {
    chromium
  } = require('playwright');
  let browser;
  t.after(async () => {
    if (browser) await browser.close();
    await vite.close();
  });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.TASKGENIE_BROWSER_CHANNEL ? {
      channel: process.env.TASKGENIE_BROWSER_CHANNEL
    } : {})
  });
  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 1000
    },
    geolocation: {
      latitude: 19.076,
      longitude: 72.8777
    },
    permissions: ['geolocation']
  });
  const user = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Test Customer',
    role: 'customer',
    exp: 4102444800
  };
  const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify(user)).toString('base64url')}.fixture`;
  await context.addInitScript(({
    user,
    token
  }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, {
    user,
    token
  });
  const provider = {
    user_id: '11111111-1111-4111-8111-111111111111',
    id: '11111111-1111-4111-8111-111111111111',
    custom_id: 'SRVMATCHINGTEST',
    name: 'Test Electrician',
    lat: 12.97,
    lng: 77.59,
    service_id: '33333333-3333-4333-8333-333333333333',
    service: 'Electrical Repair',
    service_slug: 'electrical-repair',
    price: 500,
    price_unit: 'visiting',
    rating: 4.5,
    is_verified: false,
    distance_km: 75,
    availability: []
  };
  const service = {
    id: provider.service_id,
    name: provider.service,
    slug: provider.service_slug,
    description: 'Fixture service',
    image_url: '/images/service-tools.png'
  };
  const slots = {
    provider_id: provider.user_id,
    availability: [{
      date: '2030-01-01',
      free_slots: [{
        start: '10:00',
        end: '11:00',
        start_time: '10:00',
        end_time: '11:00'
      }]
    }]
  };
  const discovery = [],
    availability = [],
    bookings = [],
    addressUpdates = [],
    errors = [];
  let failAvailability = false, allowFixtureSuccess = false;
  await context.route('**/*', async route => {
    const request = route.request(),
      url = new URL(request.url());
    const json = (data, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data)
    });
    if (url.hostname === 'nominatim.openstreetmap.org') {
      if (url.pathname === '/reverse') return json({
        display_name: 'Customer GPS address, Mumbai'
      });
      return json([{
        display_name: 'Confirmed second address, Pune',
        lat: '20.076',
        lon: '73.8777'
      },{display_name:'Alternative customer address',lat:'21.076',lon:'74.8777'}]);
    }
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname.startsWith('/socket.io')) return route.abort();
    if (url.pathname === '/api/auth/me') return json({
      user
    });
    if (url.pathname === '/api/account/addresses') return json({
      addresses: []
    });
    if (url.pathname.startsWith('/api/services/v1/')) return json(service);
    if (url.pathname === '/api/providers/v1') {
      discovery.push(Object.fromEntries(url.searchParams));
      return json(Number(url.searchParams.get('radius')) === 100 ? [provider] : []);
    }
    if (url.pathname.endsWith('/availability')) {
      availability.push(Object.fromEntries(url.searchParams));
      return failAvailability ? json({
        error: 'Routing temporarily unavailable'
      }, 503) : json(slots);
    }
    if (url.pathname === `/api/providers/v1/${provider.custom_id}`) return json({
      provider
    });
    if (url.pathname === '/api/bookings' && request.method() === 'POST') {
      bookings.push(request.postDataJSON());
      if(allowFixtureSuccess) return json({booking:{...request.postDataJSON(),booking_id:'44444444-4444-4444-8444-444444444444',user_id:user.id,created_at:new Date().toISOString(),search_radius_km:100}},201);
      return json({
        message: 'Fixture captured; no booking persisted'
      }, 409);
    }
    if(url.pathname.endsWith('/address') && request.method()==='PATCH') {
      const body=request.postDataJSON();addressUpdates.push(body);return json({address:body.address,message:'Fixture address verified'});
    }
    if (url.pathname.startsWith('/api/')) return json({
      conversations: [],
      notifications: [],
      unread_count: 0
    });
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('http://127.0.0.1:5192/services/electrical-repair', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.getByText('No providers found within 50 km', {
    exact: true
  }).waitFor();
  assert.ok(discovery.some(q => q.radius === '50' && q.lat === '19.076' && q.lng === '72.8777'));
  await page.getByRole('button', {
    name: 'Expand to 100 km',
    exact: true
  }).click();
  await page.getByText(provider.name, {
    exact: true
  }).waitFor();
  assert.ok(discovery.some(q => q.radius === '100' && q.service === provider.service_slug));
  await page.getByRole('button', {
    name: 'Check Availability',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: /10:00 AM - 11:00 AM/
  }).click();
  await page.getByRole('button', {
    name: 'Continue to Booking',
    exact: true
  }).click();
  await page.waitForURL('**/book/SRVMATCHINGTEST?service_id=*');
  await page.getByText('Customer GPS address, Mumbai', {
    exact: true
  }).first().waitFor();
  assert.ok(availability.some(q => q.service_id === provider.service_id && q.lat === '19.076' && q.lng === '72.8777'));
  const confirm = page.getByRole('button', {
    name: 'Confirm booking',
    exact: true
  }).filter({
    visible: true
  }).first();
  await confirm.click();
  await page.getByText('Fixture captured; no booking persisted').waitFor();
  assert.equal(bookings.length, 1);
  assert.equal(bookings[0].latitude, 19.076);
  assert.equal(bookings[0].longitude, 72.8777);
  assert.equal(bookings[0].radius, 100);
  assert.notEqual(bookings[0].latitude, provider.lat);
  await page.getByRole('button', {
    name: 'Edit',
    exact: true
  }).filter({
    visible: true
  }).first().click();
  await page.locator('#svc-address').fill('Second customer service address, Pune');
  await confirm.click();
  assert.equal(bookings.length, 1, 'an unconfirmed changed address cannot submit stale coordinates');
  await page.getByRole('button', {
    name: 'Find location',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Confirmed second address, Pune',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Use this address',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: /10:00/
  }).filter({
    visible: true
  }).first().click();
  await confirm.click();
  await page.getByText('Fixture captured; no booking persisted').waitFor();
  assert.equal(bookings.length, 2);
  assert.equal(bookings[1].latitude, 20.076);
  assert.equal(bookings[1].longitude, 73.8777);
  assert.equal(bookings[1].address, 'Second customer service address, Pune');
  assert.ok(availability.some(q => q.lat === '20.076' && q.lng === '73.8777' && q.service_id === provider.service_id));
  const output = path.join(tmpdir(), 'taskgenie-matching-ui');
  mkdirSync(output, {
    recursive: true
  });
  await page.screenshot({
    path: path.join(output, 'booking-confirmed-location.png'),
    fullPage: true
  });
  allowFixtureSuccess = true;
  await confirm.click();await page.waitForURL('**/booking-success');
  await page.getByRole('button',{name:'Change',exact:true}).click();
  await page.locator('textarea').fill('Changed confirmation-page address');
  await page.getByRole('button',{name:'Find location',exact:true}).click();
  const choices=page.getByRole('radio');await choices.first().waitFor();assert.equal(await choices.count(),2);
  assert.equal(await page.getByRole('radio',{checked:true}).count(),0,'No location is selected implicitly');
  await page.getByRole('radio',{name:'Confirmed second address, Pune',exact:true}).click();
  assert.equal(await page.getByRole('radio',{checked:true}).count(),1);
  await page.getByRole('button',{name:'Save address',exact:true}).click();
  await page.getByText('Confirmed second address, Pune',{exact:true}).waitFor();
  assert.deepEqual(addressUpdates,[{latitude:20.076,longitude:73.8777,address:'Confirmed second address, Pune'}]);
  failAvailability = true;
  await page.goto('http://127.0.0.1:5192/services/electrical-repair', {
    waitUntil: 'domcontentloaded'
  });
  await page.getByText('No providers found within 50 km', {
    exact: true
  }).waitFor();
  await page.getByRole('button', {
    name: 'Expand to 100 km'
  }).click();
  await page.getByRole('button', {
    name: 'Check Availability',
    exact: true
  }).click();
  await page.getByText('Routing temporarily unavailable').first().waitFor();
  assert.equal(await page.getByRole('button', {
    name: 'Continue to Booking',
    exact: true
  }).count(), 0);
  await context.clearPermissions();
  const requestsBefore=availability.length,bookingsBefore=bookings.length;
  await page.goto(`http://127.0.0.1:5192/book/${provider.custom_id}?service_id=${provider.service_id}&radius=100`,{waitUntil:'domcontentloaded'});
  await page.locator('#svc-address').waitFor();
  assert.equal(await page.locator('#svc-address').inputValue(),'','Provider coordinates must not create a customer address on a direct booking URL');
  await page.getByRole('button',{name:'Confirm booking',exact:true}).filter({visible:true}).first().click();
  assert.equal(availability.length,requestsBefore,'No location-free bookable availability request');
  assert.equal(bookings.length,bookingsBefore,'No booking without confirmed customer coordinates');
  assert.deepEqual(errors, []);
});
