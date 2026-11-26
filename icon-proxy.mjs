// Fetches a remote image for the tab-icon feature, served from our own origin.
// SSRF guards: https only, port 443 only, public IP addresses only (checked at connect time),
// limited redirects, size and time limits, and the body must really be a raster image.
import https from "node:https";
import dns from "node:dns";
import net from "node:net";

function isPublicV4(o) {
  const [a, b, c] = o;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 192 && b === 0) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function expandV6(ip) {
  let s = ip.toLowerCase().split("%")[0];
  const m = s.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const hi = ((+m[1] << 8) | +m[2]).toString(16), lo = ((+m[3] << 8) | +m[4]).toString(16);
    s = s.slice(0, m.index) + hi + ":" + lo;
  }
  const [head, tail] = s.split("::");
  const h = head ? head.split(":") : [];
  const t = tail === undefined ? [] : tail ? tail.split(":") : [];
  const fill = tail === undefined ? 0 : 8 - h.length - t.length;
  return [...h, ...Array(Math.max(fill, 0)).fill("0"), ...t].map((x) => parseInt(x || "0", 16));
}

export function isPublicIp(ip) {
  const v = net.isIP(ip);
  if (v === 4) return isPublicV4(ip.split(".").map(Number));
  if (v !== 6) return false;
  const g = expandV6(ip);
  if (g.length !== 8 || g.some((x) => Number.isNaN(x))) return false;
  if (g.every((x) => x === 0)) return false;                                   // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return false;          // ::1
  if ((g[0] & 0xffc0) === 0xfe80) return false;                                 // link-local
  if ((g[0] & 0xfe00) === 0xfc00) return false;                                 // unique local
  if ((g[0] & 0xff00) === 0xff00) return false;                                 // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false;                         // documentation
  const v4 = (x, y) => [x >> 8, x & 255, y >> 8, y & 255];
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isPublicV4(v4(g[6], g[7])); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return isPublicV4(v4(g[6], g[7]));       // NAT64
  if (g[0] === 0x2002) return isPublicV4(v4(g[1], g[2]));                        // 6to4
  return true;
}

function safeLookup(hostname, options, cb) {
  if (typeof options === "function") { cb = options; options = {}; }
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
    if (err) return cb(err);
    const ok = addrs.filter((a) => isPublicIp(a.address));
    if (!ok.length) return cb(new Error("blocked address"));
    if (options && options.all) return cb(null, ok);
    cb(null, ok[0].address, ok[0].family);
  });
}

export function sniff(b) {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 6 && b.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  if (b.length >= 6 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return "image/x-icon";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return ""; // SVG and everything else are refused on purpose
}

function get(u, o, redirectsLeft) {
  return new Promise((resolve, reject) => {
    if (u.protocol !== "https:") return reject(new Error("https only"));
    if (!o.testing && u.port && u.port !== "443") return reject(new Error("port not allowed"));
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host) && !o.testing && !isPublicIp(host)) return reject(new Error("blocked address"));
    const req = https.request({
      hostname: host, port: o.testing && u.port ? Number(u.port) : 443, path: u.pathname + u.search, method: "GET",
      headers: { "user-agent": "MirageIconFetcher/1.0", accept: "image/*" },
      lookup: o.lookup, rejectUnauthorized: o.rejectUnauthorized, timeout: o.timeoutMs,
    }, (res) => {
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) return reject(new Error("too many redirects"));
        let next;
        try { next = new URL(res.headers.location, u); } catch { return reject(new Error("bad redirect")); }
        return resolve(get(next, o, redirectsLeft - 1));
      }
      if (status !== 200) { res.resume(); return reject(new Error("upstream " + status)); }
      const chunks = []; let size = 0;
      res.on("data", (c) => {
        size += c.length;
        if (size > o.maxBytes) { req.destroy(new Error("too large")); return; }
        chunks.push(c);
      });
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

export async function fetchIcon(input, opts = {}) {
  const u = input instanceof URL ? input : new URL(String(input));
  const o = { lookup: safeLookup, rejectUnauthorized: true, maxBytes: 2_000_000, timeoutMs: 8000, maxRedirects: 3, testing: false, ...opts };
  const body = await get(u, o, o.maxRedirects);
  const type = sniff(body);
  if (!type) throw new Error("not a supported image");
  return { type, body };
}
