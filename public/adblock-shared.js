"use strict";
// Shared by the page and the service worker (loaded with <script> and importScripts).
// Ad blocker (beta): a small built-in list of ad / tracking domains, plus a tiny IndexedDB key-value store
// the page uses to tell the service worker whether blocking is turned on.
(function (g) {
  const HOSTS = [
    // Google ads
    "doubleclick.net", "googlesyndication.com", "googleadservices.com", "googletagservices.com", "2mdn.net",
    "adservice.google.com", "adservice.google.co.jp", "pagead2.googlesyndication.com",
    // Analytics / tracking
    "google-analytics.com", "scorecardresearch.com", "quantserve.com", "quantcount.com", "krxd.net",
    "bluekai.com", "demdex.net", "rlcdn.com", "tapad.com", "mathtag.com", "everesttech.net",
    // Ad exchanges and networks
    "amazon-adsystem.com", "adnxs.com", "adsrvr.org", "criteo.com", "criteo.net", "taboola.com", "outbrain.com",
    "rubiconproject.com", "pubmatic.com", "openx.net", "casalemedia.com", "indexww.com", "3lift.com",
    "sharethrough.com", "smartadserver.com", "adform.net", "bidswitch.net", "bidr.io", "yieldmo.com",
    "teads.tv", "media.net", "adroll.com", "contextweb.com", "lijit.com", "sovrn.com", "gumgum.com",
    "triplelift.com", "advertising.com", "serving-sys.com", "adtechus.com", "turn.com", "adsafeprotected.com",
    "moatads.com", "doubleverify.com", "ads-twitter.com", "ad.gt",
    // Japan
    "yads.c.yimg.jp", "yjtag.yahoo.co.jp", "i-mobile.co.jp", "microad.jp", "ad-m.asia", "adingo.jp",
    "fout.jp", "nend.net", "adstir.com", "fluct.jp", "socdm.com", "popin.cc", "logly.co.jp", "impact-ad.jp",
    "glossom.jp", "adlantis.jp", "adplan7.com",
  ];
  const SET = new Set(HOSTS);

  // true for a listed domain and any of its subdomains
  function isAdHost(host) {
    host = String(host || "").toLowerCase();
    while (host) {
      if (SET.has(host)) return true;
      const i = host.indexOf(".");
      if (i < 0) return false;
      host = host.slice(i + 1);
    }
    return false;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open("mirage-sw", 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("kv")) r.result.createObjectStore("kv"); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function kvGet(key) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const q = db.transaction("kv").objectStore("kv").get(key);
        q.onsuccess = () => resolve(q.result);
        q.onerror = () => reject(q.error);
      });
    } finally { db.close(); }
  }
  async function kvSet(key, value) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(value, key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }

  g.MirageAdblockShared = { HOSTS, isAdHost, kvGet, kvSet };
})(typeof self !== "undefined" ? self : window);
