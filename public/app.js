"use strict";
const $ = (s) => document.querySelector(s);

// Fallbacks so browsing still works if data.js / ui.js failed to load (for example, not pushed to the repo).
const missingModules = [];
if (typeof MirageData === "undefined") {
  missingModules.push("data.js");
  globalThis.MirageData = {
    enabled: false, state: { user: null, profile: null, settings: {}, bookmarks: [], history: [] },
    on() {}, init: () => Promise.resolve(), isBookmarked: () => false, findBookmark: () => null,
    addBookmark: async () => {}, removeBookmark: async () => {}, addHistory: async () => {},
  };
}
if (typeof MirageLock === "undefined") {
  missingModules.push("lock.js");
  globalThis.MirageLock = { init() {}, settingsHtml: () => "", syncSettings() {}, wireSettings() {}, isLocked: () => false, getConfig: () => null };
}
if (typeof MirageAdblock === "undefined") {
  missingModules.push("adblock.js");
  globalThis.MirageAdblock = { init() {}, attach() {}, settingsHtml: () => "", syncSettings() {}, wireSettings() {}, isEnabled: () => false };
}
if (typeof MirageUI === "undefined") {
  missingModules.push("ui.js");
  globalThis.MirageUI = { init() {}, toggleFilter() {} };
}
const SEARCH = "https://search.yahoo.co.jp/search?p=%s";
const SHORTCUTS = [
  { name: "DuckDuckGo", url: "https://duckduckgo.com/" },
  { name: "Wikipedia", url: "https://www.wikipedia.org/" },
  { name: "GitHub", url: "https://github.com/" },
  { name: "Reddit", url: "https://www.reddit.com/" },
];

let scramjet, tabs = [], activeId = null, nextId = 1;
let addrDirty = false;   // true while the user is editing the address bar

