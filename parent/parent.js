window.STSYNC_CFG={"relay":"https://ntfy.sh","topics":{"connor":"st-co-7deYboDxj6dVXT3Y2ivyUa2k","colin":"st-co-pabG1ZiRYOJqrPejtyBB8SDV","maureen":"st-ma-wDDxQ4EPd0wTayoEx86ooPuj"},"pub":{"kty":"EC","crv":"P-256","x":"5iyhxVqtqpo8-V_OQqrHf2XJ0455XHIJ80Zkz25uSx0","y":"c-EjXC4tylMUdyHRLW6Z3--ZQCnhfwK0dbr0F1W7b6E"},"ackUrl":"https://raw.githubusercontent.com/jrd071983/strength-tracker/sync-data/acks.json","snapUrl":"https://raw.githubusercontent.com/jrd071983/strength-tracker/sync-data/snapshot.json"};
/* Parent view: decrypts and merges everyone's synced logs in this browser. The key comes from the link fragment
   (#k=...), which browsers never send to any server. build.py prepends window.STSYNC_CFG. */
(function () {
  "use strict";
  var CFG = window.STSYNC_CFG, O = window.STSYNC_OVERRIDE || {}, PLANS = window.PLANS || {};
  var relay = (O.relay || CFG.relay).replace(/\/$/, ""), snapUrl = O.snapUrl || CFG.snapUrl;
  var PEOPLE = ["connor", "colin", "maureen"], app = document.getElementById("app"), LSK = "stsync:parentKey";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ub64u(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  var te = new TextEncoder(), td = new TextDecoder();
  function inflate(u8) { var ds = new DecompressionStream("deflate-raw"), w = ds.writable.getWriter(); w.write(u8); w.close(); return new Response(ds.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  var priv = null;
  function decrypt(msg, aad) {
    var p = msg.trim().split("."); if (p[0] !== "s1" && p[0] !== "s1z") return Promise.reject(new Error("format"));
    var epk = ub64u(p[1]);
    return crypto.subtle.importKey("raw", epk, { name: "ECDH", namedCurve: "P-256" }, false, []).then(function (pk) {
      return crypto.subtle.deriveBits({ name: "ECDH", public: pk }, priv, 256);
    }).then(function (bits) { return crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]); })
      .then(function (hk) { return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: epk, info: te.encode("stsync-v1") }, hk, { name: "AES-GCM", length: 256 }, false, ["decrypt"]); })
      .then(function (k) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: ub64u(p[2]), additionalData: te.encode(aad) }, k, ub64u(p[3])); })
      .then(function (pt) { pt = new Uint8Array(pt); return p[0] === "s1z" ? inflate(pt) : pt; })
      .then(function (pt) { return JSON.parse(td.decode(pt)); });
  }
  // same merge as tools/stsync.py
  function isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }
  function fill(n, o) {
    if (isObj(n) && isObj(o)) { var r = {}; Object.keys(n).forEach(function (k) { r[k] = n[k]; }); Object.keys(o).forEach(function (k) { r[k] = k in r ? fill(r[k], o[k]) : o[k]; }); return r; }
    if (Array.isArray(n) && Array.isArray(o)) { var a = n.slice(); for (var i = 0; i < o.length; i++) a[i] = a[i] == null ? o[i] : fill(a[i], o[i]); return a; }
    return n;
  }
  function merge(store, k, u, d, dev) {
    var c = store[k];
    if (!c) store[k] = { u: u, d: d, dev: dev };
    else if (u > c.u) store[k] = { u: u, d: fill(d, c.d), dev: dev };
    else c.d = fill(c.d, d);
  }
  function getJSON(url) { return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }); }
  function load() {
    var data = {}, info = { snap: null, live: 0, errors: [] };
    PEOPLE.forEach(function (p) { data[p] = {}; });
    var snap = getJSON(snapUrl + "?t=" + Date.now()).then(function (t) { var j = JSON.parse(t); return decrypt(j.data, "snapshot"); }).then(function (o) {
      info.snap = o.generatedAt;
      PEOPLE.forEach(function (p) { var rs = (o.people || {})[p] || {}; Object.keys(rs).forEach(function (k) { merge(data[p], k, rs[k].u, rs[k].d, rs[k].dev); }); });
    }).catch(function (e) { info.errors.push("saved copy: " + e.message); });
    var live = PEOPLE.map(function (p) {
      return getJSON(relay + "/" + CFG.topics[p] + "/json?poll=1&since=all").then(function (t) {
        return Promise.all(t.split("\n").filter(Boolean).map(function (l) {
          var m = JSON.parse(l); if (m.event !== "message") return null;
          return decrypt(m.message || "", p).then(function (o) { return o.p === p ? o : null; }).catch(function () { return null; });
        }));
      }).then(function (os) { os.forEach(function (o) { if (!o) return; info.live++; (o.recs || []).forEach(function (r) { merge(data[p], r.k, r.u, r.d, o.dev); }); }); })
        .catch(function (e) { info.errors.push(p + " live: " + e.message); });
    });
    return snap.then(function () { return Promise.all(live); }).then(function () { return { data: data, info: info }; });
  }
  function fmtTime(ms) { return ms ? new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "-"; }
  function sets(ex, e) {
    var out = []; for (var i = 0; i < (ex.sets || 0); i++) { var rp = String((e.r || [])[i] || "").trim(), wt = String((e.w || [])[i] || "").trim(); if (rp || wt) out.push(wt ? wt + (/^[\d.]+$/.test(wt) ? "lb" : "") + " × " + (rp || "?") : rp); }
    if (ex.kind === "cardio") { var b = []; if (String(e.min || "").trim()) b.push(e.min + " min"); if (e.mach) b.push(e.mach); if (String(e.set || "").trim()) b.push(e.set); if (e.eff) b.push("effort " + e.eff + "/10"); return b.join(", "); }
    return out.join(", ");
  }
  function person(p, recs) {
    var P = PLANS[p], name = P ? P.name : p, keys = Object.keys(recs), last = 0, h = "";
    keys.forEach(function (k) { last = Math.max(last, recs[k].u); });
    h += "<section class='person'><h2>" + esc(name) + " <small>" + (keys.length ? "last change " + fmtTime(last) : "nothing synced yet") + "</small></h2>";
    if (recs.start) h += "<div class='muted'>Plan start date: " + esc(recs.start.d) + "</div>";
    if (!P) return h + "</section>";
    for (var w = P.weeks.length; w >= 1; w--) {
      var wk = P.weeks[w - 1], blocks = [];
      wk.sessions.forEach(function (s, i) {
        var d = i + 1, r = recs["w" + w + "d" + d]; if (!r) return; r = r.d || {};
        var hd = "Day " + d + " · " + esc(s.type) + (r.date ? " · " + esc(r.date) : "") + " · " + (r.finished ? "<b class='ok'>finished</b>" : "partly done") + (r.feel ? " · felt " + esc(r.feel) : "");
        var li = s.exercises.map(function (ex, ei) { var e = (r.ex || {})[ei] || {}, got = sets(ex, e); if (!got && !e.done && !e.note) return ""; return "<li>" + esc(ex.name) + ": " + esc(got || "done") + (e.note ? " <i>[" + esc(e.note) + "]</i>" : "") + "</li>"; }).join("");
        if (s.challenge && r.ch && (r.ch.res || r.ch.done)) li += "<li>⭐ " + esc(s.challenge.name) + ": " + esc(r.ch.res || "done") + "</li>";
        blocks.push("<div class='sess'><div class='hd'>" + hd + "</div><ul>" + li + "</ul>" + (r.notes ? "<div class='notes'>Notes: " + esc(r.notes) + "</div>" : "") + "</div>");
      });
      var wn = recs["wn" + w]; if (wn && String(wn.d || "").trim()) blocks.push("<div class='notes'>Week notes: " + esc(wn.d) + "</div>");
      if (blocks.length) h += "<details" + (blocks.length && !h.match(/<details/) ? " open" : "") + "><summary>Week " + w + " <span class='muted'>(" + esc(wk.phase || "") + ")</span></summary>" + blocks.join("") + "</details>";
    }
    h += "<button data-dl='" + p + "'>Download " + esc(name) + "'s backup file</button></section>";
    return h;
  }
  function backupObj(p, recs) {
    var st = { sessions: {}, weekNotes: {} }, last = 0;
    Object.keys(recs).forEach(function (k) { var r = recs[k]; last = Math.max(last, r.u); if (k === "start") st.startDate = r.d; else if (/^wn/.test(k)) st.weekNotes[k.slice(2)] = r.d; else st.sessions[k] = r.d; });
    if (last) st.updatedAt = new Date(last).toISOString();
    var o = { version: 1, exportedAt: new Date().toISOString() };
    if (p === "maureen") { o.app = "fitness-tracker"; o.people = {}; o.people[p] = st; } else { o.app = "kid-strength-tracker"; o.kids = {}; o.kids[p] = st; }
    return o;
  }
  function askKey(msg) {
    app.innerHTML = "<section class='person'><h2>Family log</h2><p>" + esc(msg || "Open this page with your private parent link, or paste the key:") + "</p><input id='k' placeholder='key'><button id='go'>Open</button></section>";
    document.getElementById("go").onclick = function () { start(document.getElementById("k").value.trim()); };
  }
  function start(d) {
    var jwk = { kty: "EC", crv: "P-256", x: CFG.pub.x, y: CFG.pub.y, d: d, ext: true };
    crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]).then(function (k) {
      priv = k; try { localStorage.setItem(LSK, d); } catch (e) {}
      if (location.hash) history.replaceState(null, "", location.pathname);
      app.innerHTML = "<p class='muted'>Loading…</p>"; return load();
    }, function () { askKey("That key didn't work. Paste the key from your private link:"); throw 0; }).then(function (res) {
      var h = "<div class='bar'><span class='muted'>Saved copy: " + fmtTime(res.info.snap) + " · live updates: " + res.info.live + "</span><button id='rf'>Refresh</button><button id='fg'>Forget key on this browser</button></div>";
      if (res.info.errors.length) h += "<div class='muted small'>Notes: " + esc(res.info.errors.join("; ")) + "</div>";
      PEOPLE.forEach(function (p) { h += person(p, res.data[p]); });
      app.innerHTML = h; window.__parent = res;
      document.getElementById("rf").onclick = function () { start(d); };
      document.getElementById("fg").onclick = function () { localStorage.removeItem(LSK); askKey("Key forgotten on this browser."); };
      app.querySelectorAll("[data-dl]").forEach(function (b) { b.onclick = function () {
        var p = b.getAttribute("data-dl"), blob = new Blob([JSON.stringify(backupObj(p, res.data[p]), null, 1)], { type: "application/json" }), a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "strength-backup-" + p + "-synced.json"; document.body.appendChild(a); a.click(); a.remove(); }; });
    }).catch(function (e) { if (e !== 0) app.innerHTML = "<p>Could not load: " + esc(e && e.message) + "</p>"; });
  }
  if (!(window.crypto && crypto.subtle)) { app.innerHTML = "<p>This browser can't decrypt the log (needs HTTPS and a modern browser).</p>"; return; }
  var m = /[#&]k=([A-Za-z0-9_-]+)/.exec(location.hash), saved = null; try { saved = localStorage.getItem(LSK); } catch (e) {}
  if (m) start(m[1]); else if (saved) start(saved); else askKey();
})();
