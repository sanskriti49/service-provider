// Opt-in live check using a public landmark, never a user's saved location.
const {
    test
  } = require("node:test"),
  assert = require("node:assert/strict"),
  http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
test("live geocoding search and reverse lookup work from a browser origin", {
  skip: process.env.LOCATION_SERVICES_LIVE_TEST !== "1",
  timeout: 45000
}, async t => {
  const {
    chromium
  } = require("playwright");
  const source = fs.readFileSync(path.join(__dirname, "../src/utils/serviceLocation.js"), "utf8");
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", req.url === "/location.js" ? "text/javascript" : "text/html");
    res.end(req.url === "/location.js" ? source : "<!doctype html><title>Public landmark location check</title>");
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.TASKGENIE_BROWSER_CHANNEL ? {
      channel: process.env.TASKGENIE_BROWSER_CHANNEL
    } : {})
  });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const result = await page.evaluate(async () => {
    const helpers = await import("/location.js");
    const candidates = await helpers.addressCandidates("Gateway of India Mumbai");
    if (!candidates.length) throw Error("No landmark candidates returned");
    const selected = candidates[0];
    await new Promise(resolve => setTimeout(resolve, 1100));
    const reversed = await helpers.reverseLocation(selected.lat, selected.lng);
    return {
      candidates: candidates.length,
      searchValid: helpers.validCoordinates(selected.lat, selected.lng),
      reverseValid: helpers.validCoordinates(reversed.lat, reversed.lng),
      hasAddress: Boolean(reversed.address)
    };
  });
  assert.ok(result.candidates > 0 && result.searchValid && result.reverseValid && result.hasAddress);
});