// ---------- proxied URL -> real URL ----------
// A proxied page lives at "<origin>/service/<encoded real URL>". The address bar must always show the real URL.
const PROXY_PREFIX = "/service/";
function isProxyUrl(s) {
  s = String(s);
  return s.startsWith(PROXY_PREFIX) || s.startsWith(location.origin + PROXY_PREFIX);
}
function lenientDecode(s) {
  // decode every valid %XX run, leave broken ones (for example a lone "%") untouched
  return s.replace(/(%[0-9a-fA-F]{2})+/g, (m) => { try { return decodeURIComponent(m); } catch { return m; } });
}
function toRealUrl(u) {
  const s = String(u);
  if (!isProxyUrl(s)) return s;
  const rest = s.slice(s.indexOf(PROXY_PREFIX) + PROXY_PREFIX.length);
  if (/^https?:\/\//i.test(rest)) return rest;             // not encoded at all
  let real;
  try { real = decodeURIComponent(rest); } catch { real = lenientDecode(rest); }
  return real.replace(/^(https?:)\/(?!\/)/i, "$1//");       // "https:/host" -> "https://host"
}
// The real URL a tab is showing now, or "" if it cannot be told (blank frame, still loading).
function currentRealUrl(tab) {
  const candidates = [];
  try { if (tab.frame && tab.frame.url) candidates.push(String(tab.frame.url)); } catch {}
  try { candidates.push(tab.iframe.contentWindow.location.href); } catch {}
  for (const c of candidates) {
    const r = toRealUrl(c);
    if (/^https?:/i.test(r) && !isProxyUrl(r)) return r;
  }
  return "";
}

// Keyboard shortcuts. Used on the Mirage page and also inside every proxied page,
// because key events in an iframe do not reach the parent document.
function onShortcut(e) {
  if (document.body.classList.contains("tab-locked")) return;
  if (e.key === "Escape" && document.body.classList.contains("site-fullscreen") && !document.fullscreenElement) {
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.remove("site-fullscreen");
    updateFullscreenButtons();
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === "t") { e.preventDefault(); newTab(); }
  else if (mod && e.key === "w") { e.preventDefault(); closeTab(activeId); }
  else if (mod && e.key === "l") { e.preventDefault(); $("#address").focus(); }
  else if (e.altKey && e.code === "KeyZ") { e.preventDefault(); e.stopPropagation(); MirageUI.toggleFilter(); }
}

// ---------- links that open a new tab or window ----------
// Inside a proxied page, target="_blank" links, Ctrl/Middle-click and window.open() would open a real
// browser tab. Open a new Mirage tab (proxied) instead.
function resolveReal(raw, base) {
  try { return new URL(toRealUrl(raw), base || undefined).toString(); } catch { return ""; }
}

// Returns the real URL to open in a new Mirage tab for this click, or "" to leave the click alone.
function newTabIntent(el, e, base) {
  const a = el && el.closest ? el.closest("a[href], area[href]") : null;
  if (!a) return "";
  const target = String(a.target || "").toLowerCase();
  const wantsNew = (target && !["_self", "_parent", "_top"].includes(target)) ||
    e.ctrlKey || e.metaKey || (e.type === "auxclick" && e.button === 1);
  if (!wantsNew) return "";
  const url = resolveReal(a.href || a.getAttribute("href") || "", base);
  return /^https?:/i.test(url) ? url : "";
}

const linkDocs = new WeakSet();
function attachLinks(tab, doc) {
  if (linkDocs.has(doc)) return;
  linkDocs.add(doc);
  const onClick = (e) => {
    if (e.type === "click" && e.button !== 0) return;
    const url = newTabIntent(e.target, e, tab.url);
    if (!url) return;
    e.preventDefault();
    e.stopPropagation();
    newTab(url);
  };
  nativeAddListener.call(doc, "click", onClick, true);
  nativeAddListener.call(doc, "auxclick", onClick, true);
  try {
    const win = doc.defaultView;
    const original = win.open;
    win.open = function (url) {
      const real = url ? resolveReal(String(url), tab.url) : "";
      if (/^https?:/i.test(real)) { newTab(real); return null; }
      return original.apply(win, arguments); // about:blank etc. stay with the page's own handling
    };
  } catch {}
}

const keyDocs = new WeakSet();
const nativeAddListener = EventTarget.prototype.addEventListener; // parent realm's own function (not Scramjet's patched one)
function attachKeys(tab) {
  try {
    const doc = tab.iframe.contentDocument;
    if (!doc) return;
    MirageAdblock.attach(doc); // adds/removes the ad-hiding stylesheet (idempotent)
    attachLinks(tab, doc);
    if (keyDocs.has(doc)) return;
    nativeAddListener.call(doc, "keydown", onShortcut, true);
    keyDocs.add(doc);
  } catch {}
}

function updateStar() {
  const t = current();
  const on = !!(t && t.url && MirageData.isBookmarked(t.url));
  const b = $("#star");
  b.classList.toggle("on", on);
  b.querySelector("use").setAttribute("href", on ? "#i-star-fill" : "#i-star");
  b.title = on ? "ブックマークを削除" : "このページをブックマーク";
}

function recordHistory(tab) {
  if (!tab.url || !/^https?:/i.test(tab.url) || tab.lastLogged === tab.url) return;
  tab.lastLogged = tab.url;
  MirageData.addHistory({ title: tab.title || tab.url, url: tab.url });
}

function setStatus(msg, isError) {
  const el = $("#status");
  if (!msg) {
    if (missingModules.length) {
      el.textContent = "Missing files: public/" + missingModules.join(", public/") + " (add them to the repo and redeploy)";
      el.style.color = "#d93025"; el.hidden = false;
      return;
    }
    el.hidden = true; return;
  }
  el.textContent = msg;
  el.style.color = isError ? "#d93025" : "";
  el.hidden = false;
}
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label + " timed out (" + ms / 1000 + "s)")), ms)),
  ]);
}
function testWisp(url) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
    try {
      const ws = new WebSocket(url);
      ws.onopen = () => { ws.close(); finish(true); };
      ws.onerror = () => finish(false);
      setTimeout(() => finish(false), 8000);
    } catch { finish(false); }
  });
}

function showError(msg) {
  console.error(msg);
  const el = $("#status");
  el.textContent = "Error: " + msg;
  el.hidden = false;
}
window.addEventListener("error", (e) => showError(e.message));
window.addEventListener("unhandledrejection", (e) => showError(String(e.reason && e.reason.message || e.reason)));

