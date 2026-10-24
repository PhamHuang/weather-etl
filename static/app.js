"use strict";

const $ = (selector) => document.querySelector(selector);
const cityLabels = { Hanoi: "Hà Nội", "Ho Chi Minh City": "TP. Hồ Chí Minh", "Da Nang": "Đà Nẵng" };
const categoryLabels = { cold: "Se lạnh", mild: "Dịu mát", warm: "Ấm áp", hot: "Nóng" };
const metricDefinitions = {
  temperature_c: { name: "Nhiệt độ", unit: "°C" },
  humidity_pct: { name: "Độ ẩm", unit: "%" },
  precipitation_mm: { name: "Lượng mưa", unit: "mm" },
  wind_speed_kmh: { name: "Tốc độ gió", unit: "km/h" },
};
const params = new URLSearchParams(window.location.search);
const state = {
  city: Object.hasOwn(cityLabels, params.get("city")) ? params.get("city") : "Hanoi",
  hours: [24, 48, 168].includes(Number(params.get("hours"))) ? Number(params.get("hours")) : 24,
  mode: params.get("mode") === "demo" ? "demo" : "live",
  metric: "temperature_c",
  payload: null,
  page: 1,
  descending: true,
  controller: null,
  chartPoints: [],
  chartIndex: 0,
  loadFailed: false,
};
const PAGE_SIZE = 8;
const localeNumber = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" });
const timeFormatter = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const number = (value) => typeof value === "number" && Number.isFinite(value) ? localeNumber.format(value) : "—";
const date = (value) => dateFormatter.format(new Date(value));
const time = (value) => timeFormatter.format(new Date(value));
const period = () => state.hours === 168 ? "7 ngày" : `${state.hours} giờ`;

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

function showNotice(title, detail, { error = false, demoButton = false } = {}) {
  $("#notice").hidden = false;
  $("#notice").classList.toggle("error", error);
  $("#notice-title").textContent = title;
  $("#notice-detail").textContent = detail;
  $("#demo-button").hidden = !demoButton;
}

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => { $("#toast").hidden = true; }, 3500);
}

