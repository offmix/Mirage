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

fastify.register(fastifyStatic, { root: join(root, "public"), decorateReply: true });
fastify.register(fastifyStatic, { root: pkgDist("@mercuryworkshop/scramjet"), prefix: "/scram/", decorateReply: false });
fastify.register(fastifyStatic, { root: pkgDist("@mercuryworkshop/bare-mux"), prefix: "/baremux/", decorateReply: false });
fastify.register(fastifyStatic, { root: pkgDist("@mercuryworkshop/epoxy-transport"), prefix: "/epoxy/", decorateReply: false });

const port = Number(process.env.PORT) || 8080;
fastify.listen({ port, host: "0.0.0.0" }).then(() => console.log(`Mirage listening on :${port}`));
