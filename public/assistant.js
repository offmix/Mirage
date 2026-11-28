"use strict";
// Mirage assistant: the "AI" panel in the sidebar. Chat goes through this server (/api/assistant);
// the browser never sees the AI service, its key, or which model is used.
const MirageAssistant = (() => {
  const KEY = "mirage:assistant";
  const MAX_SAVED = 40;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let history = [];            // [{ role, content, page? }]
  let busy = false, abort = null, built = false;

  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(history.slice(-MAX_SAVED))); } catch {} };
  const enabled = () => !(window.MIRAGE_CONFIG && window.MIRAGE_CONFIG.assistant === false);

  // ---------- streaming helpers ----------
  // Takes the complete events out of the text received so far; the unfinished tail is returned as "rest".
  function sseTake(buf) {
    const chunks = [];
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const event = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;                // comments (": ping") and other fields are ignored
        try { const t = JSON.parse(line.slice(5).trim()); if (typeof t === "string") chunks.push(t); } catch {}
      }
    }
    return { chunks, rest: buf };
  }
  // How many characters are shown after the next tick: a steady trickle, catching up faster when text piles up.
  const nextShown = (shown, total) => Math.min(total, shown + Math.max(1, Math.ceil((total - shown) / 12)));

  // ---------- Markdown -> safe HTML ----------
  // Everything is HTML-escaped first; only the tags generated here can appear. Links are limited to http(s).
  function inline(raw) {
    const codes = [];
    let s = String(raw).replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m, t, code) => { codes.push(code.replace(/^ (.+) $/, "$1")); return "\u0000" + (codes.length - 1) + "\u0000"; });
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");                                           // images are not loaded; keep the alt text
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m, t, url) => `<a href="${url}" data-ai-link>${t}</a>`);
    // bare URLs become links too, but never inside the links made above
    s = s.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/).map((part, k) => (k % 2 ? part
      : part.replace(/(^|[\s(（])(https?:\/\/[^\s<)）]+[^\s<).,;:!?）])/g, (m, pre, url) => `${pre}<a href="${url}" data-ai-link>${url}</a>`))).join("");
    s = s.replace(/\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*/g, "<strong>$1</strong>").replace(/__(?=\S)([\s\S]+?)(?<=\S)__/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(>])\*(?=[^\s*])([^*\n]+?)(?<=[^\s*])\*(?=[\s.,;:!?)<]|$)/g, "$1<em>$2</em>");
    s = s.replace(/(^|[\s(>])_(?=[^\s_])([^_\n]+?)(?<=[^\s_])_(?=[\s.,;:!?)<]|$)/g, "$1<em>$2</em>");
    s = s.replace(/~~(?=\S)([\s\S]+?)(?<=\S)~~/g, "<del>$1</del>");
    return s.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${esc(codes[Number(i)])}</code>`);
  }

  const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  const FENCE_RE = /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/;
  const HR_RE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
  const HEAD_RE = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
  const SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  const indentOf = (l) => l.match(/^\s*/)[0].replace(/\t/g, "    ").length;
  const splitRow = (l) => {
    let t = l.trim();
    if (t.startsWith("|")) t = t.slice(1);
    if (t.endsWith("|") && !t.endsWith("\\|")) t = t.slice(0, -1);
    return t.split(/(?<!\\)\|/).map((x) => x.trim().replace(/\\\|/g, "|"));
  };
  const startsBlock = (lines, i) => {
    const l = lines[i];
    return FENCE_RE.test(l) || HR_RE.test(l) || HEAD_RE.test(l) || LIST_RE.test(l) || /^\s{0,3}>/.test(l) ||
      (l.includes("|") && i + 1 < lines.length && SEP_RE.test(lines[i + 1]) && lines[i + 1].includes("-"));
  };

  function parseList(lines, start) {
    const first = lines[start].match(LIST_RE), base = first[1].replace(/\t/g, "    ").length;
    const ordered = /\d/.test(first[2]);
    const items = [];
    let i = start;
    while (i < lines.length) {
      const m = lines[i].match(LIST_RE);
      if (!m) {
        if (!lines[i].trim()) {                                   // a blank line: the list goes on only if another item follows
          let j = i + 1;
          while (j < lines.length && !lines[j].trim()) j++;
          const n = j < lines.length && lines[j].match(LIST_RE);
          if (n && n[1].replace(/\t/g, "    ").length >= base) { i = j; continue; }
          break;
        }
        if (indentOf(lines[i]) > base && items.length && !startsBlock(lines, i)) { items[items.length - 1].text += "\n" + lines[i].trim(); i++; continue; }
        break;
      }
      const ind = m[1].replace(/\t/g, "    ").length;
      if (ind < base) break;
      if (ind > base && items.length) { const sub = parseList(lines, i); items[items.length - 1].kids.push(sub.html); i = sub.next; continue; }
      items.push({ text: m[3], kids: [] });
      i++;
    }
    const tag = ordered ? "ol" : "ul";
    const html = `<${tag}>` + items.map((it) => {
      let t = it.text, box = "";
      const task = t.match(/^\[([ xX])\]\s+/);
      if (task) { box = `<input type="checkbox" disabled${task[1] === " " ? "" : " checked"}> `; t = t.slice(task[0].length); }
      return `<li>${box}${inline(t).replace(/\n/g, "<br>")}${it.kids.join("")}</li>`;
    }).join("") + `</${tag}>`;
    return { html, next: i };
  }

  function markdown(text) {
    const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      let m = line.match(FENCE_RE);
      if (m) {                                                    // fenced code (an unfinished one, while streaming, is shown as it is)
        const fence = m[1], body = [];
        i++;
        while (i < lines.length && !(lines[i].trim().startsWith(fence[0].repeat(fence.length)) && /^[`~]+\s*$/.test(lines[i].trim()))) { body.push(lines[i]); i++; }
        i++;
        out.push(`<div class="ai-code"><div class="ai-code-bar"><span>${esc(m[2] || "code")}</span><button type="button" data-ai-copy>コピー</button></div><pre><code>${esc(body.join("\n"))}</code></pre></div>`);
        continue;
      }
      if (!line.trim()) { i++; continue; }
      if (HR_RE.test(line)) { out.push("<hr>"); i++; continue; }
      m = line.match(HEAD_RE);
      if (m) { out.push(`<div class="ai-h ai-h${m[1].length}">${inline(m[2])}</div>`); i++; continue; }
      if (line.includes("|") && i + 1 < lines.length && SEP_RE.test(lines[i + 1]) && lines[i + 1].includes("-")) {
        const head = splitRow(line), align = splitRow(lines[i + 1]).map((a) => (/^:-+:$/.test(a) ? "center" : /-:$/.test(a) ? "right" : ""));
        const rows = [];
        i += 2;
        while (i < lines.length && lines[i].trim() && lines[i].includes("|")) { rows.push(splitRow(lines[i])); i++; }
        const cell = (tag, t, k) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ""}>${inline(t || "")}</${tag}>`;
        out.push(`<div class="ai-table"><table><thead><tr>${head.map((h, k) => cell("th", h, k)).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, k) => cell("td", r[k], k)).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }
      if (/^\s{0,3}>/.test(line)) {
        const q = [];
        while (i < lines.length && /^\s{0,3}>/.test(lines[i])) { q.push(lines[i].replace(/^\s{0,3}>\s?/, "")); i++; }
        out.push(`<blockquote>${markdown(q.join("\n"))}</blockquote>`);
        continue;
      }
      if (LIST_RE.test(line)) { const r = parseList(lines, i); out.push(r.html); i = r.next; continue; }
      const para = [line];                                        // a paragraph: lines are kept as written (chat style)
      i++;
      while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) { para.push(lines[i]); i++; }
      out.push(`<p>${para.map((l) => inline(l.trim())).join("<br>")}</p>`);
    }
    return out.join("");
  }
  const format = markdown;

  function bubble(role, html, cls) {
    const d = document.createElement("div");
    d.className = "ai-msg ai-" + role + (cls ? " " + cls : "");
    d.innerHTML = html;
    return d;
  }
  function scrollDown() { const m = $("#ai-msgs"); if (m) m.scrollTop = m.scrollHeight; }

  function renderAll() {
    const box = $("#ai-msgs");
    if (!box) return;
    box.innerHTML = "";
    if (!history.length) {
      box.appendChild(bubble("assistant", enabled()
        ? "こんにちは。Mirage アシスタントです。Mirage の使い方や、開いているサイトについて質問できます。「開いているページを読み込む」をオンにすると、ページの内容をもとに概要を答えます。"
        : "アシスタントは、このサーバーではまだ設定されていません。", "ai-hint"));
    }
    for (const m of history) {
      const el = bubble(m.role, m.role === "assistant" ? markdown(m.content) : esc(m.content));
      if (m.page) { const cap = document.createElement("div"); cap.className = "ai-cap"; cap.textContent = "参照したページ: " + m.page; el.appendChild(cap); }
      box.appendChild(el);
    }
    scrollDown();
  }

  function setBusy(v) {
    busy = v;
    const send = $("#ai-send");
    if (send) { send.textContent = v ? "停止" : "送信"; send.classList.toggle("danger", v); }
    const input = $("#ai-input");
    if (input) input.disabled = false;
  }

  async function send(text, forcePage) {
    text = String(text || "").trim();
    if (!text || busy || !enabled()) return;
    const wantPage = forcePage || ($("#ai-page") && $("#ai-page").checked);
    let page = null, pageNote = "";
    if (wantPage) {
      const r = window.MirageApp && window.MirageApp.readPage ? window.MirageApp.readPage() : { error: "ページを読み取れません。" };
      if (r.error) pageNote = r.error; else page = r;
    }
    const userMsg = { role: "user", content: text };
    if (page) userMsg.page = page.title || page.url;
    history.push(userMsg);
    save(); renderAll();
    if (pageNote) $("#ai-msgs").appendChild(bubble("assistant", esc(pageNote + " ページなしで答えます。"), "ai-hint"));

    const box = $("#ai-msgs");
    const answer = bubble("assistant", "…", "ai-pending");
    box.appendChild(answer); scrollDown();

    // only roles and text go to the server (the page text is attached to this message only)
    const payload = { messages: history.slice(-16).map((m) => ({ role: m.role, content: m.content })) };
    if (page) payload.page = { url: page.url, title: page.title, description: page.description, text: page.text };

    abort = new AbortController();
    setBusy(true);

    // The answer arrives as Server-Sent Events. Text is revealed a little at a time, so it flows
    // smoothly even when the network delivers it in bursts, and it follows the end only if you are at the bottom.
    let target = "", shown = 0, finished = false, timer = 0, drainedResolve;
    const drained = new Promise((r) => { drainedResolve = r; });
    const started = Date.now();
    const waitTick = setInterval(() => { if (!target) answer.textContent = `考え中… ${Math.floor((Date.now() - started) / 1000)}秒`; }, 500);
    answer.textContent = "考え中… 0秒";

    function paint() {
      const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
      answer.classList.remove("ai-pending");
      answer.classList.toggle("ai-streaming", !finished || shown < target.length);
      answer.innerHTML = markdown(target.slice(0, shown));
      if (nearBottom) box.scrollTop = box.scrollHeight;
    }
    function step() {
      timer = 0;
      if (document.hidden) shown = target.length;                 // a hidden tab: no need to animate
      else shown = nextShown(shown, target.length);
      if (target) paint();
      if (shown < target.length || !finished) timer = setTimeout(step, 16);
      else drainedResolve();
    }
    const kick = () => { if (!timer) timer = setTimeout(step, 0); };

    let got = "";
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: abort.signal });
      if (!res.ok) {
        let msg = "アシスタントを利用できませんでした。";
        try { msg = (await res.json()).error || msg; } catch {}
        throw new Error(msg);
      }
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const taken = sseTake(buf);
        buf = taken.rest;
        if (taken.chunks.length) { target += taken.chunks.join(""); clearInterval(waitTick); kick(); }
      }
      finished = true;
      kick();
      await drained;
    } catch (e) {
      finished = true;
      shown = target.length;                                      // show everything that arrived before the stop or the error
      if (e && e.name === "AbortError") target += target ? "\n\n(停止しました)" : "(停止しました)";
      else target += target ? "\n\n" + e.message : e.message;
      shown = target.length;
    } finally {
      clearInterval(waitTick);
      if (timer) clearTimeout(timer);
      abort = null;
      setBusy(false);
      got = target;
      answer.classList.remove("ai-pending", "ai-streaming");
      if (got.trim()) history.push({ role: "assistant", content: got.trim() });
      save(); renderAll();
      if (!got.trim()) $("#ai-msgs").appendChild(bubble("assistant", "応答が返りませんでした。もう一度お試しください。", "ai-hint"));
    }
  }

  function build() {
    const root = $("#sb-ai");
    if (!root || built) return;
    built = true;
    root.innerHTML = `
      <div class="ai-head"><b>Mirage アシスタント</b><button type="button" class="iw-link" data-ai="new">新しい会話</button></div>
      <div class="ai-msgs" id="ai-msgs" aria-live="polite"></div>
      <div class="ai-tools">
        <label class="check"><input type="checkbox" id="ai-page"><span>開いているページを読み込む</span></label>
        <div class="ai-quick">
          <button type="button" data-ai-q="summary">このページを要約</button>
          <button type="button" data-ai-q="points">要点を箇条書き</button>
          <button type="button" data-ai-q="about">どんなサイト?</button>
        </div>
      </div>
      <form class="ai-form" id="ai-form">
        <textarea id="ai-input" rows="2" maxlength="4000" placeholder="メッセージを入力(Enterで送信、Shift+Enterで改行)"></textarea>
        <button class="btn primary" id="ai-send" type="submit">送信</button>
      </form>
      <p class="ai-note">AIの回答には誤りが含まれることがあります。「ページを読み込む」をオンにすると、ページの本文がAIサービスに送られます。</p>`;

    const QUICK = {
      summary: "いま開いているページの概要を、わかりやすく要約してください。",
      points: "いま開いているページの要点を、箇条書きで教えてください。",
      about: "いま開いているサイトは、どんなサイトですか? 何ができるか教えてください。",
    };
    root.addEventListener("click", async (e) => {
      const link = e.target.closest("a[data-ai-link]");
      if (link) { e.preventDefault(); if (window.MirageApp) window.MirageApp.newTab(link.href); return; }   // opened inside Mirage (proxied)
      const copy = e.target.closest("[data-ai-copy]");
      if (copy) {
        const code = copy.closest(".ai-code").querySelector("code").textContent;
        try { await navigator.clipboard.writeText(code); copy.textContent = "コピーしました"; }
        catch { copy.textContent = "コピーできません"; }
        setTimeout(() => { copy.textContent = "コピー"; }, 1500);
        return;
      }
      const q = e.target.closest("[data-ai-q]");
      if (q) { const box = $("#ai-page"); if (box) box.checked = true; send(QUICK[q.dataset.aiQ], true); return; }
      if (e.target.closest('[data-ai="new"]')) {
        if (abort) abort.abort();
        history = []; save(); renderAll();
      }
    });
    $("#ai-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (busy) { if (abort) abort.abort(); return; }
      const input = $("#ai-input"), text = input.value;
      if (!text.trim()) return;
      input.value = "";
      send(text, false);
    });
    $("#ai-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#ai-form").requestSubmit(); }
    });
    history = load();
    renderAll();
  }

  function init() { build(); }
  function onShow() { build(); renderAll(); setTimeout(() => { const i = $("#ai-input"); if (i && !i.disabled) i.focus(); }, 0); }

  return { init, onShow, format, markdown, sseTake, nextShown };
})();
