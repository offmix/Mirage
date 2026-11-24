"use strict";
// Tab-away lock: when you leave this tab, the whole app is blurred and a password is required to continue.
// The password is stored only as a salted PBKDF2 hash in this browser (localStorage); nothing is sent to a server.
const MirageLock = (() => {
  const $ = (s) => document.querySelector(s);
  const TAB_LOCK_KEY = "mirage:tab-lock";
  const TAB_LOCK_ITERATIONS = 120000;
  let locked = false;
  let onChange = () => {};

  // ---------- storage and hashing ----------
  function getTabLock() {
    try {
      const lock = JSON.parse(localStorage.getItem(TAB_LOCK_KEY) || "null");
      return lock && /^[a-f0-9]{32}$/i.test(lock.salt || "") && /^[a-f0-9]{64}$/i.test(lock.hash || "")
        ? { salt: lock.salt, hash: lock.hash, enabled: lock.enabled !== false }
        : null;
    } catch { return null; }
  }
  function bytesToHex(bytes) {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  function hexToBytes(hex) {
    return new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  }
  async function passwordHash(password, salt) {
    if (!globalThis.crypto || !crypto.subtle) throw new Error("このブラウザでは安全なパスワード保存を利用できません。");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: TAB_LOCK_ITERATIONS, hash: "SHA-256" }, key, 256);
    return bytesToHex(new Uint8Array(bits));
  }
  async function saveTabLockPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await passwordHash(password, salt);
    localStorage.setItem(TAB_LOCK_KEY, JSON.stringify({ salt: bytesToHex(salt), hash, enabled: true }));
  }
  async function checkTabLockPassword(password) {
    const lock = getTabLock();
    if (!lock || !lock.enabled) return true;
    const hash = await passwordHash(password, hexToBytes(lock.salt));
    if (hash.length !== lock.hash.length) return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ lock.hash.charCodeAt(i);
    return diff === 0;
  }
  function setTabLockEnabled(enabled) {
    const lock = getTabLock();
    if (!lock) return false;
    try {
      localStorage.setItem(TAB_LOCK_KEY, JSON.stringify({ ...lock, enabled: !!enabled }));
      return true;
    } catch { return false; }
  }

  // ---------- settings section (rendered inside the settings dialog by ui.js) ----------
  function settingsHtml() {
    return `
        <section>
          <h3>タブを離れたときのロック</h3>
          <p class="note">パスワードを設定すると、別のタブへ移動したときに画面をぼかしてロックします。設定はこのブラウザ内に保存されます。サーバー側の認証や、開発者ツールを使った操作を防ぐ機能ではありません。</p>
          <label class="field"><span>ロック用パスワード（3文字以上）</span><input id="tab-lock-new-password" type="password" minlength="3" autocomplete="new-password" placeholder="3文字以上"></label>
          <div class="lock-actions">
            <button class="btn primary" id="tab-lock-save" type="button">パスワードを設定</button>
            <label class="lock-enable"><input id="tab-lock-enabled" type="checkbox" disabled> タブを離れたらロック</label>
            <button class="btn danger" id="tab-lock-remove" type="button" hidden>設定を削除</button>
          </div>
          <div id="tab-lock-settings-msg" class="msg" role="status" aria-live="polite"></div>
        </section>
`;
  }

  function syncSettings(d) {
    const lock = getTabLock();
    const enabled = d.querySelector("#tab-lock-enabled");
    const save = d.querySelector("#tab-lock-save");
    const remove = d.querySelector("#tab-lock-remove");
    if (enabled) { enabled.checked = !!(lock && lock.enabled); enabled.disabled = !lock; }
    if (save) save.textContent = lock ? "パスワードを変更" : "パスワードを設定";
    if (remove) remove.hidden = !lock;
  }

  function wireSettings(d, afterChange) {
    const done = typeof afterChange === "function" ? afterChange : () => {};
    d.addEventListener("click", (e) => {
      if (e.target.closest("#tab-lock-save")) {
        const input = d.querySelector("#tab-lock-new-password");
        const message = d.querySelector("#tab-lock-settings-msg");
        const password = input.value;
        if (password.length < 3) {
          message.textContent = "パスワードは3文字以上にしてください。";
          message.className = "msg err";
          input.focus();
          return;
        }
        const button = d.querySelector("#tab-lock-save");
        button.disabled = true;
        saveTabLockPassword(password).then(() => {
          input.value = "";
          message.textContent = "パスワードを設定しました。タブを離れるとロックします。";
          message.className = "msg ok";
          done();
        }).catch((err) => {
          message.textContent = err.message || "パスワードを保存できませんでした。";
          message.className = "msg err";
        }).finally(() => { button.disabled = false; });
      } else if (e.target.closest("#tab-lock-remove")) {
        if (confirm("このブラウザのタブロック設定を削除しますか？")) {
          localStorage.removeItem(TAB_LOCK_KEY);
          const message = d.querySelector("#tab-lock-settings-msg");
          message.textContent = "ロック設定を削除しました。";
          message.className = "msg";
          done();
        }
      }
    });
    d.addEventListener("change", (e) => {
      if (e.target.id !== "tab-lock-enabled") return;
      const message = d.querySelector("#tab-lock-settings-msg");
      if (!setTabLockEnabled(e.target.checked)) {
        e.target.checked = false;
        message.textContent = "先にロック用パスワードを設定してください。";
        message.className = "msg err";
      } else {
        message.textContent = e.target.checked ? "タブロックを有効にしました。" : "タブロックを無効にしました。";
        message.className = "msg";
      }
    });
  }

  // ---------- lock screen ----------
  function init(options) {
    if (options && typeof options.onChange === "function") onChange = options.onChange;
    const overlay = $("#tab-lock"), app = $("#app"), form = $("#tab-lock-form");
    const input = $("#tab-lock-password"), message = $("#tab-lock-message");
    const mark = $("#tab-lock-mark"), icon = mark.querySelector("use");
    let checking = false;

    function unlock() {
      locked = false;
      checking = false;
      document.body.classList.remove("tab-locked");
      app.inert = false;
      overlay.hidden = true;
      overlay.classList.remove("is-invalid", "is-success");
      icon.setAttribute("href", "#i-lock");
      input.value = "";
      message.textContent = "";
    }
    function lock() {
      const config = getTabLock();
      if (!config || !config.enabled || locked) return;
      locked = true;
      checking = false;
      document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
      document.body.classList.add("tab-locked");
      app.inert = true;
      overlay.hidden = false;
      overlay.classList.remove("is-invalid", "is-success");
      icon.setAttribute("href", "#i-lock");
      input.value = "";
      message.textContent = "";
      if (document.visibilityState === "visible") requestAnimationFrame(() => input.focus());
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") lock();
      else if (locked) requestAnimationFrame(() => input.focus());
    });
    window.addEventListener("pagehide", lock);
    window.addEventListener("storage", (e) => {
      if (e.key === TAB_LOCK_KEY) {
        const config = getTabLock();
        if (locked && (!config || !config.enabled)) unlock();
        onChange();
      }
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!locked || checking) return;
      checking = true;
      overlay.classList.remove("is-invalid", "is-success");
      void mark.offsetWidth;
      try {
        if (await checkTabLockPassword(input.value)) {
          overlay.classList.add("is-success");
          icon.setAttribute("href", "#i-lock-open");
          message.textContent = "ロックを解除しました。";
          setTimeout(unlock, 500);
        } else {
          overlay.classList.add("is-invalid");
          message.textContent = "パスワードが違います。もう一度入力してください。";
          input.value = "";
          input.focus();
          checking = false;
        }
      } catch (err) {
        overlay.classList.add("is-invalid");
        message.textContent = err.message || "パスワードを確認できませんでした。";
        checking = false;
      }
    });
  }

  return { init, settingsHtml, syncSettings, wireSettings, isLocked: () => locked, getConfig: getTabLock };
})();
