import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createServer } from "node:http";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import { PassThrough } from "node:stream";
import { fetchIcon } from "./icon-proxy.mjs";
import { validateRequest, buildMessages, streamCompletion, friendlyError, DEFAULT_MODEL, SSE_OPEN, SSE_PING, sseData } from "./assistant-proxy.mjs";

const root = dirname(fileURLToPath(import.meta.url));
// Locate package files directly in node_modules (avoids "exports" restrictions on package.json).
function pkgDist(name) {
  const base = join(root, "node_modules", name);
  for (const sub of ["dist", "."]) {
    const p = join(base, sub);
    if (existsSync(join(base, sub)) && (sub === "." || readdirSync(p).length)) {
      console.log(`[mirage] ${name} -> ${p}`);
      return p;
    }
  }
  throw new Error(`Package not found: ${name}. Did npm/yarn install succeed?`);
}

const publicDir = join(root, "public");
console.log(`[mirage] public dir: ${publicDir}`);
console.log(`[mirage] public files: ${existsSync(publicDir) ? readdirSync(publicDir).join(", ") : "(missing)"}`);
if (!existsSync(join(publicDir, "index.html"))) {
  console.error("[mirage] public/index.html not found. Make sure the public/ folder (index.html, app.js, style.css, sw.js) is committed to the repo.");
  process.exit(1);
}

const fastify = Fastify({
  trustProxy: true, // behind Render's proxy: use the real client IP (rate limits)
  serverFactory: (handler) =>
    createServer((req, res) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      handler(req, res);
    }).on("upgrade", (req, socket, head) => {
      if (req.url.endsWith("/wisp/")) wisp.routeRequest(req, socket, head);
      else socket.end();
    }),
});

fastify.register(fastifyStatic, { root: publicDir, index: "index.html", decorateReply: true });
fastify.register(fastifyStatic, { root: pkgDist("@mercuryworkshop/scramjet"), prefix: "/scram/", decorateReply: false });
fastify.register(fastifyStatic, { root: pkgDist("@mercuryworkshop/bare-mux"), prefix: "/baremux/", decorateReply: false });
fastify.register(fastifyStatic, { root: pkgDist("@mercuryworkshop/libcurl-transport"), prefix: "/libcurl/", decorateReply: false });

// Supabase client library (self-hosted so the COEP header does not block a CDN script).
fastify.register(fastifyStatic, { root: join(pkgDist("@supabase/supabase-js"), "umd"), prefix: "/supabase/", decorateReply: false });

// Public Supabase settings, taken from environment variables (the anon key is safe to expose; RLS protects data).
// ---------- Mirage assistant (Cloudflare Workers AI) ----------
// Env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (Workers AI permission); optional CF_AI_MODEL, ASSISTANT_RATE_PER_HOUR.
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const CF_MODEL = process.env.CF_AI_MODEL || DEFAULT_MODEL;
const ASSISTANT_READY = !!(CF_ACCOUNT && CF_TOKEN);
const ASSISTANT_RATE = Number(process.env.ASSISTANT_RATE_PER_HOUR) || 40;
const assistantHits = new Map(); // ip -> { n, t }

// Browser-side key: new "publishable" key, or the legacy anon key (both are safe to expose; RLS protects data).
function publicKey() {
  if (process.env.SUPABASE_PUBLISHABLE_KEY) return process.env.SUPABASE_PUBLISHABLE_KEY;
  try {
    const keys = JSON.parse(process.env.SUPABASE_PUBLISHABLE_KEYS || "{}");
    if (keys.default) return keys.default;
    const first = Object.values(keys)[0];
    if (first) return first;
  } catch {}
  return process.env.SUPABASE_ANON_KEY || "";
}

fastify.get("/config.js", async (req, reply) => {
  reply.header("content-type", "application/javascript; charset=utf-8").header("cache-control", "no-store");
  return "window.MIRAGE_CONFIG=" + JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: publicKey(),
    assistant: ASSISTANT_READY,   // only whether it is configured; no model or key
  }) + ";";
});

// Server-side user verification with @supabase/server.
// GET /api/me with "Authorization: Bearer <access token>" returns the verified user's profile.
// Reads SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY(S), SUPABASE_SECRET_KEY(S) and SUPABASE_JWKS from the environment.
let meHandler = null;
try {
  const { withSupabase } = await import("@supabase/server");
  meHandler = withSupabase({ auth: "user", cors: false }, async (req, ctx) => {
    const sub = ctx.userClaims && ctx.userClaims.sub;
    const { data } = await ctx.supabase.from("profiles").select("id,username,avatar_url").eq("id", sub).maybeSingle();
    return Response.json({ id: sub, profile: data });
  });
} catch (e) {
  console.warn("[mirage] @supabase/server unavailable, /api/me disabled:", e.message);
}

