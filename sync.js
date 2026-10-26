window.STSYNC_CFG={"relay":"https://ntfy.sh","topics":{"connor":"st-co-7deYboDxj6dVXT3Y2ivyUa2k","colin":"st-co-pabG1ZiRYOJqrPejtyBB8SDV","maureen":"st-ma-wDDxQ4EPd0wTayoEx86ooPuj"},"pub":{"kty":"EC","crv":"P-256","x":"5iyhxVqtqpo8-V_OQqrHf2XJ0455XHIJ80Zkz25uSx0","y":"c-EjXC4tylMUdyHRLW6Z3--ZQCnhfwK0dbr0F1W7b6E"},"ackUrl":"https://raw.githubusercontent.com/jrd071983/strength-tracker/sync-data/acks.json","snapUrl":"https://raw.githubusercontent.com/jrd071983/strength-tracker/sync-data/snapshot.json"};
/* Strength Tracker sync (client). Loaded before app.js / adult.js; build.py prepends window.STSYNC_CFG.
   - Keeps localStorage as the source of truth; works offline exactly as before.
   - On every save (and on first load after this update) it finds records that changed, encrypts them to the
     family PUBLIC key (ECDH P-256 + HKDF + AES-GCM) and posts the ciphertext to this person's relay topic.
     Only the box (and Justin's parent link) hold the private key, so nobody else can read the logs.
   - Records = session keys exactly as stored ("w3d2"), "start" (startDate), "wn<week>" (week notes).
   - Delivery is confirmed via acks.json (message ids only); anything unconfirmed after 3 h is re-sent. */
