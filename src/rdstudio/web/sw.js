// Service worker: the dashboard opens at once and can be read offline.
//
// - App files (HTML, scripts, styles, fonts, libraries) come from a cache named
//   after them, so a new rdstudio replaces it; the build fills in SHELL.
// - Data is cached per data version (data/version.json, a hash of the content):
//   opening the dashboard costs one small request for the version, and only a
//   new version fetches data again. Offline, the newest copy is used.
// - The learner record (api/) and anything unknown go to the network as usual.

const SHELL = "__SHELL__";
const SHELL_CACHE = "rd-shell-" + SHELL;
const DATA = "rd-data-"; // one cache per data version
const META = "rd-meta"; // which data versions exist, newest first
const KEEP_VERSIONS = 2;
const VERSION_TTL_MS = 3000; // how long a fetched version is trusted
const TIMEOUT_MS = 4000; // then assume offline and use what is cached

const scope = new URL(self.registration.scope);

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("rd-shell-") && name !== SHELL_CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = url.pathname.slice(scope.pathname.length);
  if (path.startsWith("api/")) return;
  if (path === "data/version.json") event.respondWith(versionResponse(req));
  else if (path.startsWith("data/")) event.respondWith(data(req));
  else if (path.startsWith("reports/") || path === "manifest.webmanifest") event.respondWith(networkFirst(req));
  else event.respondWith(shell(req));
});

// The page sends what it loaded before this worker was in control, so the
// next visit is already served from the cache.
self.addEventListener("message", (event) => {
  const urls = event.data?.warm;
  if (!Array.isArray(urls)) return;
  event.waitUntil(Promise.allSettled(urls.map((u) => {
    const url = new URL(u, scope);
    if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return null;
    const path = url.pathname.slice(scope.pathname.length);
    if (path.startsWith("api/") || path === "data/version.json" || path.startsWith("reports/")) return null;
    return path.startsWith("data/") ? data(new Request(url)) : shell(new Request(url));
  })));
});

function timeout(promise) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS))]);
}

// ------------------------------------------------------------------ shell

async function shell(req) {
  const cache = await caches.open(SHELL_CACHE);
  const page = req.mode === "navigate";
  const key = page ? scope.href : req; // every page load is the one app page
  const hit = await cache.match(key, { ignoreSearch: page });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") cache.put(key, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await timeout(fetch(req));
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}

// ------------------------------------------------------------------ data

let known = null; // { version, at }
let asking = null;

async function versions() {
  const res = await (await caches.open(META)).match("versions");
  return res ? res.json() : [];
}

async function noteVersion(version) {
  const list = [version, ...(await versions()).filter((v) => v !== version)];
  await (await caches.open(META)).put("versions", new Response(JSON.stringify(list.slice(0, KEEP_VERSIONS))));
  for (const old of list.slice(KEEP_VERSIONS)) await caches.delete(DATA + old);
}

// The server's data version, asked at most every few seconds; offline, the
// newest version cached.
async function currentVersion() {
  if (known && Date.now() - known.at < VERSION_TTL_MS) return known.version;
  asking ||= (async () => {
    try {
      const res = await timeout(fetch(scope.href + "data/version.json", { cache: "no-store" }));
      const { version } = await res.clone().json();
      known = { version, at: Date.now() };
      await (await caches.open(META)).put("version.json", res);
      await noteVersion(version);
      return version;
    } catch {
      return (await versions())[0] ?? null;
    } finally {
      asking = null;
    }
  })();
  return asking;
}

// The page polls this to notice changes and to show whether it is live, so it
// always asks the server, and fails when the server cannot be reached.
async function versionResponse() {
  known = null;
  await currentVersion();
  if (!known) return Response.error();
  return (await (await caches.open(META)).match("version.json")) || Response.error();
}

async function data(req) {
  const version = await currentVersion();
  if (version) {
    const cache = await caches.open(DATA + version);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
  }
  try {
    const res = await fetch(req);
    if (res.ok && version) await (await caches.open(DATA + version)).put(req, res.clone());
    return res;
  } catch (err) {
    for (const v of await versions()) { // offline: the newest copy there is
      const hit = await (await caches.open(DATA + v)).match(req, { ignoreSearch: true });
      if (hit) return hit;
    }
    throw err;
  }
}