fastify.get("/api/me", async (req, reply) => {
  if (!meHandler) return reply.code(503).send({ error: "server verification is not available" });
  const webReq = new Request(`http://${req.headers.host || "localhost"}${req.url}`, { headers: req.headers });
  const res = await meHandler(webReq);
  reply.code(res.status);
  res.headers.forEach((v, k) => reply.header(k, v));
  return reply.send(Buffer.from(await res.arrayBuffer()));
});

// Lets the client detect which Scramjet build files exist.
const scramDir = pkgDist("@mercuryworkshop/scramjet");
console.log(`[mirage] scramjet files: ${readdirSync(scramDir).join(", ")}`);
fastify.post("/api/assistant", async (req, reply) => {
  if (!ASSISTANT_READY) return reply.code(503).send({ error: "アシスタントはこのサーバーで設定されていません。" });
  const now = Date.now();
  const h = assistantHits.get(req.ip);
  if (!h || now - h.t > 3_600_000) assistantHits.set(req.ip, { n: 1, t: now });
  else if (++h.n > ASSISTANT_RATE) return reply.code(429).send({ error: "利用回数の上限に達しました。しばらくしてから、もう一度お試しください。" });

  const checked = validateRequest(req.body);
  if (checked.error) return reply.code(400).send({ error: checked.error });

  const out = new PassThrough();
  const ac = new AbortController();
  // Abort the AI call only if the browser goes away before the answer is finished.
  // (req 'close' fires as soon as the request body has been read, so it must not be used for this.)
  reply.raw.on("close", () => { if (!reply.raw.writableFinished) ac.abort(); });
  out.write(SSE_OPEN);                                          // flushes the headers right away
  const beat = setInterval(() => out.write(SSE_PING), 10_000);  // keeps proxies from closing an idle connection while the model thinks
  (async () => {
    try {
      await streamCompletion({ accountId: CF_ACCOUNT, token: CF_TOKEN, model: CF_MODEL, messages: buildMessages(checked.value), signal: ac.signal },
        (text) => out.write(sseData(text)));
    } catch (e) {
      if (e && e.name !== "AbortError") console.error("[assistant]", e.status || "", e.message, e.detail || "", e.stats ? JSON.stringify(e.stats) : "");
      const msg = friendlyError(e);
      if (msg) out.write(sseData("\n\n" + msg));
    } finally { clearInterval(beat); out.end(); }
  })();
  return reply.header("content-type", "text/event-stream; charset=utf-8").header("cache-control", "no-cache, no-transform")
    .header("x-accel-buffering", "no").send(out);
});

// Same-origin copy of a remote image, used for the tab icon and the icon picker.
// Serving it from this origin avoids cross-origin / COEP / wrong-MIME problems, and the server
// checks that the file really is a raster image (see icon-proxy.mjs for the SSRF guards).
const iconCache = new Map();   // url -> { type, body, t }
const iconHits = new Map();    // ip -> { n, t }  (simple rate limit)
fastify.get("/api/icon", async (req, reply) => {
  const now = Date.now();
  const h = iconHits.get(req.ip);
  if (!h || now - h.t > 60_000) iconHits.set(req.ip, { n: 1, t: now });
  else if (++h.n > 60) return reply.code(429).send({ error: "too many requests" });

  let u;
  try { u = new URL(String((req.query && req.query.u) || "")); } catch { return reply.code(400).send({ error: "bad url" }); }
  const key = u.toString();
  let hit = iconCache.get(key);
  if (!hit || now - hit.t > 86_400_000) {
    try {
      const { type, body } = await fetchIcon(u);
      hit = { type, body, t: now };
      iconCache.set(key, hit);
      if (iconCache.size > 200) iconCache.delete(iconCache.keys().next().value);
    } catch (e) {
      return reply.code(502).send({ error: String((e && e.message) || e) });
    }
  }
  reply.header("content-type", hit.type).header("cache-control", "public, max-age=86400")
    .header("x-content-type-options", "nosniff").header("cross-origin-resource-policy", "same-origin");
  return reply.send(hit.body);
});

fastify.get("/scram-files.json", async () => readdirSync(scramDir));

const port = Number(process.env.PORT) || 8080;
fastify.listen({ port, host: "0.0.0.0" }).then(() => console.log(`Mirage listening on :${port}`));