(function () {
  "use strict";
  var CFG = window.STSYNC_CFG, O = window.STSYNC_OVERRIDE || {};
  if (!CFG || window.SINGLE_FILE || !(window.crypto && crypto.subtle) || !window.fetch || !window.isSecureContext) return;
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !window.STSYNC_OVERRIDE) return;  // local dev/tests never touch the real relay
  var relay = (O.relay || CFG.relay).replace(/\/$/, ""), ackUrl = O.ackUrl || CFG.ackUrl;
  var PID = window.KID || window.PERSON, LS = (window.PERSON ? "fitTracker:v1:" : "kidStrength:v1:") + PID, SK = "stsync:" + PID;
  var topic = CFG.topics[PID]; if (!topic) return;
  var BUDGET = 2700, RESEND_MS = 3 * 3600e3, timer = null, busy = false;
  function ld() { try { var s = JSON.parse(localStorage.getItem(SK) || "null"); if (s && s.dev) return s; } catch (e) {} return null; }
  var st = ld() || { dev: Math.random().toString(36).slice(2, 10), shadow: null, pending: {}, sent: {}, lastOk: null };
  function sv() { try { localStorage.setItem(SK, JSON.stringify(st)); } catch (e) {} }
  function enc(s) { return new TextEncoder().encode(s); }
  function b64u(buf) { var b = new Uint8Array(buf), s = ""; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + "." + s.length; }
  function records() {
    var o; try { o = JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) { o = {}; }
    var r = {}, ss = o.sessions || {}, wn = o.weekNotes || {};
    Object.keys(ss).forEach(function (k) { r[k] = ss[k]; });
    Object.keys(wn).forEach(function (w) { r["wn" + w] = wn[w]; });
    if (o.startDate) r.start = o.startDate;
    return { recs: r, at: Date.parse(o.updatedAt || "") || Date.now() };
  }
  // Called by the app after every save / restore. Marks changed records as pending (never deletes remotely).
  function touch() {
    var x = records(), first = !st.shadow, now = Date.now(); st.shadow = st.shadow || {};
    Object.keys(x.recs).forEach(function (k) {
      var h = hash(JSON.stringify(x.recs[k]));
      if (st.shadow[k] !== h) { st.shadow[k] = h; st.pending[k] = first ? x.at : now; }
    });
    sv(); schedule(first ? 500 : 3000);
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(flush, ms); }
  var pubKey = null;
  function key() { return pubKey ? Promise.resolve(pubKey) : crypto.subtle.importKey("jwk", CFG.pub, { name: "ECDH", namedCurve: "P-256" }, false, []).then(function (k) { return (pubKey = k); }); }
  function deflate(bytes) {
    if (!window.CompressionStream) return Promise.resolve(null);
    try { var cs = new CompressionStream("deflate-raw"), w = cs.writable.getWriter(); w.write(bytes); w.close(); return new Response(cs.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); }); } catch (e) { return Promise.resolve(null); }
  }
  function encrypt(obj) {
    var pt = enc(JSON.stringify(obj)), tag = "s1";
    return (pt.length > 2400 ? deflate(pt) : Promise.resolve(null)).then(function (z) {
      if (z) { pt = z; tag = "s1z"; }
      return Promise.all([key(), crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])]);
    }).then(function (a) {
      var eph = a[1];
      return Promise.all([crypto.subtle.deriveBits({ name: "ECDH", public: a[0] }, eph.privateKey, 256), crypto.subtle.exportKey("raw", eph.publicKey)]);
    }).then(function (a) {
      var epk = new Uint8Array(a[1]), iv = crypto.getRandomValues(new Uint8Array(12));
      return crypto.subtle.importKey("raw", a[0], "HKDF", false, ["deriveKey"]).then(function (hk) {
        return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: epk, info: enc("stsync-v1") }, hk, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
      }).then(function (k) { return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv, additionalData: enc(PID) }, k, pt); })
        .then(function (ct) { return [tag, b64u(epk), b64u(iv), b64u(ct)].join("."); });
    });
  }
  function batches() {
    var x = records().recs, out = [], cur = [], size = 0;
    Object.keys(st.pending).forEach(function (k) {
      if (!(k in x)) { delete st.pending[k]; return; }
      var r = { k: k, u: st.pending[k], d: x[k] }, n = JSON.stringify(r).length + 1;
      if (cur.length && size + n > BUDGET) { out.push(cur); cur = []; size = 0; }
      cur.push(r); size += n;
    });
    if (cur.length) out.push(cur);
    return out;
  }
  function flush() {
    if (busy) return;
    if (navigator.onLine === false) { schedule(30000); return; }
    var bs = batches(); if (!bs.length) return;
    busy = true;
    var chain = Promise.resolve();
    bs.forEach(function (recs) {
      chain = chain.then(function () {
        return encrypt({ v: 1, p: PID, dev: st.dev, recs: recs }).then(function (msg) {
          return fetch(relay + "/" + topic, { method: "POST", body: msg, cache: "no-store" });
        }).then(function (res) {
          if (!res.ok) throw new Error("relay " + res.status);
          return res.json();
        }).then(function (j) {
          var now = Date.now();
          recs.forEach(function (r) {
            st.sent[r.k] = { u: r.u, mid: j.id, at: now };
            if (st.pending[r.k] === r.u) delete st.pending[r.k];
          });
          st.lastOk = now; sv();
        });
      });
    });
    chain.catch(function () { schedule(60000); }).then(function () { busy = false; if (Object.keys(st.pending).length) schedule(5000); });
  }
  // Re-send anything the box has not confirmed within RESEND_MS (covers relay expiry or a missed pull).
  function checkAcks() {
    if (!ackUrl) return;
    fetch(ackUrl + (ackUrl.indexOf("?") < 0 ? "?" : "&") + "t=" + Math.floor(Date.now() / 600000), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.acks) return;
      var got = {}; (j.acks[PID] || []).forEach(function (id) { got[id] = 1; });
      var now = Date.now(), n = 0;
      Object.keys(st.sent).forEach(function (k) {
        var s = st.sent[k];
        if (got[s.mid]) { delete st.sent[k]; return; }
        if (now - s.at > RESEND_MS && !(k in st.pending)) { st.pending[k] = s.u; n++; }
      });
      sv(); if (n) schedule(1000);
    }).catch(function () {});
  }
  window.STSync = {
    touch: touch,
    status: function () { var n = Object.keys(st.pending).length; return st.lastOk ? (n ? n + " change(s) waiting to send" : "Sent to Coach ✓ " + new Date(st.lastOk).toLocaleString()) : (n ? "Will send to Coach when online" : ""); },
    _state: function () { return st; }, _flush: flush
  };
  window.addEventListener("online", function () { schedule(1000); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") { touch(); checkAcks(); } });
  setTimeout(function () { touch(); checkAcks(); }, 300);   // first load after the update uploads everything already on this phone
})();
