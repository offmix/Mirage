"use strict";
// UI: theme, page filter, sidebar (bookmarks/history), settings and account dialogs.
const MirageUI = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const ic = (id) => `<svg><use href="#${id}"/></svg>`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = () => MirageData.state;

  const THEMES = [
    { id: "system", name: "System", bg: "linear-gradient(135deg,#fff 50%,#202124 50%)" },
    { id: "light", name: "Light", bg: "#ffffff" },
    { id: "dark", name: "Dark", bg: "#35363a" },
    { id: "midnight", name: "Midnight", bg: "#141b34" },
    { id: "forest", name: "Forest", bg: "#24382d" },
    { id: "sakura", name: "Sakura", bg: "#fff7fa" },
  ];
  const ACCENTS = { blue: "#4285f4", purple: "#8b5cf6", green: "#1e9e5a", red: "#e5484d", orange: "#f08c00", pink: "#e5467f" };
  const FILTERS = [
    { id: "off", name: "Off" }, { id: "dim", name: "Dim" }, { id: "fog", name: "Fog" },
    { id: "mono", name: "Low contrast" }, { id: "hlines", name: "Horizontal lines" },
    { id: "vlines", name: "Vertical blinds" }, { id: "mesh", name: "Mesh" },
    { id: "dots", name: "Dots" }, { id: "diag", name: "Diagonal" }, { id: "noise", name: "Noise" },
  ];

  // ---------- theme ----------
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  function applyTheme() {
    const s = S().settings;
    document.documentElement.dataset.theme = s.theme === "system" ? (mq.matches ? "dark" : "light") : s.theme;
    document.documentElement.dataset.accent = s.accent;
  }
  mq.addEventListener("change", () => { if (S().settings.theme === "system") applyTheme(); });

  // ---------- page filter ----------
  const NOISE = "url(\"data:image/svg+xml," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.6 -0.2'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
  ) + "\")";

  function filterStyle(type, strength) {
    const s = Math.min(100, Math.max(10, Number(strength) || 60)) / 100;
    const f = (n) => n.toFixed(2);
    switch (type) {
      case "dim":
        return { backgroundColor: `rgba(0,0,0,${f(0.2 + 0.5 * s)})`, backdropFilter: `brightness(${f(1 - 0.4 * s)}) contrast(${f(1 - 0.3 * s)})` };
      case "fog":
        return { backgroundColor: `rgba(150,150,150,${f(0.15 + 0.35 * s)})`, backdropFilter: `blur(${(1 + 4 * s).toFixed(1)}px) contrast(${f(1 - 0.4 * s)})` };
      case "mono":
        return { backdropFilter: `grayscale(1) contrast(${f(1 - 0.55 * s)}) brightness(${f(1 - 0.35 * s)})` };
      case "hlines": {
        const w = (1 + 2 * s).toFixed(1);
        return { backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,${f(0.5 + 0.4 * s)}) 0 ${w}px, transparent ${w}px 4px)`, backdropFilter: `brightness(${f(1 - 0.15 * s)})` };
      }
      case "vlines": {
        const w = (2 + 3 * s).toFixed(1);
        return { backgroundImage: `repeating-linear-gradient(90deg, rgba(0,0,0,${f(0.5 + 0.4 * s)}) 0 ${w}px, transparent ${w}px 7px)` };
      }
      case "mesh": {
        const w = (1 + 1.5 * s).toFixed(1), c = `rgba(0,0,0,${f(0.5 + 0.4 * s)})`;
        return { backgroundImage: `repeating-linear-gradient(0deg, ${c} 0 ${w}px, transparent ${w}px 4px), repeating-linear-gradient(90deg, ${c} 0 ${w}px, transparent ${w}px 4px)` };
      }
      case "dots": {
        const r = 0.8 + 1.2 * s;
        return { backgroundImage: `radial-gradient(circle at center, rgba(0,0,0,${f(0.6 + 0.35 * s)}) ${r.toFixed(1)}px, transparent ${(r + 0.6).toFixed(1)}px)`, backgroundSize: "4px 4px" };
      }
      case "diag": {
        const w = (1 + 2 * s).toFixed(1);
        return { backgroundImage: `repeating-linear-gradient(45deg, rgba(0,0,0,${f(0.5 + 0.4 * s)}) 0 ${w}px, transparent ${w}px 5px)` };
      }
      case "noise":
        return { backgroundImage: NOISE, backgroundSize: "160px 160px", opacity: f(0.3 + 0.7 * s), backdropFilter: `brightness(${f(1 - 0.2 * s)})` };
      default:
        return null;
    }
  }
  function paint(el, st) {
    el.style.cssText = "";
    if (!st) return;
    Object.assign(el.style, st);
    if (st.backdropFilter) el.style.webkitBackdropFilter = st.backdropFilter;
  }
  function applyFilter() {
    const el = $("#privacy-filter"), f = S().settings.filter;
    const st = f.type === "off" ? null : filterStyle(f.type, f.strength);
    if (!st) { el.hidden = true; return; }
    paint(el, st);
    el.hidden = false;
  }
  let lastFilter = "dim";
  function toggleFilter() {
    const f = S().settings.filter;
    if (f.type !== "off") { lastFilter = f.type; MirageData.setSettings({ filter: { type: "off" } }); }
    else MirageData.setSettings({ filter: { type: lastFilter } });
  }

  // ---------- sidebar ----------
  let panel = "bookmarks", query = "";
  const sb = () => $("#sidebar");

  function buildSidebar() {
    sb().innerHTML = `
      <div class="sb-head">
        <div class="sb-tabs">
          <button data-panel="bookmarks">Bookmarks</button>
          <button data-panel="history">History</button>
        </div>
        <button class="icon-btn small" data-sb-close title="Close" aria-label="Close">${ic("i-close")}</button>
      </div>
      <div class="sb-tools">
        <div class="sb-search">${ic("i-search")}<input id="sb-q" type="text" placeholder="Search" autocomplete="off"></div>
        <button class="btn" id="sb-action"></button>
      </div>
      <div class="sb-list" id="sb-list"></div>`;

    sb().addEventListener("click", async (e) => {
      const t = e.target.closest("[data-panel]");
      if (t) { panel = t.dataset.panel; query = ""; $("#sb-q").value = ""; renderSidebar(); if (panel === "history") MirageData.loadHistory(); return; }
      if (e.target.closest("[data-sb-close]")) { closeSidebar(); return; }
      if (e.target.closest("#sb-signin")) { openAccount(); return; }
      if (e.target.closest("#sb-action")) { await sidebarAction(); return; }
      const del = e.target.closest("[data-del]");
      const item = e.target.closest(".item");
      if (del && item) {
        e.stopPropagation();
        try { panel === "bookmarks" ? await MirageData.removeBookmark(item.dataset.id) : await MirageData.deleteHistory(item.dataset.id); }
        catch (err) { alert(err.message); }
        return;
      }
      if (item) openItem(item.dataset.url, e.ctrlKey || e.metaKey);
    });
    sb().addEventListener("auxclick", (e) => {
      const item = e.target.closest(".item");
      if (item && e.button === 1) { e.preventDefault(); openItem(item.dataset.url, true); }
    });
    sb().addEventListener("keydown", (e) => {
      const item = e.target.closest(".item");
      if (item && e.key === "Enter") openItem(item.dataset.url, e.ctrlKey || e.metaKey);
    });
    $("#sb-q").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); renderList(); });
  }

  function openItem(url, newTab) {
    if (newTab) window.MirageApp.newTab(url); else window.MirageApp.navigate(url);
  }

  async function sidebarAction() {
    try {
      if (panel === "bookmarks") {
        const t = window.MirageApp.current();
        if (t && t.url) await MirageData.addBookmark({ title: t.title, url: t.url });
      } else if (S().user && confirm("Delete all browsing history?")) {
        await MirageData.clearHistory();
      }
    } catch (err) { alert(err.message); }
  }

  function openSidebar(p) {
    if (p) panel = p;
    sb().hidden = false;
    $("#btn-sidebar").classList.add("on");
    renderSidebar();
    if (panel === "history") MirageData.loadHistory();
  }
  function closeSidebar() { sb().hidden = true; $("#btn-sidebar").classList.remove("on"); }
  function toggleSidebar() { sb().hidden ? openSidebar() : closeSidebar(); }

  function shortUrl(u) {
    try { const x = new URL(u); return x.host + (x.pathname === "/" ? "" : x.pathname); } catch { return u; }
  }
  function itemHtml(it, time) {
    return `<div class="item" tabindex="0" data-id="${esc(it.id)}" data-url="${esc(it.url)}">
      <span class="ico">${ic("i-globe")}</span>
      <div class="meta"><div class="t">${esc(it.title || it.url)}</div><div class="u">${esc(shortUrl(it.url))}</div></div>
      ${time ? `<span class="tm">${esc(time)}</span>` : ""}
      <button class="del" data-del title="Delete" aria-label="Delete">${ic("i-trash")}</button></div>`;
  }
  function dayLabel(iso) {
    const d = new Date(iso), same = (a, b) => a.toDateString() === b.toDateString();
    if (same(d, new Date())) return "Today";
    if (same(d, new Date(Date.now() - 864e5))) return "Yesterday";
    return d.toLocaleDateString();
  }

  function renderSidebar() {
    if (sb().hidden) return;
    for (const b of sb().querySelectorAll("[data-panel]")) b.classList.toggle("active", b.dataset.panel === panel);
    const act = $("#sb-action");
    act.hidden = false;
    if (panel === "bookmarks") { act.textContent = "Add page"; act.className = "btn"; }
    else { act.textContent = "Clear all"; act.className = "btn danger"; act.hidden = !S().user || !S().history.length; }
    renderList();
  }

  function renderList() {
    const list = $("#sb-list");
    if (!list) return;
    const match = (x) => !query || (x.title || "").toLowerCase().includes(query) || x.url.toLowerCase().includes(query);
    if (panel === "bookmarks") {
      const items = S().bookmarks.filter(match);
      list.innerHTML = items.length ? items.map((b) => itemHtml(b)).join("")
        : `<div class="empty">${query ? "No matches." : "No bookmarks yet.<br>Press the star in the address bar to add one."}</div>`;
      return;
    }
    if (!MirageData.enabled) { list.innerHTML = `<div class="empty">Accounts are not configured on this server, so history is unavailable.</div>`; return; }
    if (!S().user) { list.innerHTML = `<div class="empty">Sign in to save and browse your history.<br><button class="btn primary" id="sb-signin">Sign in</button></div>`; return; }
    const items = S().history.filter(match);
    if (!items.length) { list.innerHTML = `<div class="empty">${query ? "No matches." : "No history yet."}</div>`; return; }
    let last = "", html = "";
    for (const h of items) {
      const lab = dayLabel(h.visited_at);
      if (lab !== last) { html += `<div class="group">${esc(lab)}</div>`; last = lab; }
      html += itemHtml(h, new Date(h.visited_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }
    list.innerHTML = html;
  }

  // ---------- account ----------
  let accMode = "signin";
  const dlgAcc = () => $("#dlg-account");

  function avatarHtml(url) {
    return url ? `<img src="${esc(url)}" crossorigin="anonymous" alt="">` : ic("i-person");
  }
  function refreshAvatarBtn() {
    const slot = $("#avatar-slot"), p = S().profile;
    slot.innerHTML = avatarHtml(p && p.avatar_url);
    const img = slot.querySelector("img");
    if (img) img.addEventListener("error", () => { slot.innerHTML = ic("i-person"); });
    $("#btn-account").title = S().user ? (p && p.username) || "Account" : "Sign in";
  }

  function openAccount() { renderAccount(); if (!dlgAcc().open) dlgAcc().showModal(); }

  function renderAccount() {
    const d = dlgAcc(), st = S();
    let body;
    if (!MirageData.enabled) {
      body = `<p class="note">Accounts are not configured on this server. Set the SUPABASE_URL and SUPABASE_ANON_KEY environment variables. Bookmarks and settings are still saved in this browser.</p>`;
    } else if (!st.user) {
      const up = accMode === "signup";
      body = `
        <div class="seg"><button data-mode="signin" class="${up ? "" : "active"}">Sign in</button><button data-mode="signup" class="${up ? "active" : ""}">Sign up</button></div>
        <form id="acc-form">
          ${up ? `<label class="field"><span>Username</span><input type="text" name="username" required minlength="2" maxlength="20" autocomplete="username"></label>` : ""}
          <label class="field"><span>Email</span><input type="email" name="email" required autocomplete="email"></label>
          <label class="field"><span>Password</span><input type="password" name="password" required minlength="6" autocomplete="${up ? "new-password" : "current-password"}"></label>
          <div class="msg" id="acc-msg" role="status"></div>
          <button class="btn primary" type="submit">${up ? "Create account" : "Sign in"}</button>
        </form>
        <p class="note">Bookmarks saved before you sign in are added to your account. History is saved only while signed in.</p>`;
    } else {
      const p = st.profile || {};
      body = `
        <div class="acc-top">
          <div class="acc-avatar">${avatarHtml(p.avatar_url)}</div>
          <div><button class="btn" id="acc-photo">Change photo</button><input type="file" id="acc-file" accept="image/*" hidden></div>
        </div>
        <div class="field"><span>Username</span><div class="row"><input type="text" id="acc-name" value="${esc(p.username || "")}" minlength="2" maxlength="20"><button class="btn primary" id="acc-save">Save</button></div></div>
        <div class="field"><span>Email</span><div class="static">${esc(st.user.email || "")}</div></div>
        <div class="msg" id="acc-msg" role="status"></div>
        <button class="btn danger" id="acc-out">Sign out</button>`;
    }
    d.innerHTML = `<div class="dlg-head"><h2>Account</h2><button class="icon-btn small" data-close aria-label="Close">${ic("i-close")}</button></div><div class="dlg-body">${body}</div>`;
    const img = d.querySelector(".acc-avatar img");
    if (img) img.addEventListener("error", () => { img.parentElement.innerHTML = ic("i-person"); });
    wireAccount(d);
  }

  function wireAccount(d) {
    const msg = (text, kind) => { const m = d.querySelector("#acc-msg"); if (m) { m.textContent = text || ""; m.className = "msg " + (kind || ""); } };
    d.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { accMode = b.dataset.mode; renderAccount(); }));

    const form = d.querySelector("#acc-form");
    if (form) form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form), btn = form.querySelector("button[type=submit]");
      btn.disabled = true; msg("");
      try {
        if (accMode === "signup") {
          const r = await MirageData.signUp(fd.get("email"), fd.get("password"), String(fd.get("username") || "").trim());
          if (r.needsConfirm) msg("Check your email to confirm your account, then sign in.", "ok");
        } else {
          await MirageData.signIn(fd.get("email"), fd.get("password"));
        }
      } catch (err) { msg(err.message, "err"); }
      btn.disabled = false;
    });

    const photo = d.querySelector("#acc-photo"), file = d.querySelector("#acc-file");
    if (photo) {
      photo.addEventListener("click", () => file.click());
      file.addEventListener("change", async () => {
        if (!file.files[0]) return;
        msg("Uploading...");
        try { await MirageData.uploadAvatar(file.files[0]); }
        catch (err) { msg(err.message, "err"); }
      });
    }
    const save = d.querySelector("#acc-save");
    if (save) save.addEventListener("click", async () => {
      save.disabled = true; msg("");
      try { await MirageData.updateUsername(d.querySelector("#acc-name").value); msg("Saved.", "ok"); }
      catch (err) { msg(err.message, "err"); }
      save.disabled = false;
    });
    const out = d.querySelector("#acc-out");
    if (out) out.addEventListener("click", async () => { await MirageData.signOut(); });
  }

  // ---------- settings ----------
  const dlgSet = () => $("#dlg-settings");

  function renderSettings() {
    const d = dlgSet(), s = S().settings;
    d.innerHTML = `
      <div class="dlg-head"><h2>Settings</h2><button class="icon-btn small" data-close aria-label="Close">${ic("i-close")}</button></div>
      <div class="dlg-body">
        <section>
          <h3>Theme</h3>
          <div class="grid">${THEMES.map((t) => `<button class="card" data-theme="${t.id}"><span class="sw" style="background:${t.bg}"></span><span>${t.name}</span></button>`).join("")}</div>
          <h4>Accent color</h4>
          <div class="accents">${Object.entries(ACCENTS).map(([k, v]) => `<button class="dot" data-accent="${k}" style="background:${v}" title="${k}" aria-label="${k}"></button>`).join("")}</div>
        </section>
        <section>
          <h3>Page filter</h3>
          <p class="note">Makes the page harder to read for people looking over your shoulder. Toggle quickly with Alt+P. A software filter cannot depend on viewing angle like a physical privacy screen, so it works by reducing legibility.</p>
          <div class="grid">${FILTERS.map((f) => `<button class="card" data-filter="${f.id}"><span class="fl"><span class="fl-ov" data-prev="${f.id}"></span></span><span>${f.name}</span></button>`).join("")}</div>
          <label class="field"><span>Strength <b id="f-val"></b></span><input id="f-range" type="range" min="10" max="100" step="5"></label>
          <div class="fprev"><p>The quick brown fox jumps over the lazy dog. 0123456789</p><p>Preview of the page behind the filter.</p><div class="fprev-ov" id="fprev"></div></div>
        </section>
        <section>
          <h3>Sync</h3>
          <p class="note">${S().user ? "Your settings are saved to your account." : MirageData.enabled ? "Settings are saved in this browser. Sign in to save them to your account." : "Settings are saved in this browser."}</p>
        </section>
      </div>`;
    // tiny previews inside each filter card
    d.querySelectorAll("[data-prev]").forEach((el) => {
      el.style.cssText = "position:absolute;inset:0;";
      const st = filterStyle(el.dataset.prev, 70);
      if (st) { Object.assign(el.style, st); }
      el.parentElement.style.backgroundImage = "linear-gradient(#222 2px, transparent 2px)";
      el.parentElement.style.backgroundSize = "100% 6px";
    });
    syncSettingsDialog();
  }

  function syncSettingsDialog() {
    const d = dlgSet();
    if (!d.open) return;
    const s = S().settings;
    d.querySelectorAll("[data-theme]").forEach((b) => b.classList.toggle("sel", b.dataset.theme === s.theme));
    d.querySelectorAll("[data-accent]").forEach((b) => b.classList.toggle("sel", b.dataset.accent === s.accent));
    d.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("sel", b.dataset.filter === s.filter.type));
    const r = d.querySelector("#f-range");
    if (r && document.activeElement !== r) r.value = s.filter.strength;
    d.querySelector("#f-val").textContent = s.filter.strength + "%";
    paint(d.querySelector("#fprev"), s.filter.type === "off" ? null : filterStyle(s.filter.type, s.filter.strength));
  }

  function openSettings() { renderSettings(); dlgSet().showModal(); syncSettingsDialog(); }

  function wireSettings() {
    const d = dlgSet();
    d.addEventListener("click", (e) => {
      const t = e.target.closest("[data-theme]"), a = e.target.closest("[data-accent]"), f = e.target.closest("[data-filter]");
      if (t) MirageData.setSettings({ theme: t.dataset.theme });
      else if (a) MirageData.setSettings({ accent: a.dataset.accent });
      else if (f) MirageData.setSettings({ filter: { type: f.dataset.filter } });
    });
    d.addEventListener("input", (e) => {
      if (e.target.id === "f-range") MirageData.setSettings({ filter: { strength: Number(e.target.value) } });
    });
  }

  // ---------- init ----------
  function init() {
    buildSidebar();
    applyTheme(); applyFilter(); refreshAvatarBtn();

    $("#btn-sidebar").onclick = toggleSidebar;
    $("#btn-settings").onclick = openSettings;
    $("#btn-account").onclick = openAccount;
    for (const d of [dlgSet(), dlgAcc()]) {
      d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
    }
    wireSettings();

    MirageData.on("settings", () => { applyTheme(); applyFilter(); syncSettingsDialog(); });
    MirageData.on("auth", () => {
      refreshAvatarBtn();
      if (dlgAcc().open) renderAccount();
      if (dlgSet().open) renderSettings();
      renderSidebar();
      if (!sb().hidden && panel === "history") MirageData.loadHistory();
    });
    MirageData.on("bookmarks", renderSidebar);
    MirageData.on("history", renderSidebar);
  }

  return { init, toggleFilter, openSidebar, closeSidebar, openAccount };
})();