function normalize(input) {
  input = input.trim();
  if (!input) return null;
  try { return new URL(input).toString(); } catch {}
  if (/^[^\s]+\.[^\s]{2,}$/.test(input) && !input.includes(" ")) {
    try { return new URL("https://" + input).toString(); } catch {}
  }
  return SEARCH.replace("%s", encodeURIComponent(input));
}

function svgIcon(id) {
  return `<svg><use href="#${id}"/></svg>`;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

async function init() {
  if (!("serviceWorker" in navigator)) throw new Error("Service workers are not supported.");

  // Detect which Scramjet build files the server has.
  const present = await (await fetch("/scram-files.json")).json();
  const has = (n) => present.includes(n);
  const bundle = ["scramjet.all.js", "scramjet.worker.js"].find(has);
  if (!bundle) throw new Error("Scramjet bundle not found. Files: " + present.join(", "));
  await loadScript("/scram/" + bundle);
  if (typeof $scramjetLoadController !== "function") {
    throw new Error("Unsupported Scramjet build ($scramjetLoadController missing). Files: " + present.join(", "));
  }

  const files = {};
  for (const [key, name] of [["wasm", "scramjet.wasm.wasm"], ["all", "scramjet.all.js"], ["sync", "scramjet.sync.js"],
                             ["worker", "scramjet.worker.js"], ["client", "scramjet.client.js"], ["shared", "scramjet.shared.js"]]) {
    if (has(name)) files[key] = "/scram/" + name;
  }
  if (!files.wasm && has("scramjet.wasm.js")) files.wasm = "/scram/scramjet.wasm.js";

  const { ScramjetController } = $scramjetLoadController();
  scramjet = new ScramjetController({ prefix: "/service/", files });

  setStatus("Starting: initializing Scramjet...");
  await withTimeout(scramjet.init(), 10000, "scramjet.init");
  setStatus("Starting: registering service worker...");
  await withTimeout(navigator.serviceWorker.register("/sw.js", { scope: "/" }), 10000, "service worker register");
  await withTimeout(navigator.serviceWorker.ready, 10000, "service worker activation");

  const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
  const wisp = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
  setStatus("Starting: connecting transport...");
  await withTimeout(connection.setTransport("/libcurl/index.mjs", [{ wisp }]), 15000, "transport setup");
  setStatus("Starting: checking Wisp connection...");
  if (!(await testWisp(wisp))) {
    setStatus("Warning: cannot open Wisp WebSocket (" + wisp + "). Sites will not load.", true);
  } else {
    setStatus("");
  }

  renderShortcuts();
  bindUI();
  newTab();
}

function renderShortcuts() {
  const box = $("#shortcuts");
  for (const s of SHORTCUTS) {
    const a = document.createElement("button");
    a.className = "sc";
    a.innerHTML = `<span class="ic">${svgIcon("i-globe")}</span><span>${s.name}</span>`;
    a.onclick = () => navigate(s.url);
    box.appendChild(a);
  }
}

function newTab(url) {
  const id = nextId++;
  const iframe = document.createElement("iframe");
  $("#frames").appendChild(iframe);
  const frame = scramjet.createFrame(iframe);
  const tab = { id, iframe, frame, title: "New Tab", url: "", el: null, favSrc: "" };

  const el = document.createElement("div");
  el.className = "tab";
  el.innerHTML = `<span class="fav">${svgIcon("i-globe")}</span><span class="title">New Tab</span><button class="x" aria-label="Close tab">${svgIcon("i-close")}</button>`;
  el.onclick = () => activate(id);
  el.querySelector(".x").onclick = (e) => { e.stopPropagation(); closeTab(id); };
  $("#tabs").appendChild(el);
  tab.el = el;
  tabs.push(tab);

  iframe.addEventListener("load", () => {
    clearTimeout(tab.loadTimer);
    if (tab.id === activeId) setStatus("");
    attachKeys(tab);
    syncTab(tab);
    setTimeout(() => { attachKeys(tab); syncTab(tab); recordHistory(tab); }, 800);
  });
  activate(id);
  if (url) navigate(url);
  else $("#address").focus();
}

function current() { return tabs.find((t) => t.id === activeId); }

function activate(id) {
  activeId = id;
  for (const t of tabs) {
    t.el.classList.toggle("active", t.id === id);
    t.iframe.classList.toggle("active", t.id === id);
  }
  const t = current();
  $("#newtab-page").classList.toggle("hidden", !!t.url);
  if (!addrDirty) $("#address").value = t.url;
  updateStar();
  updateFullscreenButtons();
}

function closeTab(id) {
  const i = tabs.findIndex((t) => t.id === id);
  if (i < 0) return;
  const [t] = tabs.splice(i, 1);
  t.el.remove(); t.iframe.remove();
  if (!tabs.length) return newTab();
  if (activeId === id) activate(tabs[Math.max(0, i - 1)].id);
}

function navigate(input) {
  const url = normalize(input);
  const t = current();
  if (!url || !t) return;
  t.url = url;
  setTitle(t, new URL(url).hostname);
  setFavicon(t, "");
  $("#newtab-page").classList.add("hidden");
  $("#address").value = url;
  updateStar();
  updateFullscreenButtons();
  setStatus("Loading " + new URL(url).hostname + "...");
  clearTimeout(t.loadTimer);
  t.loadTimer = setTimeout(() => setStatus("Still loading. The transport or Wisp connection may be stuck (open the browser console for details).", true), 20000);
  try { t.frame.go(url); } catch (e) { showError(e.message); }
}

function proxiedUrl(u) {
  try { if (scramjet && typeof scramjet.encodeUrl === "function") return scramjet.encodeUrl(u); } catch {}
  return "/service/" + encodeURIComponent(u);
}

// Find the page's favicon (through the proxy) or fall back to /favicon.ico.
function findFavicon(tab) {
  try {
    const doc = tab.iframe.contentDocument;
    const link = doc && doc.querySelector('link[rel~="icon" i], link[rel="shortcut icon" i], link[rel="apple-touch-icon"]');
    const raw = link && link.getAttribute("href");
    if (raw) {
      if (raw.startsWith("data:") || raw.includes("/service/")) return raw;
      return proxiedUrl(new URL(raw, tab.url).toString());
    }
  } catch {}
  try { return proxiedUrl(new URL("/favicon.ico", tab.url).toString()); } catch { return ""; }
}

function setFavicon(tab, src) {
  if (tab.favSrc === src) return;
  tab.favSrc = src;
  const holder = tab.el.querySelector(".fav");
  if (!src) { holder.innerHTML = svgIcon("i-globe"); return; }
  const img = new Image();
  img.alt = "";
  img.onerror = () => { if (tab.favSrc === src) holder.innerHTML = svgIcon("i-globe"); };
  img.src = src;
  holder.replaceChildren(img);
}

function setTitle(t, title) {
  t.title = title;
  t.el.querySelector(".title").textContent = title;
}

function syncTab(tab) {
  attachKeys(tab);
  if (!tab.url) return;
  try {
    const doc = tab.iframe.contentDocument;
    if (doc && doc.title && doc.title !== tab.title) setTitle(tab, doc.title);
    const real = currentRealUrl(tab);
    if (real && real !== tab.url) {
      tab.url = real;
      if (tab.id === activeId) updateStar();
    }
    // Never overwrite the address bar while the user is typing in it.
    const addr = $("#address");
    if (tab.id === activeId && !addrDirty && document.activeElement !== addr) addr.value = tab.url;
  } catch {}
  setFavicon(tab, findFavicon(tab));
}

// Titles and icons can change after load; keep tabs in sync.
setInterval(() => tabs.forEach(syncTab), 1500);

function updateFullscreenButtons() {
  const active = document.body.classList.contains("site-fullscreen");
  const label = active ? "全画面を終了" : "サイトを全画面表示";
  for (const button of [$("#btn-fullscreen"), $("#fullscreen-exit")]) {
    if (!button) continue;
    button.title = label;
    button.setAttribute("aria-label", label);
    const icon = button.querySelector("use");
    if (icon) icon.setAttribute("href", active ? "#i-exit-fullscreen" : "#i-fullscreen");
  }
  const toggle = $("#btn-fullscreen");
  if (toggle) {
    toggle.disabled = !active && !(current() && current().url);
    toggle.setAttribute("aria-pressed", String(active));
  }
}

function onFullscreenChange() {
  if (!document.fullscreenElement && document.body.classList.contains("site-fullscreen")) {
    document.body.classList.remove("site-fullscreen");
  }
  updateFullscreenButtons();
}

async function toggleSiteFullscreen() {
  const active = document.body.classList.contains("site-fullscreen");
  if (active) {
    document.body.classList.remove("site-fullscreen");
    try { if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen(); } catch {}
  } else {
    const tab = current();
    if (!tab || !tab.url) return;
    document.body.classList.add("site-fullscreen");
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch { /* Keep the in-page fullscreen layout if browser fullscreen is unavailable. */ }
  }
  updateFullscreenButtons();
}
function bindUI() {
  $("#newtab").onclick = () => newTab();
  $("#back").onclick = () => current()?.frame.back();
  $("#forward").onclick = () => current()?.frame.forward();
  $("#reload").onclick = () => current()?.frame.reload();
  $("#home").onclick = () => { const t = current(); t.url = ""; activate(t.id); };
  $("#btn-fullscreen").addEventListener("click", toggleSiteFullscreen);
  $("#fullscreen-exit").addEventListener("click", toggleSiteFullscreen);
  document.addEventListener("fullscreenchange", onFullscreenChange);
  const addr = $("#address");
  addr.addEventListener("input", () => { addrDirty = true; });
  addr.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { addrDirty = false; navigate(addr.value); addr.blur(); }
    else if (e.key === "Escape") { addrDirty = false; addr.value = (current() && current().url) || ""; addr.blur(); }
  });
  addr.addEventListener("focus", () => addr.select());
  addr.addEventListener("blur", () => { addrDirty = false; const t = current(); addr.value = t ? t.url : ""; });

  $("#star").onclick = async () => {
    const t = current();
    if (!t || !t.url) return;
    try {
      const b = MirageData.findBookmark(t.url);
      if (b) await MirageData.removeBookmark(b.id);
      else await MirageData.addBookmark({ title: t.title, url: t.url });
    } catch (e) { showError(e.message); }
  };
  $("#ntp-form").addEventListener("submit", (e) => { e.preventDefault(); navigate($("#ntp-input").value); });
  document.addEventListener("keydown", onShortcut);
}

