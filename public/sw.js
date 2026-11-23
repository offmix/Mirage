// Load whichever Scramjet worker bundle this build ships.
let loaded = false;
for (const f of ["/scram/scramjet.all.js", "/scram/scramjet.worker.js"]) {
  try { importScripts(f); loaded = true; break; } catch (e) { console.warn("[mirage] could not load", f); }
}
if (!loaded) throw new Error("No Scramjet worker bundle found under /scram/");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      await scramjet.loadConfig();
      if (scramjet.route(event)) return scramjet.fetch(event);
      return fetch(event.request);
    })()
  );
});