function updateControls() {
  $("#city-select").value = state.city;
  $("#mode-select").value = state.mode;
  for (const button of document.querySelectorAll("[data-hours]")) {
    const selected = Number(button.dataset.hours) === state.hours;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  for (const button of document.querySelectorAll("[data-metric]")) {
    const selected = button.dataset.metric === state.metric;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
}

async function loadData(manual = false) {
  state.controller?.abort();
  const controller = new AbortController();
  state.controller = controller;
  state.loadFailed = false;
  updateControls();
  document.body.classList.add("loading");
  $("#weather-content").setAttribute("aria-busy", "true");
  $("#refresh-button").disabled = true;
  $("#export-button").disabled = true;
  $("#connection").className = "connection";
  $("#connection").replaceChildren(Object.assign(document.createElement("span"), { className: "status-dot" }), "Đang tải dữ liệu…");
  const query = new URLSearchParams({ city: state.city, hours: state.hours, mode: state.mode });
  window.history.replaceState(null, "", `${window.location.pathname}?${query}${window.location.hash}`);
  const timeout = window.setTimeout(() => controller.abort("timeout"), 15000);
  try {
    const response = await fetch(`/api/weather?${query}`, { signal: controller.signal, cache: "no-store" });
    const payload = await response.json();
    if (state.controller !== controller) return;
    if (!response.ok) throw new Error([payload.error, payload.detail].filter(Boolean).join(" "));
    if (!Array.isArray(payload.records) || !Array.isArray(payload.cities)) throw new Error("Phản hồi dữ liệu không hợp lệ.");
    state.payload = payload;
    state.page = 1;
    renderDashboard();
    if (manual) toast(state.mode === "demo" ? "Đã làm mới dữ liệu minh họa." : "Đã đọc lại dữ liệu từ PostgreSQL.");
  } catch (error) {
    if (state.controller !== controller) return;
    state.payload = null;
    state.page = 1;
    state.loadFailed = true;
    renderDashboard();
    showNotice("Chưa thể tải dữ liệu", controller.signal.reason === "timeout" ? "Kết nối mất quá lâu. Bạn có thể thử làm mới hoặc xem bản demo." : (error.message || "Kiểm tra kết nối và thử lại."), { error: true, demoButton: state.mode !== "demo" });
  } finally {
    window.clearTimeout(timeout);
    if (state.controller === controller) {
      document.body.classList.remove("loading");
      $("#weather-content").setAttribute("aria-busy", "false");
      $("#refresh-button").disabled = false;
      $("#export-button").disabled = !state.payload?.records.length;
    }
  }
}

function renderDashboard() {
  const payload = state.payload;
  const latest = payload?.latest;
  const summary = payload?.summary;
  const name = cityLabels[state.city];
  $("#hero-location").textContent = `${name}, Việt Nam`;
  $("#hero-temperature").textContent = number(latest?.temperature_c);
  $("#hero-condition").textContent = latest ? `${categoryLabels[latest.temp_category] || "Chưa phân loại"}${latest.precipitation_mm > 0 ? " · Có mưa" : ""}` : "Chưa có bản ghi để hiển thị";
  $("#hero-min").textContent = `${number(summary?.temperature_min)}°`;
  $("#hero-max").textContent = `${number(summary?.temperature_max)}°`;
  $("#hero-time").textContent = latest ? `${time(latest.observed_at)} · ${date(latest.observed_at)} · UTC+7` : "Thời gian địa phương · UTC+7";
  const selectedCity = payload?.cities.find((city) => city.id === state.city);
  const fallbackCoordinates = { Hanoi: [21.0285, 105.8542], "Ho Chi Minh City": [10.8231, 106.6297], "Da Nang": [16.0544, 108.2022] };
  const [lat, lon] = selectedCity ? [selectedCity.latitude, selectedCity.longitude] : fallbackCoordinates[state.city];
  $("#hero-coordinates").textContent = `${lat.toFixed(4)}° N · ${lon.toFixed(4)}° E`;
  $("#metric-range").replaceChildren(`${number(summary?.temperature_min)} → ${number(summary?.temperature_max)} `, Object.assign(document.createElement("span"), { textContent: "°C" }));
  $("#metric-humidity").replaceChildren(number(latest?.humidity_pct), Object.assign(document.createElement("span"), { textContent: "%" }));
  $("#metric-rain").replaceChildren(number(summary?.precipitation_total), Object.assign(document.createElement("span"), { textContent: "mm" }));
  $("#metric-wind").replaceChildren(number(latest?.wind_speed_kmh), Object.assign(document.createElement("span"), { textContent: "km/h" }));
  $("#rain-period").textContent = `Trong ${period()} đã chọn`;
  $("#chart-subtitle").textContent = `Diễn biến ${period()} qua · ${name}`;
  $("#record-count").textContent = `${summary?.count || 0} bản ghi`;
  $("#notice").hidden = true;
  const connection = $("#connection");
  connection.className = `connection${state.loadFailed ? " error" : state.mode === "demo" ? " demo" : ""}`;
  const status = state.loadFailed ? "Kết nối chưa sẵn sàng" : state.mode === "demo" ? "Chế độ minh họa" : "Đã kết nối PostgreSQL";
  connection.replaceChildren(Object.assign(document.createElement("span"), { className: "status-dot" }), status);
  if (payload) {
    if (payload.source === "demo") {
      showNotice("Bạn đang xem dữ liệu mẫu", "Các giá trị được tạo để minh họa giao diện, không phản ánh thời tiết thực tế. Chọn “Dữ liệu PostgreSQL” để xem dữ liệu của dự án.");
    } else if (!latest) {
      showNotice("Chưa có dữ liệu trong khoảng đã chọn", "Chạy python main.py để nạp dữ liệu, thử khoảng 48 giờ hoặc 7 ngày, sau đó bấm Làm mới.", { demoButton: true });
    } else {
      const ageHours = (new Date(payload.generated_at) - new Date(latest.observed_at)) / 3600000;
      if (ageHours > 3) showNotice("Bản ghi gần nhất đã hơn 3 giờ", "Pipeline chưa có bản ghi mới hơn trong khoảng đang chọn. Chạy python main.py để cập nhật dữ liệu.");
    }
    if (payload.last_loaded_at) connection.title = `Dữ liệu được nạp lúc ${time(payload.last_loaded_at)} ${date(payload.last_loaded_at)} (UTC+7)`;
    else connection.removeAttribute("title");
  } else connection.removeAttribute("title");
  renderCities();
  renderChart();
  renderTable();
}

function renderCities() {
  const cities = state.payload?.cities || Object.entries(cityLabels).map(([id, name]) => ({ id, name, latest: null }));
  $("#city-list").replaceChildren(...cities.map((city) => {
    const button = document.createElement("button");
    button.className = "city-item";
    button.setAttribute("aria-label", `Xem thời tiết ${city.name}`);
    button.setAttribute("aria-pressed", String(city.id === state.city));
    const weatherIcon = document.createElement("span");
    weatherIcon.className = "city-icon";
    weatherIcon.append(icon(city.latest?.precipitation_mm > 0 ? "rain" : "sun"));
    const info = document.createElement("div");
    const title = document.createElement("span");
    title.className = "city-name";
    title.textContent = city.name;
    if (city.id === state.city) title.append(Object.assign(document.createElement("span"), { className: "status-dot" }));
    const meta = document.createElement("p");
    meta.className = "city-meta";
    meta.textContent = city.latest ? `${time(city.latest.observed_at)} · ${date(city.latest.observed_at)} · ${categoryLabels[city.latest.temp_category] || "Chưa phân loại"}` : "Chưa có dữ liệu";
    info.append(title, meta);
    const temperature = document.createElement("span");
    temperature.className = "city-temperature";
    temperature.append(number(city.latest?.temperature_c), Object.assign(document.createElement("small"), { textContent: "°C" }));
    button.append(weatherIcon, info, temperature, icon("chevron"));
    button.addEventListener("click", () => { state.city = city.id; loadData(); });
    return button;
  }));
}

function renderChart() {
  const svg = $("#weather-chart");
  const container = $("#chart-container");
  const rows = state.payload?.records || [];
  const metric = metricDefinitions[state.metric];
  $("#chart-tooltip").hidden = true;
  $("#chart-legend").textContent = `${metric.name} (${metric.unit})`;
  const values = rows.map((row) => row[state.metric]).filter((value) => typeof value === "number" && Number.isFinite(value));
  state.chartPoints = [];
  svg.replaceChildren();
  svg.setAttribute("aria-label", `${metric.name} theo giờ tại ${cityLabels[state.city]}, ${period()} qua. Chi tiết có trong bảng dữ liệu bên dưới.`);
  if (!values.length) {
    $("#chart-empty").hidden = false;
    $("#chart-empty").textContent = state.loadFailed ? "Biểu đồ sẽ xuất hiện khi kết nối dữ liệu sẵn sàng." : "Chưa có dữ liệu cho biểu đồ trong khoảng này.";
    svg.removeAttribute("tabindex");
    return;
  }
  $("#chart-empty").hidden = true;
  svg.setAttribute("tabindex", "0");
  const width = Math.max(280, container.clientWidth);
  const height = Math.max(190, container.clientHeight);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const bounds = { left: 38, right: width - 15, top: 14, bottom: height - 30 };
  let min = Math.floor(Math.min(...values) - 2);
  let max = Math.ceil(Math.max(...values) + 2);
  if (state.metric === "humidity_pct") { min = 0; max = 100; }
  if (["precipitation_mm", "wind_speed_kmh"].includes(state.metric)) { min = 0; max = Math.max(1, Math.ceil(Math.max(...values) * 1.2)); }
  const start = new Date(state.payload.start).getTime();
  const end = new Date(state.payload.end).getTime();
  const x = (timestamp) => bounds.left + (timestamp - start) / (end - start) * (bounds.right - bounds.left);
  const y = (value) => bounds.bottom - (value - min) / (max - min) * (bounds.bottom - bounds.top);
  let markup = `<defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#a4bd82" stop-opacity=".25"/><stop offset="100%" stop-color="#a4bd82" stop-opacity=".015"/></linearGradient></defs>`;
  for (let index = 0; index <= 4; index++) {
    const value = min + (max - min) * index / 4;
    const at = y(value);
    markup += `<line class="chart-grid" x1="${bounds.left}" y1="${at}" x2="${bounds.right}" y2="${at}"/><text class="chart-label" x="${bounds.left - 12}" y="${at + 3}" text-anchor="end">${number(value)}</text>`;
  }
  const tickCount = width < 500 ? 4 : 7;
  for (let index = 0; index < tickCount; index++) {
    const at = start + (end - start) * index / (tickCount - 1);
    const label = state.hours === 168 ? date(at) : time(at);
    markup += `<text class="chart-label" x="${x(at)}" y="${height - 8}" text-anchor="${index === 0 ? "start" : index === tickCount - 1 ? "end" : "middle"}">${label}</text>`;
  }
  const segments = [];
  let segment = [];
  let previousTime = null;
  for (const row of rows) {
    const value = row[state.metric];
    const timestamp = new Date(row.observed_at).getTime();
    if (typeof value !== "number" || !Number.isFinite(value) || (previousTime !== null && timestamp - previousTime > 5400000)) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      const point = { x: x(timestamp), y: y(value), row, value };
      segment.push(point);
      state.chartPoints.push(point);
    }
    previousTime = timestamp;
  }
  if (segment.length) segments.push(segment);
  for (const points of segments) {
    const line = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
    if (points.length > 1) markup += `<path d="${line} L${points.at(-1).x},${bounds.bottom} L${points[0].x},${bounds.bottom} Z" fill="url(#chart-fill)"/><path class="chart-line" d="${line}"/>`;
    else markup += `<circle class="chart-dot" cx="${points[0].x}" cy="${points[0].y}" r="4"/>`;
  }
  markup += `<line id="chart-crosshair" x1="0" y1="${bounds.top}" x2="0" y2="${bounds.bottom}" stroke="#b8c6aa" stroke-dasharray="3 4" visibility="hidden"/><circle id="chart-marker" r="4.5" fill="#6e9261" stroke="white" stroke-width="2" visibility="hidden"/>`;
  svg.innerHTML = markup;
}

function showChartPoint(index) {
  const point = state.chartPoints[index];
  if (!point) return;
  state.chartIndex = index;
  const tooltip = $("#chart-tooltip");
  const metric = metricDefinitions[state.metric];
  tooltip.textContent = `${time(point.row.observed_at)} · ${date(point.row.observed_at)}\n${metric.name}: ${number(point.value)} ${metric.unit}`;
  tooltip.hidden = false;
  const container = $("#chart-container");
  tooltip.style.left = `${Math.max(0, Math.min(point.x + 13, container.clientWidth - tooltip.offsetWidth))}px`;
  tooltip.style.top = `${Math.max(0, point.y - tooltip.offsetHeight - 12)}px`;
  const marker = $("#chart-marker");
  marker.setAttribute("cx", point.x);
  marker.setAttribute("cy", point.y);
  marker.setAttribute("visibility", "visible");
  const line = $("#chart-crosshair");
  line.setAttribute("x1", point.x);
  line.setAttribute("x2", point.x);
  line.setAttribute("visibility", "visible");
}

function hideTooltip() {
  $("#chart-tooltip").hidden = true;
  $("#chart-marker")?.setAttribute("visibility", "hidden");
  $("#chart-crosshair")?.setAttribute("visibility", "hidden");
}

function sortedRecords() {
  const rows = [...(state.payload?.records || [])];
  return state.descending ? rows.reverse() : rows;
}

function renderTable() {
  const rows = sortedRecords();
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.page = Math.min(pageCount, state.page);
  const first = (state.page - 1) * PAGE_SIZE;
  const tbody = $("#table-body");
  tbody.replaceChildren();
  if (!rows.length) {
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "empty-cell";
    cell.textContent = state.loadFailed ? "Chưa đọc được dữ liệu. Thử kết nối lại hoặc chọn dữ liệu mẫu để khám phá dashboard." : "Chưa có bản ghi trong khoảng này. Nạp dữ liệu bằng python main.py rồi bấm Làm mới.";
    tbody.append(Object.assign(document.createElement("tr"), {}));
    tbody.lastChild.append(cell);
  }
  for (const row of rows.slice(first, first + PAGE_SIZE)) {
    const tr = document.createElement("tr");
    const timestamp = document.createElement("td");
    timestamp.append(time(row.observed_at), Object.assign(document.createElement("small"), { textContent: date(row.observed_at) }));
    tr.append(timestamp);
    for (const [key, suffix] of [["temperature_c", "°C"], ["humidity_pct", "%"], ["precipitation_mm", " mm"], ["wind_speed_kmh", " km/h"]]) {
      const td = document.createElement("td");
      td.textContent = row[key] === null ? "—" : `${number(row[key])}${suffix}`;
      tr.append(td);
    }
    const categoryCell = document.createElement("td");
    const category = document.createElement("span");
    const validCategory = Object.hasOwn(categoryLabels, row.temp_category) ? row.temp_category : "";
    category.className = `category ${validCategory}`;
    category.textContent = categoryLabels[validCategory] || "Chưa phân loại";
    categoryCell.append(category);
    tr.append(categoryCell);
    tbody.append(tr);
  }
  $("#page-info").textContent = rows.length ? `Hiển thị ${first + 1}–${Math.min(first + PAGE_SIZE, rows.length)} trên ${rows.length} bản ghi` : "Chưa có bản ghi";
  $("#page-number").textContent = `${state.page} / ${pageCount}`;
  $("#previous-page").disabled = state.page === 1;
  $("#next-page").disabled = state.page === pageCount;
  $("#sort-direction").textContent = state.descending ? "↓" : "↑";
  $("#sort-button").setAttribute("aria-label", `Sắp xếp thời gian: ${state.descending ? "mới nhất" : "cũ nhất"} trước`);
  $("#sort-button").closest("th").setAttribute("aria-sort", state.descending ? "descending" : "ascending");
}

function exportCsv() {
  if (!state.payload?.records.length) return;
  const columns = ["city", "observed_at", "temperature_c", "humidity_pct", "precipitation_mm", "wind_speed_kmh", "temp_category", "loaded_at"];
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const content = [columns, ...sortedRecords().map((row) => columns.map((column) => row[column]))].map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `weather-${state.city.replaceAll(" ", "-").toLowerCase()}-${state.hours}h-${state.mode}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Đã xuất ${state.payload.records.length} bản ghi${state.mode === "demo" ? " mẫu" : ""}.`);
}

