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

  // minimal, safe formatting: escape first, then **bold**, `code` and ``` blocks
  function format(text) {
    let t = esc(text);
    t = t.replace(/```(?:[\w-]*)\n?([\s\S]*?)```/g, (m, code) => `<pre>${code.replace(/\n$/, "")}</pre>`);
    t = t.replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
    return t;
  }

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
      const el = bubble(m.role, format(m.content));
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
    let got = "";
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: abort.signal });
      if (!res.ok) {
        let msg = "アシスタントを利用できませんでした。";
        try { msg = (await res.json()).error || msg; } catch {}
        throw new Error(msg);
      }
      const reader = res.body.getReader(), dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        got += dec.decode(value, { stream: true });
        answer.classList.remove("ai-pending");
        answer.innerHTML = format(got) || "…";
        scrollDown();
      }
      got += dec.decode();
    } catch (e) {
      if (e && e.name === "AbortError") got = got ? got + "\n\n(停止しました)" : "(停止しました)";
      else got = got ? got + "\n\n" + e.message : e.message;
    } finally {
      abort = null;
      setBusy(false);
      answer.classList.remove("ai-pending");
      history.push({ role: "assistant", content: got.trim() || "(応答がありませんでした)" });
      save(); renderAll();
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
    root.addEventListener("click", (e) => {
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

  return { init, onShow, format };
})();assistant.js
