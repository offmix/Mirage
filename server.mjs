import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createServer } from "node:http";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

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
fastify.get("/scram-files.json", async () => readdirSync(scramDir));

const port = Number(process.env.PORT) || 8080;
fastify.listen({ port, host: "0.0.0.0" }).then(() => console.log(`Mirage listening on :${port}`));
