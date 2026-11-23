// Load whichever Scramjet worker bundle this build ships.
let loaded = false;
for (const f of ["/scram/scramjet.all.js", "/scram/scramjet.worker.js"]) {
  try { importScripts(f); loaded = true; break; } catch (e) { console.warn("[mirage] could not load", f); }
}
if (!loaded) throw new Error("No Scramjet worker bundle found under /scram/");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

const PREFIX = "/service/";

self.addEventListener("fetch", (event) => {
  const { pathname } = new URL(event.request.url);
  // Only proxied requests touch Scramjet (and its IndexedDB config).
  if (!pathname.startsWith(PREFIX)) return;
  event.respondWith(
    (async () => {
      await scramjet.loadConfig();
      if (scramjet.route(event)) return scramjet.fetch(event);
      return fetch(event.request);
    })()
  );
});
