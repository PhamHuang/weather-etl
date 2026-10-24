// Optional DOM integration check: npm install --prefix .preview jsdom
// Run with: node tests/dashboard-smoke.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("../.preview/node_modules/jsdom");

const root = path.resolve(__dirname, "..");
const dom = new JSDOM(fs.readFileSync(path.join(root, "templates/index.html"), "utf8"), {
  url: "http://localhost:5000/?mode=demo",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const window = dom.window;
const document = window.document;
const $ = (selector) => document.querySelector(selector);
const cities = { Hanoi: "Hà Nội", "Ho Chi Minh City": "TP. Hồ Chí Minh", "Da Nang": "Đà Nẵng" };
const requests = [];
const downloaded = [];
let fail = false;
let empty = false;

window.ResizeObserver = class { observe() {} };
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };
window.URL.createObjectURL = (blob) => { downloaded.push(blob); return "blob:test"; };
window.URL.revokeObjectURL = () => {};
window.HTMLAnchorElement.prototype.click = function () { downloaded.push(this.download); };
Object.defineProperties($("#chart-container"), { clientWidth: { value: 900 }, clientHeight: { value: 230 } });

function payload(query) {
  const city = query.get("city");
  const hours = Number(query.get("hours"));
  const end = new Date("2026-10-18T12:30:00+07:00");
  const records = empty ? [] : Array.from({ length: hours }, (_, index) => ({
    city,
    observed_at: new Date(end.getTime() - (hours - index) * 3600000 + 1800000).toISOString(),
    loaded_at: end.toISOString(),
    temperature_c: 24 + index % 8,
    humidity_pct: index === hours - 1 ? null : 75,
    precipitation_mm: index % 7 ? 0 : 1.2,
    wind_speed_kmh: 10,
    temp_category: "warm",
  }));
  return {
    source: query.get("mode"), city, city_name: cities[city], hours,
    start: new Date(end.getTime() - hours * 3600000).toISOString(),
    end: end.toISOString(), generated_at: end.toISOString(), last_loaded_at: records.length ? end.toISOString() : null,
    latest: records.at(-1) || null, records,
    summary: { count: records.length, temperature_min: records.length ? 24 : null, temperature_max: records.length ? 31 : null, precipitation_total: records.length ? 4.8 : null },
    cities: Object.entries(cities).map(([id, name]) => ({ id, name, latitude: 21, longitude: 105, latest: records.at(-1) ? { ...records.at(-1), city: id } : null })),
  };
}

window.fetch = async (url) => {
  const query = new URL(url, "http://localhost:5000").searchParams;
  requests.push(query);
  return { ok: !fail, json: async () => fail ? { error: "Database chưa sẵn sàng", detail: "Kiểm tra kết nối PostgreSQL." } : payload(query) };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const click = async (selector) => { $(selector).click(); await settle(); };
const change = async (selector, value) => { $(selector).value = value; $(selector).dispatchEvent(new window.Event("change", { bubbles: true })); await settle(); };

(async () => {
  try {
    window.eval(fs.readFileSync(path.join(root, "static/app.js"), "utf8"));
    await settle();
    assert.match($("#notice-title").textContent, /dữ liệu mẫu/);
    assert.equal($("#export-button").disabled, false);
    assert.equal($("#table-body").children.length, 8);
    assert.match($("#metric-humidity").textContent, /—/);
    assert.match($("#record-count").textContent, /24 bản ghi/);
    assert.ok($("#weather-chart .chart-line"));

    await change("#city-select", "Da Nang");
    assert.equal(requests.at(-1).get("city"), "Da Nang");
    assert.match($("#hero-location").textContent, /Đà Nẵng/);

    await click('[data-hours="48"]');
    assert.equal(requests.at(-1).get("hours"), "48");
    assert.equal($("#page-number").textContent, "1 / 6");
    await click("#next-page");
    assert.equal($("#page-number").textContent, "2 / 6");
    await click("#sort-button");
    assert.equal($("#page-number").textContent, "1 / 6");
    assert.equal($("#sort-direction").textContent, "↑");

    await click('[data-metric="wind_speed_kmh"]');
    assert.equal($("#chart-legend").textContent, "Tốc độ gió (km/h)");
    $("#weather-chart").dispatchEvent(new window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
    assert.equal($("#chart-tooltip").hidden, false);
    assert.match($("#chart-tooltip").textContent, /10 km\/h/);

    await click("#export-button");
    assert.equal(downloaded.length, 2);
    assert.equal(downloaded[1], "weather-da-nang-48h-demo.csv");
    assert.ok(downloaded[0].size > 2000);
    await click("#about-button");
    assert.equal($("#about-dialog").open, true);
    await click("#close-dialog");
    assert.equal($("#about-dialog").open, false);

    fail = true;
    await change("#mode-select", "live");
    assert.equal($("#export-button").disabled, true);
    assert.match($("#notice-detail").textContent, /PostgreSQL/);
    assert.equal($("#hero-temperature").textContent, "—");
    assert.equal($("#demo-button").hidden, false);
    assert.equal($("#weather-chart").children.length, 0);

    fail = false;
    await click("#demo-button");
    assert.equal($("#mode-select").value, "demo");
    assert.equal($("#export-button").disabled, false);

    empty = true;
    await change("#mode-select", "live");
    assert.match($("#notice-title").textContent, /Chưa có dữ liệu/);
    assert.equal($("#export-button").disabled, true);
    assert.match($("#table-body").textContent, /Chưa có bản ghi/);
    assert.equal($("#next-page").disabled, true);
    console.log("Dashboard DOM checks passed: filters, metrics, chart, pagination, sorting, CSV, dialog, failure, recovery and empty state.");
  } finally {
    window.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
