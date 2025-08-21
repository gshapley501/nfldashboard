const url = require("url");
const http = require("http");
const https = require("https");
const fetch = require("node-fetch"); // v2

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50, keepAliveMsecs: 8000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50, keepAliveMsecs: 8000 });

// in-memory cache per function instance
const CACHE = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ttlFromQuery(req) {
  const h = (req.query && req.query.h) ? parseInt(req.query.h, 10) : NaN;
  if (Number.isFinite(h) && h > 0 && h <= 7*24*3600) return h;
  return null;
}
function cacheGet(key) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (hit.expires && Date.now() < hit.expires) return hit;
  CACHE.delete(key);
  return null;
}
function cacheSet(key, value, ttlSec) {
  if (!ttlSec) return;
  const expires = Date.now() + ttlSec * 1000;
  CACHE.set(key, { ...value, expires });
}

module.exports = async function (context, req) {
  try {
    const q = req.query || {};
    let target = q.u;

    if (!target) {
      const original = req.headers["x-ms-original-url"] || req.originalUrl || "";
      const parsed = url.parse(original);
      const path = parsed.pathname || "";
      const m = path.match(/\/espn(?:-site)?\/(.*)$/);
      if (m && m[1]) target = `https://site.api.espn.com/${m[1]}${parsed.search || ""}`;
    }

    if (!target) { context.res = { status: 400, body: "Missing target (?u=) parameter." }; return; }

    let parsedTarget;
    try {
      parsedTarget = new URL(target);
      if (!/^([a-z]+:)?\/\//i.test(target)) throw new Error("not absolute");
      if (!/\.espn\.com$/i.test(parsedTarget.hostname)) { context.res = { status: 400, body: "Only *.espn.com targets are allowed." }; return; }
    } catch { context.res = { status: 400, body: "Invalid target URL." }; return; }

    const ttl = ttlFromQuery(req);
    const key = target;
    const cached = cacheGet(key);
    if (cached) {
      context.res = { status: cached.status, headers: { ...cached.headers, "x-cache": "HIT" }, body: cached.buf };
      return;
    }

    let resp, lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        resp = await fetch(target, {
          method: "GET",
          headers: {
            "accept": "application/json, text/plain, */*",
            "user-agent": "azure-static-web-app-proxy",
            "accept-language": "en-US,en;q=0.7",
            "referer": "https://www.espn.com/"
          },
          timeout: 15000,
          agent: parsedTarget.protocol === "http:" ? httpAgent : httpsAgent
        });
        if (resp.ok) break;
      } catch (e) {
        lastErr = e;
      }
      await sleep(200 * (attempt + 1));
    }
    if (!resp) { context.res = { status: 502, body: "No response from upstream." }; return; }

    const soft = String((req.query && req.query.soft) || "") === "1";
    let buf = await resp.buffer();
    let contentType = resp.headers.get("content-type") || "application/json";
    let status = resp.status;
    if (soft && !resp.ok) {
      status = 200;
      contentType = "application/json";
      buf = Buffer.from(JSON.stringify({ ok:false, status: resp.status, events: [] }));
    }

    const headers = {
      "content-type": contentType,
      "cache-control": `public, max-age=${(ttl || (soft ? 30 : 30))}`,
      "access-control-allow-origin": "*"
    };

    cacheSet(key, { buf, headers, status }, ttl || (soft ? 30 : 30));
    context.res = { status, headers, body: buf };
  } catch (err) {
    context.log.error("Proxy error", err);
    context.res = { status: 502, body: "Proxy failure." };
  }
};