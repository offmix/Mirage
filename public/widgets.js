"use strict";
// Clock and weather widgets: shown at the top right of the new tab page and at the bottom of the sidebar.
// Weather data: Open-Meteo (https://open-meteo.com, CC BY 4.0). Icons: Google Material Icons (Apache-2.0).
const MirageWidgets = (() => {
  const JP = "Asia/Tokyo";
  // [group, default time zone, [[id, name, latitude, longitude, time zone?], ...]]
  const GROUPS = [
    ["関東", JP, [
      ["tokyo", "東京", 35.6895, 139.6917], ["yokohama", "横浜", 35.4437, 139.6380], ["kawasaki", "川崎", 35.5309, 139.7030],
      ["machida", "町田", 35.5484, 139.4467], ["fujisawa", "藤沢", 35.3389, 139.4900], ["kamakura", "鎌倉", 35.3192, 139.5467],
      ["sagamihara", "相模原", 35.5714, 139.3733], ["ebina", "海老名", 35.4466, 139.3909], ["atsugi", "厚木", 35.4430, 139.3629],
      ["odawara", "小田原", 35.2563, 139.1553], ["saitama", "さいたま", 35.8617, 139.6455], ["kawagoe", "川越", 35.9251, 139.4859],
      ["tokorozawa", "所沢", 35.7993, 139.4689], ["kasukabe", "春日部", 35.9753, 139.7525], ["chiba", "千葉", 35.6073, 140.1063],
      ["funabashi", "船橋", 35.6948, 139.9829], ["kashiwa", "柏", 35.8676, 139.9757], ["utsunomiya", "宇都宮", 36.5551, 139.8828],
      ["nasushiobara", "那須塩原", 36.9643, 140.0476], ["tochigi", "栃木市", 36.3822, 139.7313], ["tsukuba", "つくば", 36.0835, 140.0764],
      ["mito", "水戸", 36.3659, 140.4712], ["hitachinaka", "ひたちなか", 36.3966, 140.5347], ["tsuchiura", "土浦", 36.0719, 140.2043],
      ["maebashi", "前橋", 36.3895, 139.0634], ["takasaki", "高崎", 36.3219, 139.0033],
    ]],
    ["東北", JP, [
      ["yamagata", "山形", 38.2404, 140.3634], ["sendai", "仙台", 38.2682, 140.8694], ["ishinomaki", "石巻", 38.4343, 141.3027],
      ["kesennuma", "気仙沼", 38.9086, 141.5700], ["iwaki", "いわき", 37.0503, 140.8877], ["fukushima", "福島", 37.7608, 140.4747],
      ["aomori", "青森", 40.8244, 140.7400], ["hachinohe", "八戸", 40.5122, 141.4883], ["akita", "秋田", 39.7186, 140.1024],
      ["morioka", "盛岡", 39.7036, 141.1527],
    ]],
    ["北海道", JP, [
      ["sapporo", "札幌", 43.0618, 141.3545], ["hakodate", "函館", 41.7687, 140.7288], ["niseko", "ニセコ", 42.8048, 140.6874],
      ["obihiro", "帯広", 42.9236, 143.1966], ["asahikawa", "旭川", 43.7706, 142.3650], ["tomakomai", "苫小牧", 42.6340, 141.6055],
      ["kushiro", "釧路", 42.9849, 144.3815], ["otaru", "小樽", 43.1907, 140.9947], ["kitami", "北見", 43.8030, 143.8909],
    ]],
    ["中部", JP, [
      ["niigata", "新潟", 37.9162, 139.0364], ["toyama", "富山", 36.6953, 137.2113], ["kanazawa", "金沢", 36.5613, 136.6562],
      ["nagano", "長野", 36.6486, 138.1948], ["matsumoto", "松本", 36.2381, 137.9720], ["shizuoka", "静岡", 34.9756, 138.3828],
      ["hamamatsu", "浜松", 34.7108, 137.7261], ["nagoya", "名古屋", 35.1815, 136.9066],
    ]],
    ["近畿", JP, [
      ["osaka", "大阪", 34.6937, 135.5023], ["sakai", "堺", 34.5733, 135.4830], ["kyoto", "京都", 35.0116, 135.7681],
      ["kobe", "神戸", 34.6901, 135.1956], ["nara", "奈良", 34.6851, 135.8049],
    ]],
    ["中国・四国", JP, [
      ["hiroshima", "広島", 34.3853, 132.4553], ["okayama", "岡山", 34.6551, 133.9195], ["matsuyama", "松山", 33.8416, 132.7657],
      ["takamatsu", "高松", 34.3401, 134.0434],
    ]],
    ["九州・沖縄", JP, [
      ["fukuoka", "福岡", 33.5904, 130.4017], ["kumamoto", "熊本", 32.8032, 130.7079], ["kagoshima", "鹿児島", 31.5966, 130.5571],
      ["naha", "那覇", 26.2124, 127.6809],
    ]],
    ["海外", null, [
      ["seoul", "ソウル", 37.5665, 126.9780, "Asia/Seoul"], ["taipei", "台北", 25.0330, 121.5654, "Asia/Taipei"],
      ["beijing", "北京", 39.9042, 116.4074, "Asia/Shanghai"], ["shanghai", "上海", 31.2304, 121.4737, "Asia/Shanghai"],
      ["hongkong", "香港", 22.3193, 114.1694, "Asia/Hong_Kong"], ["bangkok", "バンコク", 13.7563, 100.5018, "Asia/Bangkok"],
      ["singapore", "シンガポール", 1.3521, 103.8198, "Asia/Singapore"], ["dubai", "ドバイ", 25.2048, 55.2708, "Asia/Dubai"],
      ["sydney", "シドニー", -33.8688, 151.2093, "Australia/Sydney"], ["london", "ロンドン", 51.5074, -0.1278, "Europe/London"],
      ["paris", "パリ", 48.8566, 2.3522, "Europe/Paris"], ["berlin", "ベルリン", 52.5200, 13.4050, "Europe/Berlin"],
      ["newyork", "ニューヨーク", 40.7128, -74.0060, "America/New_York"], ["toronto", "トロント", 43.6532, -79.3832, "America/Toronto"],
      ["losangeles", "ロサンゼルス", 34.0522, -118.2437, "America/Los_Angeles"],
      ["sanfrancisco", "サンフランシスコ", 37.7749, -122.4194, "America/Los_Angeles"],
      ["honolulu", "ホノルル", 21.3069, -157.8583, "Pacific/Honolulu"],
    ]],
  ];
  const REGIONS = [];
  for (const [group, tz, items] of GROUPS) for (const [id, name, lat, lon, own] of items) REGIONS.push({ id, name, lat, lon, tz: own || tz, group });
  const regionById = (id) => REGIONS.find((r) => r.id === id) || REGIONS[0];

  // ---------- icons (Google Material Icons, 24x24) ----------
  const P = {
    sunny: "M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z",
    moon: "M9 2c-1.05 0-2.05.16-3 .46 4.06 1.27 7 5.06 7 9.54 0 4.48-2.94 8.27-7 9.54.95.3 1.95.46 3 .46 5.52 0 10-4.48 10-10S14.52 2 9 2z",
    cloud: "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z",
    snow: "M22 11h-4.17l3.24-3.24-1.41-1.42L15 11h-2V9l4.66-4.66-1.42-1.41L13 6.17V2h-2v4.17L7.76 2.93 6.34 4.34 11 9v2H9L4.34 6.34 2.93 7.76 6.17 11H2v2h4.17l-3.24 3.24 1.41 1.42L9 13h2v2l-4.66 4.66 1.42 1.41L11 17.83V22h2v-4.17l3.24 3.24 1.42-1.41L13 15v-2h2l4.66 4.66 1.41-1.42L17.83 13H22z",
    bolt: "M7 2v11h3v9l7-12h-4l4-8z",
    drop: "M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z",
    fog: "M2 15.5v2h20v-2H2zm0-5v2h20v-2H2zm0-5v2h20v-2H2z",
    clock: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z",
    pin: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
    air: "M14.5 17c0 1.65-1.35 3-3 3s-3-1.35-3-3h2c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1H2v-2h9.5c1.65 0 3 1.35 3 3zM19 6.5C19 4.57 17.43 3 15.5 3S12 4.57 12 6.5h2c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S16.33 8 15.5 8H2v2h13.5c1.93 0 3.5-1.57 3.5-3.5zm-.5 4.5H2v2h16.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5v2c1.93 0 3.5-1.57 3.5-3.5S20.43 11 18.5 11z",
    nav: "M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z",
    up: "M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z",
    down: "M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z",
  };
  const COLOR = { sunny: "#f5a623", moon: "#a5b4fc", cloud: "currentColor", drop: "#4aa3ff", snow: "#7dd3fc", bolt: "#fbbf24", fog: "currentColor", up: "#f5a623", down: "#a5b4fc" };
  const svg = (inner, cls) => `<svg class="iw-ico ${cls || ""}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const path = (name, extra) => `<path d="${P[name]}" fill="${COLOR[name] || "currentColor"}" ${extra || ""}/>`;
  // a small sun/moon behind a cloud; the cloud has a background-colored outline so the two read as separate shapes
  const partly = (back) =>
    `<g transform="translate(.2 .2) scale(.62)">${path(back)}</g>` +
    `<path d="${P.cloud}" fill="currentColor" transform="translate(4.6 5.6) scale(.8)" stroke="var(--iw-bg)" stroke-width="2.8" stroke-linejoin="round" paint-order="stroke"/>`;

  // WMO weather code -> [label, icon markup]
  function describe(code, isDay) {
    const day = isDay !== false;
    const c = Number(code);
    if (c === 0) return ["晴れ", day ? path("sunny") : path("moon")];
    if (c === 1) return ["おおむね晴れ", partly(day ? "sunny" : "moon")];
    if (c === 2) return ["一部曇り", partly(day ? "sunny" : "moon")];
    if (c === 3) return ["曇り", path("cloud")];
    if (c === 45 || c === 48) return ["霧", path("fog")];
    if (c >= 51 && c <= 55) return ["霧雨", path("drop")];
    if (c === 56 || c === 57) return ["着氷性の霧雨", path("drop")];
    if (c === 61 || c === 63) return ["雨", path("drop")];
    if (c === 65) return ["強い雨", path("drop")];
    if (c === 66 || c === 67) return ["みぞれ", path("drop")];
    if (c === 71 || c === 73) return ["雪", path("snow")];
    if (c === 75) return ["大雪", path("snow")];
    if (c === 77) return ["雪あられ", path("snow")];
    if (c >= 80 && c <= 82) return ["にわか雨", path("drop")];
    if (c === 85 || c === 86) return ["にわか雪", path("snow")];
    if (c === 95) return ["雷雨", path("bolt")];
    if (c === 96 || c === 99) return ["雷雨(ひょう)", path("bolt")];
    return ["不明", path("cloud")];
  }

  // ---------- formatting ----------
  const S = () => MirageData.state.settings;
  const cfg = () => ({ clock: true, weather: true, region: "tokyo", ...(S().widgets || {}) });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const none = (v) => v === null || v === undefined || Number.isNaN(v);
  const deg = (v) => (none(v) ? "--" : Math.round(v) + "°");
  const pct = (v) => (none(v) ? "--" : Math.round(v) + "%");
  const mm = (v) => (none(v) ? "--" : (Math.round(v * 10) / 10).toFixed(1) + "mm");
  const ms = (v) => (none(v) ? "--" : (Math.round(v * 10) / 10).toFixed(1) + "m/s");
  const WIND16 = ["北", "北北東", "北東", "東北東", "東", "東南東", "南東", "南南東", "南", "南南西", "南西", "西南西", "西", "西北西", "北西", "北北西"];
  const windDir = (d) => (none(d) ? "--" : WIND16[Math.round(d / 22.5) % 16]);
  const uvText = (v) => (none(v) ? "--" : (Math.round(v * 10) / 10) + "(" + (v < 3 ? "弱い" : v < 6 ? "中程度" : v < 8 ? "強い" : v < 11 ? "非常に強い" : "極端に強い") + ")");
  const hm = (iso) => (iso ? String(iso).slice(11, 16) : "--:--");
  const hourLabel = (iso) => Number(String(iso).slice(11, 13)) + "時";
  function dayLabel(iso, i) {
    if (i === 0) return "今日";
    if (i === 1) return "明日";
    const [y, m, d] = String(iso).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
  }
  const arrow = (dir) => (none(dir) ? "" : svg(`<path d="${P.nav}" fill="currentColor" transform="rotate(${Math.round(dir) + 180} 12 12)"/>`, "iw-arrow"));

  // ---------- settings ----------
  function settingsHtml() {
    const options = GROUPS.map(([group, , items]) =>
      `<optgroup label="${esc(group)}">${items.map(([id, name]) => `<option value="${id}">${esc(name)}</option>`).join("")}</optgroup>`
    ).join("");
    return `
        <section>
          <h3>時刻と天気</h3>
          <label class="check"><input id="wd-clock" type="checkbox"><span>現在時刻を表示する</span></label>
          <label class="check"><input id="wd-weather" type="checkbox"><span>天気を表示する</span></label>
          <label class="field"><span>天気の地域</span><select id="wd-region">${options}</select></label>
          <p class="note">新しいタブの右上と、サイドバーの下に表示します。「詳しく見る」で、時間ごとの予報と7日間の予報を見られます。天気のデータは <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a>(CC BY 4.0)から取得しています。</p>
        </section>
`;
  }
  function syncSettings(d) {
    const c = cfg();
    const a = d.querySelector("#wd-clock"), b = d.querySelector("#wd-weather"), r = d.querySelector("#wd-region");
    if (a) a.checked = !!c.clock;
    if (b) b.checked = !!c.weather;
    if (r && document.activeElement !== r) r.value = regionById(c.region).id;
  }
  function wireSettings(d) {
    d.addEventListener("change", (e) => {
      const key = { "wd-clock": "clock", "wd-weather": "weather", "wd-region": "region" }[e.target.id];
      if (!key) return;
      const value = key === "region" ? e.target.value : e.target.checked;
      MirageData.setSettings({ widgets: { ...cfg(), [key]: value } });
    });
  }

  // ---------- weather data (Open-Meteo) ----------
  const WEATHER_TTL = 15 * 60 * 1000;
  const CACHE_KEY = "mirage:weather2";
  let weather = null;        // parsed forecast, or { regionId, error: true }
  let loading = null;

  function forecastUrl(r) {
    return "https://api.open-meteo.com/v1/forecast?latitude=" + r.lat + "&longitude=" + r.lon +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day" +
      "&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,uv_index,is_day" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset" +
      "&forecast_days=7&wind_speed_unit=ms&timezone=auto";
  }

  // Open-Meteo JSON -> the model used for rendering
  function parse(j, regionId) {
    const c = j.current, h = j.hourly, d = j.daily;
    const nowKey = String(c.time).slice(0, 13);
    let i0 = h.time.findIndex((t) => t.slice(0, 13) >= nowKey);
    if (i0 < 0) i0 = 0;
    const hourAt = (i) => ({
      time: h.time[i], temp: h.temperature_2m[i], hum: h.relative_humidity_2m[i], pop: h.precipitation_probability[i],
      rain: h.precipitation[i], code: h.weather_code[i], uv: h.uv_index[i], day: h.is_day[i] !== 0,
    });
    const hours = [];
    for (let i = i0; i < Math.min(i0 + 24, h.time.length); i++) hours.push(hourAt(i));
    const days = d.time.map((date, k) => {
      let sum = 0, n = 0;
      h.time.forEach((t, i) => { if (t.startsWith(date) && h.relative_humidity_2m[i] != null) { sum += h.relative_humidity_2m[i]; n++; } });
      return {
        date, code: d.weather_code[k], max: d.temperature_2m_max[k], min: d.temperature_2m_min[k],
        pop: d.precipitation_probability_max[k], rain: d.precipitation_sum[k], wind: d.wind_speed_10m_max[k],
        windDir: d.wind_direction_10m_dominant[k], uv: d.uv_index_max[k], sunrise: d.sunrise[k], sunset: d.sunset[k],
        hum: n ? sum / n : null,
      };
    });
    const now = hourAt(i0);
    return {
      regionId, t: Date.now(), tz: j.timezone,
      cur: { temp: c.temperature_2m, feels: c.apparent_temperature, hum: c.relative_humidity_2m, rain: c.precipitation, code: c.weather_code, day: c.is_day !== 0, wind: c.wind_speed_10m, windDir: c.wind_direction_10m },
      pop: now.pop, uv: now.uv, hours, days,
    };
  }

  function cached(regionId) {
    try { const v = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); return v && v.regionId === regionId && v.cur && v.days ? v : null; } catch { return null; }
  }
  async function loadWeather(force) {
    const c = cfg();
    if (!c.weather) return;
    const r = regionById(c.region);
    if (!force && weather && weather.regionId === r.id && !weather.error && Date.now() - weather.t < WEATHER_TTL) return;
    const token = (loading = {});
    try {
      const res = await fetch(forecastUrl(r));
      if (!res.ok) throw new Error("HTTP " + res.status);
      const next = parse(await res.json(), r.id);
      if (token !== loading || cfg().region !== r.id) return;   // region changed while loading
      weather = next;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
    } catch (e) {
      if (token !== loading) return;
      console.warn("[mirage] weather", e);
      if (!weather || weather.regionId !== r.id) weather = { regionId: r.id, error: true };
    }
    render();
  }

  // ---------- rendering: widget ----------
  function offsetMinutes(tz, d) {
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })
        .formatToParts(d).map((x) => [x.type, x.value]));
      return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000) / 60000);
    } catch { return -d.getTimezoneOffset(); }
  }
  const hhmm = (d, tz) => d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false, ...(tz ? { timeZone: tz } : {}) });
  const dayText = (d) => d.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
  const ready = (r) => weather && weather.regionId === r.id && !weather.error && weather.cur;

  // kind: "ntp" (new tab page, with the extra row) or "sb" (sidebar footer, compact)
  function html(kind) {
    const c = cfg(), r = regionById(c.region), out = [];
    if (c.clock) {
      // the colon blinks (CSS animation on .iw-colon)
      out.push(`<div class="iw-line">${svg(path("clock"), "iw-clock")}<span class="iw-time"><span data-iw="hh">--</span><span class="iw-colon">:</span><span data-iw="mm">--</span></span><span class="iw-date" data-iw="date"></span></div>`);
      out.push(`<div class="iw-line iw-local-line" data-iw="localline" hidden><span class="iw-local" data-iw="local"></span></div>`);
    }
    if (c.weather) {
      if (ready(r)) {
        const w = weather, today = w.days[0] || {};
        const [label, icon] = describe(w.cur.code, w.cur.day);
        out.push(`<div class="iw-line">${svg(icon, "iw-wx")}<span class="iw-temp">${deg(w.cur.temp)}</span><span class="iw-desc">${esc(label)}</span></div>`);
        out.push(`<div class="iw-sub">${svg(path("pin"))}<span>${esc(r.name)}</span><span>最高 ${deg(today.max)} / 最低 ${deg(today.min)}</span></div>`);
        if (kind === "ntp") {
          out.push(`<div class="iw-meta"><span>風 ${esc(windDir(w.cur.windDir))} ${ms(w.cur.wind)}</span><span>降水確率 ${pct(w.pop)}</span><span>紫外線 ${none(w.uv) ? "--" : Math.round(w.uv * 10) / 10}</span><span>湿度 ${pct(w.cur.hum)}</span><span>日の出 ${hm(today.sunrise)}</span><span>日の入り ${hm(today.sunset)}</span></div>`);
        }
        out.push(`<button class="iw-more" type="button" data-iw-act="${kind === "ntp" ? "more-ntp" : "more-sb"}">詳しく見る</button>`);
      } else if (weather && weather.regionId === r.id && weather.error) {
        out.push(`<div class="iw-sub">${svg(path("cloud"))}<span>天気を取得できません(${esc(r.name)})</span></div>`);
      } else {
        out.push(`<div class="iw-sub">${svg(path("cloud"))}<span>天気を読み込み中…(${esc(r.name)})</span></div>`);
      }
    }
    return out.join("");
  }

  // ---------- rendering: details (current / hourly / 7 days) ----------
  const stat = (label, value, icon) => `<div class="iw-stat"><span class="iw-stat-l">${icon || ""}${esc(label)}</span><b>${value}</b></div>`;

  function detailsHtml() {
    const c = cfg(), r = regionById(c.region);
    if (!c.weather) return `<p class="note">天気の表示がオフです。設定の「時刻と天気」でオンにできます。</p>`;
    if (weather && weather.regionId === r.id && weather.error) return `<p class="note">天気を取得できませんでした(${esc(r.name)})。しばらくしてからもう一度お試しください。</p>`;
    if (!ready(r)) return `<p class="note">天気を読み込み中です…(${esc(r.name)})</p>`;
    const w = weather, today = w.days[0] || {}, cur = w.cur;
    const [label, icon] = describe(cur.code, cur.day);
    const hours = w.hours.map((h) => {
      const [, hi] = describe(h.code, h.day);
      return `<div class="iw-hour"><span class="iw-hour-t">${hourLabel(h.time)}</span>${svg(hi, "iw-wx")}<b>${deg(h.temp)}</b><span class="iw-hour-p">${pct(h.pop)}</span><span class="iw-hour-r">${mm(h.rain)}</span></div>`;
    }).join("");
    const days = w.days.map((d, i) => {
      const [dl, di] = describe(d.code, true);
      return `<div class="iw-day">
        <div class="iw-day-top"><span class="iw-day-name">${esc(dayLabel(d.date, i))}</span>${svg(di, "iw-wx")}<span class="iw-day-desc">${esc(dl)}</span><span class="iw-day-t"><b>${deg(d.max)}</b> / ${deg(d.min)}</span></div>
        <div class="iw-chips">
          <span>降水確率 ${pct(d.pop)}</span><span>降水量 ${mm(d.rain)}</span>
          <span>風 ${esc(windDir(d.windDir))} ${ms(d.wind)}</span><span>湿度 ${pct(d.hum)}</span>
          <span>紫外線 ${uvText(d.uv)}</span><span>日の出 ${hm(d.sunrise)}</span><span>日の入り ${hm(d.sunset)}</span>
        </div></div>`;
    }).join("");
    return `
      <div class="iw-d-head">${svg(icon, "iw-wx iw-big")}<div><div class="iw-d-temp">${deg(cur.temp)}</div><div class="iw-d-desc">${esc(label)}・体感 ${deg(cur.feels)}</div><div class="iw-sub">${svg(path("pin"))}<span>${esc(r.name)}</span></div></div></div>
      <div class="iw-stats">
        ${stat("最高 / 最低", `${deg(today.max)} / ${deg(today.min)}`)}
        ${stat("湿度", pct(cur.hum), svg(path("drop")))}
        ${stat("風", `${esc(windDir(cur.windDir))} ${ms(cur.wind)} ${arrow(cur.windDir)}`, svg(path("air")))}
        ${stat("降水確率", pct(w.pop))}
        ${stat("降水量(いま)", mm(cur.rain))}
        ${stat("紫外線指数", uvText(w.uv), svg(path("sunny")))}
        ${stat("日の出", hm(today.sunrise), svg(path("up")))}
        ${stat("日の入り", hm(today.sunset), svg(path("down")))}
      </div>
      <h4 class="iw-h">時間ごと(24時間)</h4>
      <div class="iw-hours">${hours}</div>
      <p class="iw-legend">上から 時刻・天気・気温・降水確率・降水量</p>
      <h4 class="iw-h">7日間の予報</h4>
      <div class="iw-days">${days}</div>
      <p class="note">天気データ: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a></p>`;
  }

  function render() {
    const c = cfg();
    const ntp = document.getElementById("ntp-widget"), sbf = document.getElementById("sb-foot");
    if (ntp) { ntp.hidden = !c.clock && !c.weather; ntp.innerHTML = html("ntp"); }
    if (sbf) { sbf.hidden = !c.clock && !c.weather; sbf.innerHTML = html("sb"); }
    for (const id of ["ntp-details", "sb-weather"]) {
      const el = document.getElementById(id);
      if (el && (id === "sb-weather" || !el.hidden)) el.innerHTML = (id === "ntp-details" ? `<div class="iw-d-bar"><button type="button" class="iw-link" data-iw-act="to-sidebar">サイドバーで開く</button><button type="button" class="iw-link" data-iw-act="close-details">閉じる</button></div>` : "") + detailsHtml();
    }
    tick(true);
  }

  let lastShown = "";
  function tick(force) {
    const c = cfg();
    if (!c.clock) return;
    const now = new Date(), r = regionById(c.region);
    const t = hhmm(now), shown = t + "|" + r.id;
    if (!force && shown === lastShown) return;
    lastShown = shown;
    const [hh, mi] = t.split(":");
    const remote = offsetMinutes(r.tz, now) !== -now.getTimezoneOffset();
    for (const el of document.querySelectorAll(".info-widget")) {
      const set = (k, v) => { const n = el.querySelector(`[data-iw="${k}"]`); if (n) n.textContent = v; };
      set("hh", hh);
      set("mm", mi);
      set("date", dayText(now));
      const line = el.querySelector('[data-iw="localline"]');
      if (line) { line.hidden = !remote; if (remote) set("local", `${r.name}の現地時刻 ${hhmm(now, r.tz)}`); }
    }
  }

  // ---------- details popover on the new tab page ----------
  function openNtpDetails() { const el = document.getElementById("ntp-details"); if (el) { el.hidden = false; render(); } }
  function closeNtpDetails() { const el = document.getElementById("ntp-details"); if (el) el.hidden = true; }

  function init() {
    const c = cfg();
    weather = cached(regionById(c.region).id) || null;
    render();
    setInterval(() => tick(false), 1000);
    setInterval(() => loadWeather(false), 60 * 1000);   // re-checks the 15 minute cache
    loadWeather(true);

    document.addEventListener("click", (e) => {
      const act = e.target.closest && e.target.closest("[data-iw-act]");
      if (act) {
        const a = act.dataset.iwAct, box = document.getElementById("ntp-details");
        if (a === "more-ntp") { if (box && !box.hidden) closeNtpDetails(); else openNtpDetails(); }
        else if (a === "more-sb") MirageUI.openSidebar("weather");
        else if (a === "to-sidebar") { closeNtpDetails(); MirageUI.openSidebar("weather"); }
        else if (a === "close-details") closeNtpDetails();
        return;
      }
      const box = document.getElementById("ntp-details");
      if (box && !box.hidden && !e.target.closest("#ntp-details")) closeNtpDetails();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeNtpDetails(); });

    let last = JSON.stringify(c);
    MirageData.on("settings", () => {
      const now = cfg();
      const key = JSON.stringify(now);
      if (key === last) return;
      const prev = JSON.parse(last);
      const refetch = now.region !== prev.region || (now.weather && !prev.weather);
      last = key;
      if (refetch) weather = cached(regionById(now.region).id) || null;
      render();
      if (refetch) loadWeather(true);
    });
  }

  return { init, render, settingsHtml, syncSettings, wireSettings, describe, parse, forecastUrl, detailsHtml, REGIONS, GROUPS };
})();
