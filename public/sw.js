// Load whichever Scramjet worker bundle this build ships.
let loaded = false;
for (const f of ["/scram/scramjet.all.js", "/scram/scramjet.worker.js"]) {
  try { importScripts(f); loaded = true; break; } catch (e) { console.warn("[mirage] could not load", f); }
}
if (!loaded) throw new Error("No Scramjet worker bundle found under /scram/");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

const PREFIX = "/service/";

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
        await scramjet.loadConfig();
        if (scramjet.route(event)) return await scramjet.fetch(event);
        return await fetch(event.request);
      } catch (e) {
        console.error("[mirage-sw]", e);
        return errorPage(e);
      }
    })()
  );
});
