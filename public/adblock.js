"use strict";
// Ad blocker (beta), page side: settings section, hiding ad elements inside proxied pages,
// and telling the service worker (which blocks the requests) whether blocking is on.
const MirageAdblock = (() => {
  const S = () => MirageData.state.settings;
  const enabled = () => !!(S().adblock && S().adblock.enabled);
  const shared = () => globalThis.MirageAdblockShared;
  let blocked = 0;
  let lastEnabled = null;

  // Conservative selectors: common ad containers only. Broad guesses would break page layouts.
  const COSMETIC_CSS = [
    "ins.adsbygoogle", ".adsbygoogle", ".google-auto-placed",
    '[id^="google_ads_iframe"]', '[id^="div-gpt-ad"]', '[id^="google_ads_"]',
    'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication.com"]', 'iframe[src*="adservice.google"]',
    'iframe[src*="amazon-adsystem.com"]', 'iframe[src*="taboola.com"]', 'iframe[src*="outbrain.com"]',
    ".ad-banner", ".ad-container", ".ad-slot", ".ad-wrapper", ".advertisement", ".adsbox",
    "#ad-container", "#ad_banner", "#adBanner",
  ].join(",\n") + "{display:none!important}";

  async function apply() {
    try { if (shared()) await shared().kvSet("adblock", { enabled: enabled() }); } catch (e) { console.warn("adblock: could not save state", e); }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sw = reg && (reg.active || navigator.serviceWorker.controller);
      if (sw) sw.postMessage({ type: "mirage:adblock-refresh" });
    } catch {}
  }

  // Called for every proxied document (idempotent): add or remove the hiding stylesheet.
  function attach(doc) {
    try {
      const head = doc.head || doc.documentElement;
      if (!head) return;
      const old = doc.getElementById("mirage-adblock");
      if (!enabled()) { if (old) old.remove(); return; }
      if (old) return;
      const style = document.createElement("style"); // created by the Mirage page itself, then moved in
      style.id = "mirage-adblock";
      style.textContent = COSMETIC_CSS;
      head.appendChild(style);
    } catch {}
  }

  function settingsHtml() {
    const n = shared() ? shared().HOSTS.length : 0;
    return `
        <section>
          <h3>広告ブロック <span class="beta-badge">β</span></h3>
          <div class="warn-box">
            <b>β機能(試験的な機能)です。ご利用前にお読みください。</b>
            <ul>
              <li>ブロックは完全ではなく、広告が残ることがあります。</li>
              <li>逆に、サイトの表示、ログイン、決済、動画の再生などが正常に動かなくなることがあります。</li>
              <li>YouTube のように、広告が動画そのものに埋め込まれているものは消せません。</li>
              <li>広告ブロックを検知して、利用を制限するサイトもあります。</li>
              <li>設定を変えたあとは、開いているページを再読み込みしてください。</li>
              <li>不具合が出たときは、オフにして再読み込みしてください。</li>
            </ul>
          </div>
          <label class="check"><input id="ab-enabled" type="checkbox"><span>広告ブロックを有効にする</span></label>
          <p class="note">内蔵の簡易リスト(${n}ドメイン)と、広告枠の非表示を使います。今回ブロックした件数: <b id="ab-count">${blocked}</b></p>
          <div class="msg" id="ab-msg" role="status" aria-live="polite"></div>
        </section>
`;
  }

  function syncSettings(d) {
    const box = d.querySelector("#ab-enabled");
    if (box) box.checked = enabled();
    const count = d.querySelector("#ab-count");
    if (count) count.textContent = String(blocked);
  }

  function wireSettings(d) {
    d.addEventListener("change", (e) => {
      if (e.target.id !== "ab-enabled") return;
      MirageData.setSettings({ adblock: { enabled: e.target.checked } });
      const m = d.querySelector("#ab-msg");
      if (m) {
        m.textContent = e.target.checked
          ? "広告ブロックを有効にしました。開いているページは再読み込みすると反映されます。"
          : "広告ブロックを無効にしました。開いているページを再読み込みしてください。";
        m.className = "msg";
      }
    });
  }

  function init() {
    lastEnabled = enabled();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (e) => {
        if (!e.data || e.data.type !== "mirage:blocked") return;
        blocked++;
        const el = document.getElementById("ab-count");
        if (el) el.textContent = String(blocked);
      });
    }
    MirageData.on("settings", () => { if (enabled() !== lastEnabled) { lastEnabled = enabled(); apply(); } });
    apply();
  }

  return { init, attach, settingsHtml, syncSettings, wireSettings, isEnabled: enabled };
})();
