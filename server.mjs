import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createServer } from "node:http";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const require = createRequire(import.meta.url);
const root = dirname(fileURLToPath(import.meta.url));
const pkgDist = (name) => join(dirname(require.resolve(`${name}/package.json`)), "dist");

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
