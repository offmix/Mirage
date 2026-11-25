// Load whichever Scramjet worker bundle this build ships.
let loaded = false;
for (const f of ["/scram/scramjet.all.js", "/scram/scramjet.worker.js"]) {
  try { importScripts(f); loaded = true; break; } catch (e) { console.warn("[mirage] could not load", f); }
}
if (!loaded) throw new Error("No Scramjet worker bundle found under /scram/");

// Ad blocker (beta) helpers: domain list and the on/off state saved by the page.
try { importScripts("/adblock-shared.js"); } catch (e) { console.warn("[mirage] adblock-shared.js not loaded", e); }

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Take over immediately so updated workers replace old ones without waiting.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const PREFIX = "/service/";

// ---------- ad blocker (beta) ----------
let adblockCache = { t: 0, on: false };
async function adblockOn() {
  if (!self.MirageAdblockShared) return false;
  if (Date.now() - adblockCache.t < 3000) return adblockCache.on;
  let on = false;
  try { const c = await MirageAdblockShared.kvGet("adblock"); on = !!(c && c.enabled); } catch {}
  adblockCache = { t: Date.now(), on };
  return on;
}
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "mirage:adblock-refresh") adblockCache.t = 0;
});
// "/service/<encoded real URL>" -> host name of the real URL ("" if it cannot be read)
function targetHost(url) {
  try {
    const real = decodeURIComponent(new URL(url).pathname.slice(PREFIX.length));
    if (/^https?:\/\//i.test(real)) return new URL(real).hostname;
  } catch {}
  return "";
}
const BLANK_GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
function blockedResponse(destination) {
  const h = { "Cross-Origin-Resource-Policy": "same-origin", "Cache-Control": "no-store" };
  switch (destination) {
    case "script": return new Response("", { headers: { ...h, "Content-Type": "application/javascript" } });
    case "style": return new Response("", { headers: { ...h, "Content-Type": "text/css" } });
    case "image": return new Response(BLANK_GIF, { headers: { ...h, "Content-Type": "image/gif" } });
    case "iframe": case "frame": case "document":
      return new Response("<!doctype html><title></title>", { headers: { ...h, "Content-Type": "text/html; charset=utf-8", "Cross-Origin-Embedder-Policy": "require-corp" } });
    default: return new Response(null, { status: 204, headers: h });
  }
}
async function notifyBlocked(host) {
  try { (await self.clients.matchAll({ type: "window" })).forEach((c) => c.postMessage({ type: "mirage:blocked", host })); } catch {}
}

// Scramjet 1.1 workaround: when the page's controller posts a "loadConfig" message,
// the worker stores that config but never applies it, and loadConfig() returns early
// (crash: "Cannot read properties of undefined (reading 'prefix')").
// So on the first proxied request of each worker start, drop the message-provided
// config and load/apply the one saved in IndexedDB.
let configApplied = false;
async function ensureConfig() {
  if (configApplied) return;
  scramjet.config = undefined;
  await scramjet.loadConfig();
  configApplied = true;
}

function errorPage(e) {
  const msg = "Mirage service worker error\n\n" + ((e && e.stack) || String(e));
  const html = "<!doctype html><meta charset=utf-8><title>Mirage error</title>" +
    "<body style='font:14px monospace;padding:24px;white-space:pre-wrap'></body>";
  return new Response(html.replace("</body>", "") + msg.replace(/&/g, "&amp;").replace(/</g, "&lt;"), {
    status: 502,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}

self.addEventListener("fetch", (event) => {
  const { pathname } = new URL(event.request.url);
  // Only proxied requests touch Scramjet (and its IndexedDB config).
  if (!pathname.startsWith(PREFIX)) return;
  event.respondWith(
    (async () => {
      try {
        if (await adblockOn()) {
          const host = targetHost(event.request.url);
          if (host && MirageAdblockShared.isAdHost(host)) {
            notifyBlocked(host);
            return blockedResponse(event.request.destination);
          }
        }
        await ensureConfig();
        if (scramjet.route(event)) return await scramjet.fetch(event);
        return await fetch(event.request);
      } catch (e) {
        console.error("[mirage-sw]", e);
        return errorPage(e);
      }
    })()
  );
});
