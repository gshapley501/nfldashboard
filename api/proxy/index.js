const url = require("url");
const fetch = require("node-fetch"); // v2

// small sleep helper for retries
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function (context, req) {
  try {
    // Prefer explicit ?u=... (a full URL to ESPN). Fall back to x-ms-original-url (may be post-rewrite) and req.originalUrl as last resort.
    const q = req.query || {};
    let target = q.u;

    if (!target) {
      // try to reconstruct from the original url header IF it contains the espn path (older SWA envs may include pre-rewrite, but not guaranteed)
      const original = req.headers["x-ms-original-url"] || req.originalUrl || "";
      const parsed = url.parse(original);
      const path = parsed.pathname || "";
      // look for /espn/... or /espn-site/...
      const m = path.match(/\/espn(?:-site)?\/(.*)$/);
      if (m && m[1]) {
        target = `https://site.api.espn.com/${m[1]}${parsed.search || ""}`;
      }
    }

    if (!target) {
      context.res = { status: 400, body: "Missing target (?u=) parameter." };
      return;
    }

    // sanity-check
    try {
      const parsed = new URL(target);
      if (!/^([a-z]+:)?\/\//i.test(target)) throw new Error("not absolute");
      if (!/\.espn\.com$/i.test(parsed.hostname)) {
        context.res = { status: 400, body: "Only *.espn.com targets are allowed." };
        return;
      }
    } catch {
      context.res = { status: 400, body: "Invalid target URL." };
      return;
    }

    // Fetch with small retry (ESPN sporadically 5xx). 3 attempts with backoff.
    let resp, lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        resp = await fetch(target, {
          method: "GET",
          headers: {
            "accept": "application/json, text/plain, */*",
            "user-agent": "azure-static-web-app-proxy",
            "accept-language": "en-US,en;q=0.7",
            "referer": "https://www.espn.com/"
          },
          timeout: 15000
        });
        if (resp.ok) break;
        lastErr = new Error(`Upstream status ${resp.status}`);
      } catch (e) {
        lastErr = e;
      }
      await sleep(250 * (attempt + 1));
    }

    if (!resp) {
      context.res = { status: 502, body: "No response from upstream." };
      return;
    }

    const buf = await resp.buffer();
    const contentType = resp.headers.get("content-type") || "application/json";
    context.res = {
      status: resp.status,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=30",
        "access-control-allow-origin": "*"
      },
      body: buf
    };
  } catch (err) {
    context.log.error("Proxy error", err);
    context.res = { status: 502, body: "Proxy failure." };
  }
};
