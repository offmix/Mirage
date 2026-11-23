"use strict";
const $ = (s) => document.querySelector(s);
const SEARCH = "https://duckduckgo.com/?q=%s";
const SHORTCUTS = [
  { name: "DuckDuckGo", url: "https://duckduckgo.com/" },
  { name: "Wikipedia", url: "https://www.wikipedia.org/" },
  { name: "GitHub", url: "https://github.com/" },
  { name: "Reddit", url: "https://www.reddit.com/" },
];

let scramjet, tabs = [], activeId = null, nextId = 1;

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

async function init() {
  if (!("serviceWorker" in navigator)) { alert("Service workers are not supported."); return; }

  const { ScramjetController } = $scramjetLoadController();
  scramjet = new ScramjetController({
    prefix: "/service/",
    files: {
      wasm: "/scram/scramjet.wasm.js",
      all: "/scram/scramjet.all.js",
      sync: "/scram/scramjet.sync.js",
    },
  });
  await scramjet.init("/sw.js");

  const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
  const wisp = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
  await connection.setTransport("/epoxy/index.mjs", [{ wisp }]);

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
  const tab = { id, iframe, frame, title: "New Tab", url: "", el: null };

  const el = document.createElement("div");
  el.className = "tab";
  el.innerHTML = `<span class="fav">${svgIcon("i-globe")}</span><span class="title">New Tab</span><button class="x" aria-label="Close tab">${svgIcon("i-close")}</button>`;
  el.onclick = () => activate(id);
  el.querySelector(".x").onclick = (e) => { e.stopPropagation(); closeTab(id); };
  $("#tabs").appendChild(el);
  tab.el = el;
  tabs.push(tab);

  iframe.addEventListener("load", () => syncTab(tab));
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
  $("#newtab-page").classList.add("hidden");
  $("#address").value = url;
  try { t.frame.go(url); } catch (e) { showError(e.message); }
}

function setTitle(t, title) {
  t.title = title;
  t.el.querySelector(".title").textContent = title;
}

function syncTab(tab) {
  try {
    const doc = tab.iframe.contentDocument;
    if (doc && doc.title) setTitle(tab, doc.title);
    const real = tab.frame.url ? String(tab.frame.url) : null;
    if (real) { tab.url = real; if (tab.id === activeId) $("#address").value = real; }
  } catch {}
}

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

init().catch((e) => showError("Mirage failed to start: " + (e && e.message || e)));
