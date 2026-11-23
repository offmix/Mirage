"use strict";
const $ = (s) => document.querySelector(s);
const SEARCH = "https://www.google.com/search?q=%s";
const SHORTCUTS = [
  { name: "DuckDuckGo", url: "https://duckduckgo.com/" },
  { name: "Wikipedia", url: "https://www.wikipedia.org/" },
  { name: "GitHub", url: "https://github.com/" },
  { name: "Reddit", url: "https://www.reddit.com/" },
];

let scramjet, tabs = [], activeId = null, nextId = 1;

function setStatus(msg, isError) {
  const el = $("#status");
  if (!msg) { el.hidden = true; return; }
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
    syncTab(tab);
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
  $("#address").value = t.url;
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
  if (!tab.url) return;
  try {
    const doc = tab.iframe.contentDocument;
    if (doc && doc.title && doc.title !== tab.title) setTitle(tab, doc.title);
    const real = tab.frame.url ? String(tab.frame.url) : null;
    if (real) { tab.url = real; if (tab.id === activeId) $("#address").value = real; }
  } catch {}
  setFavicon(tab, findFavicon(tab));
}

// Titles and icons can change after load; keep tabs in sync.
setInterval(() => tabs.forEach(syncTab), 1500);

function bindUI() {
  $("#newtab").onclick = () => newTab();
  $("#back").onclick = () => current()?.frame.back();
  $("#forward").onclick = () => current()?.frame.forward();
  $("#reload").onclick = () => current()?.frame.reload();
  $("#home").onclick = () => { const t = current(); t.url = ""; activate(t.id); };
  $("#address").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { navigate(e.target.value); e.target.blur(); }
  });
  $("#address").addEventListener("focus", (e) => e.target.select());
  $("#ntp-form").addEventListener("submit", (e) => { e.preventDefault(); navigate($("#ntp-input").value); });
  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === "t") { e.preventDefault(); newTab(); }
    if (mod && e.key === "w") { e.preventDefault(); closeTab(activeId); }
    if (mod && e.key === "l") { e.preventDefault(); $("#address").focus(); }
  });
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
