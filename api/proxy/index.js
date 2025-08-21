const url = require("url");
const fetch = require("node-fetch"); // v2

/**
 * Azure Function that proxies /espn/* and /espn-site/* to ESPN APIs to avoid CORS.
 * It uses the x-ms-original-url header to reconstruct the incoming path and query.
 */
module.exports = async function (context, req) {
  const original = req.headers["x-ms-original-url"] || "";
  const parsed = url.parse(original);
  const path = parsed.pathname || "";

  // Only allow the specific prefixes we expect
  const allowedPrefixes = ["/espn/", "/espn-site/"];
  const match = allowedPrefixes.find((p) => path.startsWith(p));
  if (!match) {
    context.res = { status: 400, body: "Bad request." };
    return;
  }

  // Strip the prefix and forward to ESPN site API
  const upstreamPath = path.replace(/^\/espn(-site)?\//, "/");
  const upstream = `https://site.api.espn.com${upstreamPath}${parsed.search || ""}`;

  try {
    const upstreamRes = await fetch(upstream, {
      method: "GET",
      headers: {
        "accept": "application/json, text/plain, */*",
        "user-agent": "azure-static-web-app-proxy"
      },
      timeout: 15000
    });

    const contentType = upstreamRes.headers.get("content-type") || "application/json";
    const buf = await upstreamRes.buffer();

    context.res = {
      status: upstreamRes.status,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=30", // short caching
        "access-control-allow-origin": "*"     // allow browser usage if called directly
      },
      body: buf
    };
  } catch (err) {
    context.log.error("Proxy error", err);
    context.res = { status: 502, body: "Upstream fetch failed." };
  }
};