// An older Scramjet build may have left an IndexedDB with a different schema.
// Clear it (and any old service workers) once, then reload.
async function resetStaleState() {
  try {
    for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
  } catch {}
  const names = new Set(["$scramjet"]);
  try {
    for (const db of (await indexedDB.databases?.()) || []) {
      if (db.name && /scramjet/i.test(db.name)) names.add(db.name);
    }
  } catch {}
  await Promise.all([...names].map((n) => new Promise((res) => {
    const r = indexedDB.deleteDatabase(n);
    r.onsuccess = r.onerror = r.onblocked = () => res();
  })));
}

async function diagnose() {
  const out = [];
  try {
    for (const db of (await indexedDB.databases?.()) || []) {
      const stores = await new Promise((res) => {
        const r = indexedDB.open(db.name);
        r.onsuccess = () => { const l = [...r.result.objectStoreNames]; r.result.close(); res(l); };
        r.onerror = () => res(["?"]);
      });
      out.push(`${db.name} v${db.version} [${stores.join(",")}]`);
    }
  } catch {}
  return out.join(" | ") || "no databases";
}

// Public hooks for ui.js (sidebar opens links in the current or a new tab).
window.MirageApp = { navigate: (u) => navigate(u), newTab: (u) => newTab(u), current };

MirageUI.init();
MirageData.on("bookmarks", updateStar);
MirageData.init().catch((e) => console.error("account init failed", e));

if (new URLSearchParams(location.search).has("reset")) {
  sessionStorage.removeItem("mirage-reset");
  resetStaleState().then(() => location.replace("/"));
} else init().catch(async (e) => {
  const msg = (e && e.message) || String(e);
  const stale = /object stores?|IDBDatabase|NotFoundError/i.test(msg);
  if (stale && !sessionStorage.getItem("mirage-reset")) {
    sessionStorage.setItem("mirage-reset", "1");
    await resetStaleState();
    location.reload();
    return;
  }
  showError("Mirage failed to start: " + msg + " (IndexedDB: " + await diagnose() + ")");
});
