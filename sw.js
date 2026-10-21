// Offline support: precache the app, then serve cache-first with background refresh.
var CACHE = "kid-strength-09bce9d8-4808e3ae";
var FILES = ["./", "index.html", "app.css?v=09bce9d8", "app.js?v=09bce9d8", "data/plans.js?v=09bce9d8", "connor/", "connor/index.html", "connor/manifest.webmanifest", "icons/connor-180.png", "icons/connor-192.png", "icons/connor-512.png", "colin/", "colin/index.html", "colin/manifest.webmanifest", "icons/colin-180.png", "icons/colin-192.png", "icons/colin-512.png", "adult.css?v=4808e3ae", "adult.js?v=4808e3ae", "data/maureen.js?v=4808e3ae", "maureen/", "maureen/index.html", "maureen/manifest.webmanifest", "icons/maureen-180.png", "icons/maureen-192.png", "icons/maureen-512.png"];
// Precache bypasses the HTTP cache so a new version never stores stale copies.
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES.map(function (u) { return new Request(u, { cache: "reload" }); })); }).then(function () { return self.skipWaiting(); })); });
// On upgrade: drop old caches, take control, and reload open adult pages once so they show the new version right away
// (kids' pages are left alone; they pick up the new cache on their next visit as before).
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    var old = ks.filter(function (k) { return k.indexOf("kid-strength-") === 0 && k !== CACHE; });
    return Promise.all(old.map(function (k) { return caches.delete(k); })).then(function () { return self.clients.claim(); }).then(function () {
      if (!old.length) return;
      return self.clients.matchAll({ type: "window" }).then(function (cs) { cs.forEach(function (c) { if (/\/(maureen)\//.test(new URL(c.url).pathname) && c.navigate) c.navigate(c.url).catch(function () {}); }); });
    });
  }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request; if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: req.mode === "navigate" }).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
