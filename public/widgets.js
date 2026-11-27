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
  };
  const COLOR = { sunny: "#f5a623", moon: "#a5b4fc", cloud: "currentColor", drop: "#4aa3ff", snow: "#7dd3fc", bolt: "#fbbf24", fog: "currentColor" };
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

  // ---------- settings ----------
  const S = () => MirageData.state.settings;
  const cfg = () => ({ clock: true, weather: true, region: "tokyo", ...(S().widgets || {}) });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
          <p class="note">新しいタブの右上と、サイドバーの下に表示します。天気のデータは <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a>(CC BY 4.0)から取得しています。</p>
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

  // ---------- weather ----------
  const WEATHER_TTL = 15 * 60 * 1000;
  let weather = null;        // { regionId, temp, code, day, max, min, t } or { regionId, error: true }
  let loading = null;

  function cached(regionId) {
    try { const v = JSON.parse(localStorage.getItem("mirage:weather") || "null"); return v && v.regionId === regionId ? v : null; } catch { return null; }
  }
  async function loadWeather(force) {
    const c = cfg();
    if (!c.weather) return;
    const r = regionById(c.region);
    if (!force && weather && weather.regionId === r.id && !weather.error && Date.now() - weather.t < WEATHER_TTL) return;
    const token = (loading = {});
    try {
      const url = "https://api.open-meteo.com/v1/forecast?latitude=" + r.lat + "&longitude=" + r.lon +
        "&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto";
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json();
      const next = {
        regionId: r.id, t: Date.now(),
        temp: j.current.temperature_2m, code: j.current.weather_code, day: j.current.is_day !== 0,
        max: j.daily && j.daily.temperature_2m_max ? j.daily.temperature_2m_max[0] : null,
        min: j.daily && j.daily.temperature_2m_min ? j.daily.temperature_2m_min[0] : null,
      };
      if (token !== loading || cfg().region !== r.id) return;   // region changed while loading
      weather = next;
      try { localStorage.setItem("mirage:weather", JSON.stringify(next)); } catch {}
    } catch (e) {
      if (token !== loading) return;
      console.warn("[mirage] weather", e);
      if (!weather || weather.regionId !== r.id) weather = { regionId: r.id, error: true };
    }
    render();
  }

  // ---------- rendering ----------
  const deg = (v) => (v === null || v === undefined ? "--" : Math.round(v) + "°");
  function offsetMinutes(tz, d) {
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })
        .formatToParts(d).map((x) => [x.type, x.value]));
      return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000) / 60000);
    } catch { return -d.getTimezoneOffset(); }
  }
  const hhmm = (d, tz) => d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false, ...(tz ? { timeZone: tz } : {}) });
  const dayText = (d) => d.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });

  function html() {
    const c = cfg(), r = regionById(c.region), out = [];
    if (c.clock) {
      out.push(`<div class="iw-line">${svg(path("clock"), "iw-clock")}<span class="iw-time" data-iw="time"></span><span class="iw-date" data-iw="date"></span></div>`);
      out.push(`<div class="iw-line iw-local-line" data-iw="localline" hidden><span class="iw-local" data-iw="local"></span></div>`);
    }
    if (c.weather) {
      if (weather && weather.regionId === r.id && !weather.error) {
        const [label, icon] = describe(weather.code, weather.day);
        out.push(`<div class="iw-line">${svg(icon, "iw-wx")}<span class="iw-temp">${deg(weather.temp)}</span><span class="iw-desc">${esc(label)}</span></div>`);
        out.push(`<div class="iw-sub">${svg(path("pin"))}<span>${esc(r.name)}</span><span>最高 ${deg(weather.max)} / 最低 ${deg(weather.min)}</span></div>`);
      } else if (weather && weather.regionId === r.id && weather.error) {
        out.push(`<div class="iw-sub">${svg(path("cloud"))}<span>天気を取得できません(${esc(r.name)})</span></div>`);
      } else {
        out.push(`<div class="iw-sub">${svg(path("cloud"))}<span>天気を読み込み中…(${esc(r.name)})</span></div>`);
      }
    }
    return out.join("");
  }

  function render() {
    const c = cfg(), markup = html();
    for (const el of [document.getElementById("ntp-widget"), document.getElementById("sb-foot")]) {
      if (!el) continue;
      el.hidden = !c.clock && !c.weather;
      el.innerHTML = markup;
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
    const remote = offsetMinutes(r.tz, now) !== -now.getTimezoneOffset();
    for (const el of document.querySelectorAll(".info-widget")) {
      const set = (k, v) => { const n = el.querySelector(`[data-iw="${k}"]`); if (n) n.textContent = v; };
      set("time", t);
      set("date", dayText(now));
      const line = el.querySelector('[data-iw="localline"]');
      if (line) { line.hidden = !remote; if (remote) set("local", `${r.name}の現地時刻 ${hhmm(now, r.tz)}`); }
    }
  }

  function init() {
    const c = cfg();
    weather = cached(regionById(c.region).id) || null;
    render();
    setInterval(() => tick(false), 1000);
    setInterval(() => loadWeather(false), 60 * 1000);   // re-checks the 15 minute cache
    loadWeather(true);
    let last = JSON.stringify(c);
    MirageData.on("settings", () => {
      const now = cfg();
      const key = JSON.stringify(now);
      if (key === last) return;
      const regionChanged = now.region !== JSON.parse(last).region || (now.weather && !JSON.parse(last).weather);
      last = key;
      render();
      if (regionChanged) { weather = cached(regionById(now.region).id) || null; render(); loadWeather(true); }
    });
  }

  return { init, settingsHtml, syncSettings, wireSettings, describe, REGIONS, GROUPS };
})();