$("#today").textContent = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "long", year: "numeric" }).format(new Date());
$("#city-select").addEventListener("change", (event) => { state.city = event.target.value; loadData(); });
$("#mode-select").addEventListener("change", (event) => { state.mode = event.target.value; loadData(); });
$("#refresh-button").addEventListener("click", () => loadData(true));
$("#demo-button").addEventListener("click", () => { state.mode = "demo"; loadData(); });
$("#export-button").addEventListener("click", exportCsv);
for (const button of document.querySelectorAll("[data-hours]")) button.addEventListener("click", () => { state.hours = Number(button.dataset.hours); loadData(); });
for (const button of document.querySelectorAll("[data-metric]")) button.addEventListener("click", () => { state.metric = button.dataset.metric; updateControls(); renderChart(); });
$("#previous-page").addEventListener("click", () => { state.page--; renderTable(); });
$("#next-page").addEventListener("click", () => { state.page++; renderTable(); });
$("#sort-button").addEventListener("click", () => { state.descending = !state.descending; state.page = 1; renderTable(); });
$("#about-button").addEventListener("click", () => $("#about-dialog").showModal());
$("#close-dialog").addEventListener("click", () => $("#about-dialog").close());
$("#about-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close(); } });
for (const link of document.querySelectorAll(".nav a")) link.addEventListener("click", () => { for (const item of document.querySelectorAll(".nav a")) item.classList.toggle("active", item === link); });
$("#weather-chart").addEventListener("pointermove", (event) => {
  if (!state.chartPoints.length) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const localX = event.clientX - rect.left;
  let closest = 0;
  for (let index = 1; index < state.chartPoints.length; index++) if (Math.abs(state.chartPoints[index].x - localX) < Math.abs(state.chartPoints[closest].x - localX)) closest = index;
  showChartPoint(closest);
});
$("#weather-chart").addEventListener("pointerleave", hideTooltip);
$("#weather-chart").addEventListener("blur", hideTooltip);
$("#weather-chart").addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(event.key) || !state.chartPoints.length) return;
  event.preventDefault();
  if (event.key === "Escape") return hideTooltip();
  const next = event.key === "Home" ? 0 : event.key === "End" ? state.chartPoints.length - 1 : state.chartIndex + (event.key === "ArrowRight" ? 1 : -1);
  showChartPoint(Math.max(0, Math.min(state.chartPoints.length - 1, next)));
});
let resizeFrame;
new ResizeObserver(() => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(renderChart); }).observe($("#chart-container"));
renderCities();
loadData();
