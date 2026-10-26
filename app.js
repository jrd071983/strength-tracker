/* Kid Strength Tracker - vanilla JS, data saved in localStorage per kid (sync.js sends an encrypted copy to Coach). */
(function () {
  "use strict";
  var KID = window.KID || "connor";
  var P = (window.PLANS || {})[KID];
  var app = document.getElementById("app");
  if (!P) { app.innerHTML = "<p style='padding:20px'>Plan data missing.</p>"; return; }
  document.body.classList.add("theme-" + P.theme);
  var KEY = "kidStrength:v1:" + KID;
  var STICKERS = ["🦖","🚀","⚡","🦈","🐯","🔥","🏆","🦅","🐉","⭐","🦍","🏈","⚽","🥇","🦁","🐺","🛡️","💎","🌋","🐙","🦄","🎯","🏀","🦊","🐻","🛹","🥷","🤖","🐲","🌟","🦬","⚾","🎸","🏅","👑","🎉"];
  var FEEL = [["EASY","😎"],["OK","🙂"],["HARD","😅"]];
  var S = load();
  var viewWeek = null;

  function load() { try { var s = JSON.parse(localStorage.getItem(KEY) || "{}"); if (s && typeof s === "object") { s.sessions = s.sessions || {}; s.weekNotes = s.weekNotes || {}; return s; } } catch (e) {} return { sessions: {}, weekNotes: {} }; }
  var saveTimer;
  function save(quiet) {
    S.updatedAt = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(S)); localStorage.setItem("kidStrength:lastKid", KID); } catch (e) { toast("Could not save! Storage full?"); }
    if (window.STSync) STSync.touch();
    if (!quiet) { var el = document.getElementById("saved"); if (el) { el.textContent = "✓ Saved"; clearTimeout(saveTimer); saveTimer = setTimeout(function () { el.textContent = ""; }, 1200); } }
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function sk(w, d) { return "w" + w + "d" + d; }
  function rec(w, d, create) { var k = sk(w, d); if (!S.sessions[k] && create) S.sessions[k] = { warm: {}, ex: {}, ch: {}, feel: "", notes: "" }; return S.sessions[k]; }
  function week(w) { return P.weeks[w - 1]; }
  function sess(w, d) { return week(w).sessions[d - 1]; }
  function todayStr() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function parseDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function fmtShort(d) { return (d.getMonth() + 1) + "/" + d.getDate(); }
  function currentWeek() {
    var st = parseDate(S.startDate);
    if (st) { var n = new Date(); n.setHours(0, 0, 0, 0); var w = Math.floor((n - st) / 864e5 / 7) + 1; return Math.min(12, Math.max(1, w)); }
    for (var w2 = 1; w2 <= 12; w2++) for (var d = 1; d <= 3; d++) { var r = rec(w2, d); if (!r || !r.finished) return w2; }
    return 12;
  }
  function weekDates(w) { var st = parseDate(S.startDate); if (!st) return ""; var a = new Date(st); a.setDate(a.getDate() + (w - 1) * 7); var b = new Date(a); b.setDate(b.getDate() + 6); return fmtShort(a) + " - " + fmtShort(b); }
  function isChallengeDone(r) { return !!(r && r.ch && (r.ch.done || (r.ch.res || "").trim())); }
  function stats() {
    var done = 0, stk = [];
    for (var w = 1; w <= 12; w++) for (var d = 1; d <= 3; d++) {
      var r = rec(w, d); if (!r) continue;
      if (r.finished) { done++; stk.push(STICKERS[(sess(w, d).num - 1) % STICKERS.length]); }
      if (sess(w, d).challenge && isChallengeDone(r)) stk.push("⭐");
    }
    return { done: done, stickers: stk };
  }
  function phaseBadges(wk) {
    var h = "<span class='badge'>" + esc(wk.phase.split(" - ")[0]) + "</span>";
    if (wk.deload) h += "<span class='badge deload'>😌 Easy week</span>";
    if (wk.record) h += "<span class='badge record'>🏆 Record week</span>";
    if (wk.baseline) h += "<span class='badge base'>📏 Baseline week</span>";
    return h;
  }
  function typeEmoji(t) { return t === "Lower" ? "🦵" : "💪"; }
  function noWeight(ex) { return isTime(ex.reps) || /plank|dead bug|hang|push-up/i.test(ex.name); }
  function isTime(reps) { return /sec|\d\s*s\b|hold/i.test(reps); }
  function shortName(n) { return String(n).replace(/\s*\([^)]*\)/g, "").replace(/\s*-\s*SPOTTER/i, "").replace(/^FUN CHALLENGE(\s*\/\s*)?:?\s*/i, "").trim(); }
  function header(title, sub, back) {
    return "<header class='top'><div class='wrap'><div class='row'>" +
      (back ? "<a class='iconbtn' href='" + back + "' aria-label='Back'>⬅</a>" : "") +
      "<h1>" + title + "</h1>" +
      (back ? "" : "<a class='iconbtn' href='#/rules' aria-label='Rules and safety'>🛟</a>") +
      "</div>" + (sub ? "<div class='sub'>" + sub + "</div>" : "") + "</div></header>";
  }

  /* ---------------- HOME ---------------- */
  function home(w) {
    w = w || viewWeek || currentWeek(); viewWeek = w;
    var wk = week(w), st = stats(), cw = currentWeek();
    var h = header("Hi " + esc(P.name) + "! " + (P.kid === "colin" ? "🏋️" : "💪"), "12-week strength plan • " + st.done + " of 36 workouts done");
    h += "<main class='wrap'>";
    h += "<div class='card'><div class='weekpick'><button data-act='wk' data-w='" + (w - 1) + "' " + (w <= 1 ? "disabled" : "") + " aria-label='Previous week'>‹</button>" +
      "<div class='lbl'><span class='muted'>WEEK</span><b id='weeknum'>" + w + " <span class='muted' style='font-size:18px'>of 12</span></b>" +
      (S.startDate ? "<span class='muted small'>" + weekDates(w) + (w === cw ? " • this week" : "") + "</span>" : "") + "</div>" +
      "<button data-act='wk' data-w='" + (w + 1) + "' " + (w >= 12 ? "disabled" : "") + " aria-label='Next week'>›</button></div>" +
      "<div style='text-align:center;margin-top:8px'>" + phaseBadges(wk) + "</div>" +
      (w !== cw ? "<button class='btn ghost' data-act='wk' data-w='" + cw + "' style='min-height:48px;font-size:17px'>Jump to " + (S.startDate ? "this" : "next") + " week (" + cw + ")</button>" : "") + "</div>";
    wk.sessions.forEach(function (s) {
      var r = rec(w, s.dayIndex), started = r && (r.date || Object.keys(r.ex || {}).length);
      h += "<a class='sess " + (r && r.finished ? "done" : "") + "' href='#/s/" + w + "/" + s.dayIndex + "' style='text-decoration:none;color:inherit;display:flex'>" +
        "<span class='emo'>" + typeEmoji(s.type) + "</span><span class='t'><b>Day " + s.dayIndex + " · <span class='type-" + s.type + "'>" + s.type.toUpperCase() + "</span></b>" +
        "<span class='muted'>Workout #" + s.num + " • try " + esc(s.day) + (r && r.finished ? " • done!" : started ? " • started" : "") + "</span></span>" +
        "<span class='stk'>" + (r && r.finished ? STICKERS[(s.num - 1) % STICKERS.length] : "▶️") + "</span></a>";
    });
    h += "<a class='btn alt big' href='#/send/" + w + "'>📨 Send week " + w + " to " + esc(P.coachName) + "</a>";
    h += "<div class='card'><h2>🏅 My stickers: " + st.stickers.length + "</h2><div class='bar'><i style='width:" + Math.round(st.done / 36 * 100) + "%'></i></div>" +
      "<div class='muted'>" + st.done + " / 36 workouts</div><div class='stickers' id='stickers'>" + (st.stickers.join("") || "<span class='muted'>Finish a workout to earn your first sticker!</span>") + "</div></div>";
    h += "<div class='card'><h2>📅 Start date</h2><div class='muted small'>The first day of week 1. The app then opens on the right week automatically.</div>" +
      "<input class='txt' type='date' id='startDate' value='" + esc(S.startDate || "") + "' style='margin-top:8px'></div>";
    h += "<div class='grid2'><a class='btn ghost' href='#/rules'>🛟 Rules</a><a class='btn ghost' href='#/backup'>💾 Backup</a></div>";
    if (!window.SINGLE_FILE) h += "<a class='btn ghost' href='../index.html?pick=1' style='min-height:48px;font-size:16px'>👥 Switch kid</a>";
    h += "<p class='muted small' style='text-align:center'>Adult supervision every session. Good form beats more reps.</p></main>";
    return h;
  }

  /* ---------------- SESSION ---------------- */
  function warmItems(s) { return P.warmup.filter(function (i) { var m = /^(LOWER|UPPER) day/i.exec(i.label); return !m || m[1].toLowerCase() === s.type.toLowerCase(); }); }
  function setBoxes(ei, ex, r) {
    var e = (r && r.ex && r.ex[ei]) || {}, reps = e.r || [], wts = e.w || [], unit = isTime(ex.reps) ? "sec" : "reps", h = "<div class='sets'>";
    for (var i = 0; i < ex.sets; i++) {
      var wt = "<input class='wt' data-f='w' data-e='" + ei + "' data-i='" + i + "' inputmode='decimal' autocomplete='off' placeholder='" + (P.weightsFirst ? (ex.weight != null ? ex.weight : "lb") : "lb?") + "' value='" + esc(wts[i] || "") + "' aria-label='Set " + (i + 1) + " weight in pounds'>";
      var rp = "<input data-f='r' data-e='" + ei + "' data-i='" + i + "' inputmode='numeric' autocomplete='off' placeholder='" + unit + "' value='" + esc(reps[i] || "") + "' aria-label='Set " + (i + 1) + " " + unit + "'>";
      if (noWeight(ex)) { h += "<div class='set'><label>SET " + (i + 1) + "</label>" + rp + "</div>"; continue; }
      h += "<div class='set'><label>SET " + (i + 1) + "</label>" + (P.weightsFirst ? "<label>lb</label>" + wt + "<label>" + unit + "</label>" + rp : rp + wt) + "</div>";
    }
    return h + "</div>";
  }
  function session(w, d) {
    var s = sess(w, d), wk = week(w), r = rec(w, d) || {};
    var h = header("Day " + d + " · " + s.type.toUpperCase() + " " + typeEmoji(s.type), "Week " + w + " • Workout #" + s.num + " • try " + esc(s.day), "#/week/" + w);
    h += "<main class='wrap'><div style='margin-top:-4px'>" + phaseBadges(wk) + "</div>";
    if (s.note) h += "<div class='sessnote'>📝 " + esc(s.note) + "</div>";
    // warm-up
    h += "<div class='card'><h2>🔥 Warm-up</h2>";
    warmItems(s).forEach(function (it, i) {
      h += "<label class='check'><input type='checkbox' data-f='warm' data-i='" + i + "' " + (r.warm && r.warm[i] ? "checked" : "") + "><span><b>" + esc(it.label) + "</b><br><span class='small'>" + esc(it.text) + "</span></span></label>";
    });
    h += "</div>";
    s.exercises.forEach(function (ex, ei) {
      var e = (r.ex && r.ex[ei]) || {}, g = ex.guide != null ? P.guide[ex.guide] : null;
      h += "<section class='card ex " + (e.done ? "isdone" : "") + "' id='ex" + ei + "'><div class='head'><span class='num'>" + (ei + 1) + "</span><div style='flex:1'><h3>" + esc(ex.name) + "</h3>" +
        "<div class='target'>" + ex.sets + " × " + esc(ex.reps) + "</div><div class='small'><b>" + (P.weightsFirst ? "🏋️ " : "🎯 ") + esc(ex.target) + "</b></div></div></div>" +
        "<details class='howto'><summary>How to do it</summary><div class='body'>" + (g ? "<p style='margin-top:0'>" + esc(g.how) + "</p>" : "") + "<p class='muted' style='margin-bottom:0'><b>Tip:</b> " + esc(ex.cue) + "</p></div></details>" +
        setBoxes(ei, ex, r) +
        "<input class='txt' data-f='note' data-e='" + ei + "' placeholder='Notes (bar height, version, how it felt…)' value='" + esc(e.note || "") + "' style='margin-top:10px'>" +
        "<label class='donebox'><input type='checkbox' data-f='done' data-e='" + ei + "' " + (e.done ? "checked" : "") + "> Done! ✅</label></section>";
    });
    if (s.challenge) {
      var c = s.challenge, ch = r.ch || {}, g2 = c.guide != null ? P.guide[c.guide] : null;
      h += "<section class='card challenge'><h2>⭐ " + (c.name.indexOf("FUN") === 0 ? "Fun challenge" : esc(c.name.split(":")[0])) + "</h2><h3>" + esc(shortName(c.name.replace(/^(RECORD|CELEBRATION):\s*/, ""))) + "</h3>" +
        "<div class='small' style='margin-top:6px'><b>🎯 " + esc(c.reps) + " • " + esc(c.target) + "</b></div><p class='small muted'>" + esc(c.cue) + "</p>" +
        (g2 && /Dip-handle/.test(g2.name) ? "<details class='howto'><summary>How to do it</summary><div class='body'>" + esc(g2.how) + "</div></details>" : "") +
        "<input class='txt' data-f='chres' placeholder='My result (reps, seconds, who won…)' value='" + esc(ch.res || "") + "'>" +
        "<label class='donebox'><input type='checkbox' data-f='chdone' " + (ch.done ? "checked" : "") + "> I did it! ⭐</label></section>";
    }
    if (P.cooldown.length) h += "<div class='card'><h2>🧊 Cool-down</h2>" + P.cooldown.map(function (it) { return "<label class='check'><input type='checkbox' data-f='cool' " + (r.cool ? "checked" : "") + "><span><b>" + esc(it.label) + "</b><br><span class='small'>" + esc(it.text) + "</span></span></label>"; }).join("") + "</div>";
    h += "<div class='card'><h2>How did it feel?</h2><div class='feel'>" + FEEL.map(function (f) { return "<button data-act='feel' data-v='" + f[0] + "' class='" + (r.feel === f[0] ? "on" : "") + "'><span>" + f[1] + "</span>" + f[0] + "</button>"; }).join("") + "</div>" +
      "<h2 style='margin-top:16px'>Notes</h2><textarea data-f='notes' placeholder='Anything fun, too easy, too hard, or anything that hurt?'>" + esc(r.notes || "") + "</textarea></div>";
    h += "<div class='saved' id='saved'></div><button class='btn green big' data-act='finish'>" + (r.finished ? "🎉 Finished! (tap for confetti)" : "🏁 Finish workout") + "</button>";
    var nx = d < 3 ? [w, d + 1] : (w < 12 ? [w + 1, 1] : null);
    h += "<div class='grid2'><a class='btn ghost' href='#/week/" + w + "'>🏠 Home</a>" + (nx ? "<a class='btn ghost' href='#/s/" + nx[0] + "/" + nx[1] + "'>Next ▶</a>" : "<a class='btn ghost' href='#/send/12'>📨 Send</a>") + "</div></main>";
    return h;
  }

  /* ---------------- SUMMARY / SEND ---------------- */
  function fmtSets(ex, e) {
    var out = [];
    for (var i = 0; i < ex.sets; i++) {
      var rp = ((e.r || [])[i] || "").trim(), wt = ((e.w || [])[i] || "").trim();
      if (!rp && !wt) continue;
      out.push(wt ? wt + "lb x " + (rp || "?") : rp);
    }
    return out.join(", ");
  }
  function sessionBlock(w, d) {
    var s = sess(w, d), r = rec(w, d), L = [];
    var head = "S" + s.num + " Day " + d + " " + s.type.toUpperCase();
    if (!r || (!r.finished && !r.date && !Object.keys(r.ex || {}).length && !(r.notes || "").trim())) return head + ": not done yet";
    var bits = [head];
    if (r.date) bits.push(fmtShort(parseDate(r.date)));
    bits.push(r.finished ? "FINISHED" : "partly done");
    if (r.feel) bits.push("felt " + r.feel);
    L.push(bits.join(" | "));
    s.exercises.forEach(function (ex, ei) {
      var e = (r.ex || {})[ei] || {}, sets = fmtSets(ex, e);
      var line = "- " + shortName(ex.name) + " (" + ex.sets + "x" + ex.reps + (P.weightsFirst && ex.weight != null ? " @" + ex.weight : "") + "): " + (sets || (e.done ? "done" : "-"));
      if ((e.note || "").trim()) line += " [" + e.note.trim() + "]";
      L.push(line);
    });
    if (s.challenge) { var ch = r.ch || {}; L.push("- Challenge " + shortName(s.challenge.name.replace(/^(RECORD|CELEBRATION):\s*/, "")) + ": " + ((ch.res || "").trim() || (ch.done ? "done" : "-"))); }
    if ((r.notes || "").trim()) L.push("  Notes: " + r.notes.trim());
    return L.join("\n");
  }
  function weekHeader(w, part, of) {
    var wk = week(w), n = 0; for (var d = 1; d <= 3; d++) { var r = rec(w, d); if (r && r.finished) n++; }
    return P.name + " - Week " + w + " of 12 (" + wk.phase + ")" + (of > 1 ? " - part " + part + "/" + of : "") + "\n" +
      (S.startDate ? "Dates: " + weekDates(w) + "\n" : "") + "Workouts finished: " + n + "/3";
  }
  function weekParts(w) {
    var LIMIT = 1800, blocks = [];
    for (var d = 1; d <= 3; d++) blocks.push(sessionBlock(w, d));
    var wn = (S.weekNotes[w] || "").trim(); if (wn) blocks.push("Week notes: " + wn);
    var foot = "(sent from " + P.name + "'s tracker app)";
    var full = weekHeader(w, 1, 1) + "\n\n" + blocks.join("\n\n") + "\n\n" + foot;
    if (full.length <= LIMIT) return [full];
    var parts = [], cur = [];
    var room = LIMIT - 120;
    blocks.forEach(function (b) {
      while (b.length > room) { // very long single block: hard split
        if (cur.length) { parts.push(cur); cur = []; }
        parts.push([b.slice(0, room)]); b = "(cont.) " + b.slice(room);
      }
      if ((cur.join("\n\n") + "\n\n" + b).length > room && cur.length) { parts.push(cur); cur = []; }
      cur.push(b);
    });
    if (cur.length) parts.push(cur);
    return parts.map(function (p, i) { return weekHeader(w, i + 1, parts.length) + "\n\n" + p.join("\n\n") + (i === parts.length - 1 ? "\n\n" + foot : ""); });
  }
  function mailto(w, body, i, n) {
    var subj = P.name + " Week " + w + " results" + (n > 1 ? " (part " + (i + 1) + " of " + n + ")" : "");
    return "mailto:" + P.coachEmail + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
  }
  function send(w) {
    var parts = weekParts(w), all = parts.join("\n\n");
    var h = header("📨 Send week " + w, "Goes to " + esc(P.coachName) + ": " + esc(P.coachEmail), "#/week/" + w);
    h += "<main class='wrap'><div class='card'><div class='weekpick'><a class='iconbtn' style='background:var(--soft);color:var(--ink)' href='#/send/" + Math.max(1, w - 1) + "'>‹</a><div class='lbl'><b>Week " + w + "</b></div><a class='iconbtn' style='background:var(--soft);color:var(--ink)' href='#/send/" + Math.min(12, w + 1) + "'>›</a></div></div>";
    h += "<div class='card'><h2>Week notes (optional)</h2><textarea data-f='weeknote' data-w='" + w + "' placeholder='Missed days, what was fun, too easy / too hard, anything that hurt'>" + esc(S.weekNotes[w] || "") + "</textarea><div class='saved' id='saved'></div></div>";
    parts.forEach(function (p, i) {
      h += "<a class='btn big' id='mail" + i + "' href='" + esc(mailto(w, p, i, parts.length)) + "'>✉️ Email " + (parts.length > 1 ? "part " + (i + 1) + " of " + parts.length : "results") + "</a>";
    });
    h += "<button class='btn alt' data-act='copy'>📋 Copy results</button>";
    h += "<p class='muted small'>Email opens your mail app with everything filled in — just press Send. If nothing opens, tap <b>Copy results</b> and paste into an email to <b>" + esc(P.coachEmail) + "</b> with subject <b>" + esc(P.name) + " Week " + w + " results</b>." + (parts.length > 1 ? " It's long, so it is split into " + parts.length + " emails." : "") + "</p>";
    h += "<div class='card'><h2>Preview</h2><div class='muted small'>" + all.length + " characters</div><pre class='summary' id='summary'>" + esc(all) + "</pre></div></main>";
    return h;
  }

  /* ---------------- RULES ---------------- */
  function rules() {
    var h = header("🛟 Rules & Safety", esc(P.title), "#/week/" + (viewWeek || currentWeek()));
    h += "<main class='wrap rules'><div class='card'><p style='margin:0'>" + esc(P.intro) + "</p></div>";
    var order = P.sections.slice().sort(function (a, b) { return (/SAFETY/.test(b.title) ? 1 : 0) - (/SAFETY/.test(a.title) ? 1 : 0); });
    order.forEach(function (sec) {
      var safe = /SAFETY/.test(sec.title);
      h += "<details class='" + (safe ? "safety" : "") + "' " + (safe || /SCHEDULE|PROGRESSION/.test(sec.title) ? "open" : "") + "><summary>" + (safe ? "⚠️ " : /SCHEDULE/.test(sec.title) ? "📅 " : /PROGRESSION/.test(sec.title) ? "📈 " : /WARM/.test(sec.title) ? "🔥 " : /GOAL/.test(sec.title) ? "🎯 " : /FUN/.test(sec.title) ? "🎉 " : "📋 ") + esc(sec.title) + "</summary>";
      sec.items.forEach(function (it) { h += "<div class='item'><b>" + esc(it.label) + "</b>" + esc(it.text).replace(/\n/g, "<br>") + "</div>"; });
      h += "</details>";
    });
    h += "<details><summary>📖 Exercise guide</summary>" + P.guide.map(function (g) { return "<div class='item'><b>" + esc(g.name) + " <span class='badge'>" + esc(g.day) + "</span></b>" + esc(g.how) + "</div>"; }).join("") + "</details>";
    return h + "</main>";
  }

  /* ---------------- BACKUP ---------------- */
  function backup() {
    var h = header("💾 Backup", "Save or move your workout log", "#/week/" + (viewWeek || currentWeek()));
    h += "<main class='wrap'><div class='card'><h2>Save a backup</h2><p class='muted small'>Everything is saved on this phone automatically. Download a backup file now and then (or before switching phones).</p>" +
      "<button class='btn' data-act='export'>⬇️ Download backup file</button><button class='btn ghost' data-act='copybackup'>📋 Copy backup text</button>" + (window.STSync && STSync.status() ? "<p class='muted small'>☁️ " + esc(STSync.status()) + "</p>" : "") + "</div>" +
      "<div class='card'><h2>Restore a backup</h2><p class='muted small'>Pick a backup file (or paste backup text). This replaces the log on this phone.</p>" +
      "<input type='file' id='importFile' accept='application/json,.json,text/plain' class='txt'>" +
      "<textarea id='importText' placeholder='…or paste backup text here' style='margin-top:10px'></textarea><button class='btn alt' data-act='importtext'>⬆️ Restore pasted text</button></div>" +
      "<div class='card'><h2>Start over</h2><button class='btn ghost' data-act='reset' style='color:#b91c1c'>🗑️ Erase " + esc(P.name) + "'s log on this phone</button></div></main>";
    return h;
  }
  function backupObj() {
    var kids = {};
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("kidStrength:v1:") === 0) { try { kids[k.slice(15)] = JSON.parse(localStorage.getItem(k)); } catch (e) {} } }
    kids[KID] = S;
    return { app: "kid-strength-tracker", version: 1, exportedAt: new Date().toISOString(), kids: kids };
  }
  function doImport(text) {
    var o; try { o = JSON.parse(text); } catch (e) { toast("That isn't a backup file"); return; }
    var kids = o && o.kids; if (!kids && o && o.sessions) { kids = {}; kids[KID] = o; }
    if (!kids || typeof kids !== "object") { toast("That isn't a backup file"); return; }
    var names = Object.keys(kids).filter(function (k) { return kids[k] && typeof kids[k] === "object" && kids[k].sessions; });
    if (!names.length) { toast("No workout data found"); return; }
    if (!confirm("Restore backup for: " + names.join(", ") + "?\nThis replaces the current log on this phone.")) return;
    names.forEach(function (k) { localStorage.setItem("kidStrength:v1:" + k, JSON.stringify(kids[k])); });
    if (window.STSync) STSync.touch();
    S = load(); toast("Backup restored ✓"); location.hash = "#/home"; render();
  }

  /* ---------------- helpers ---------------- */
  function toast(msg) { var t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 2200); }
  function copyText(text) {
    function fb() { var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta); toast(ok ? "Copied! Paste it into an email 📋" : "Select the preview text and copy it"); }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast("Copied! Paste it into an email 📋"); }, fb); else fb();
  }
  function confetti() {
    var c = document.createElement("canvas"); c.id = "confetti"; document.body.appendChild(c);
    var x = c.getContext("2d"), W = c.width = innerWidth, H = c.height = innerHeight, cols = ["#ff7a1a", "#14b8a6", "#3b5bdb", "#facc15", "#ec4899", "#22c55e", "#7c3aed"], ps = [];
    for (var i = 0; i < 160; i++) ps.push({ x: W / 2, y: H * 0.45, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 16 - 4, s: 6 + Math.random() * 8, c: cols[i % cols.length], r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4 });
    var t0 = performance.now();
    (function f(t) { x.clearRect(0, 0, W, H); ps.forEach(function (p) { p.vy += 0.45; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); }); if (t - t0 < 2600) requestAnimationFrame(f); else c.remove(); })(t0);
  }
  function finish(w, d) {
    var r = rec(w, d, true), s = sess(w, d), first = !r.finished;
    r.finished = true; r.finishedAt = r.finishedAt || new Date().toISOString(); r.date = r.date || todayStr(); save();
    confetti();
    var st = STICKERS[(s.num - 1) % STICKERS.length], m = document.createElement("div"); m.className = "modal";
    var chBonus = s.challenge && isChallengeDone(r);
    m.innerHTML = "<div class='box'><div class='big'>" + st + "</div><h2 style='font-size:28px;margin:6px 0'>" + (first ? "Awesome work, " + esc(P.name) + "!" : "Still awesome!") + "</h2><p>Workout #" + s.num + " finished" + (chBonus ? " + ⭐ challenge bonus" : "") + "!<br>Stickers: <b>" + stats().stickers.length + "</b></p>" +
      "<button class='btn' data-act='closemodal'>Yay! 🎉</button>" + (d === 3 ? "<a class='btn alt' href='#/send/" + w + "' data-act='closemodal'>📨 Send week " + w + "</a>" : "") + "</div>";
    document.body.appendChild(m);
    var btn = document.querySelector("[data-act=finish]"); if (btn) btn.textContent = "🎉 Finished! (tap for confetti)";
  }

  /* ---------------- router & events ---------------- */
  function route() { var p = (location.hash || "#/home").slice(2).split("/"); return p; }
  function render() {
    var p = route(), w = Math.min(12, Math.max(1, parseInt(p[1], 10) || 0)) || null;
    var html;
    if (p[0] === "s" && w && +p[2] >= 1 && +p[2] <= 3) { viewWeek = w; html = session(w, +p[2]); document.title = P.name + " • Week " + w + " Day " + p[2]; }
    else if (p[0] === "send") { w = w || viewWeek || currentWeek(); viewWeek = w; html = send(w); document.title = P.name + " • Send week " + w; }
    else if (p[0] === "rules") { html = rules(); document.title = P.name + " • Rules"; }
    else if (p[0] === "backup") { html = backup(); document.title = P.name + " • Backup"; }
    else { html = home(p[0] === "week" ? w : null); document.title = P.name + "'s Strength Tracker"; }
    app.innerHTML = html; window.scrollTo(0, 0);
  }
  function ctx() { var p = route(); return p[0] === "s" ? { w: +p[1], d: +p[2] } : null; }
  function onField(ev) {
    var el = ev.target, f = el.getAttribute && el.getAttribute("data-f");
    if (el.id === "startDate") { S.startDate = el.value || null; save(true); viewWeek = null; if (ev.type === "change") render(); return; }
    if (f === "weeknote") { S.weekNotes[el.getAttribute("data-w")] = el.value; save(); refreshSend(); return; }
    if (!f) return;
    var c = ctx(); if (!c) return;
    var r = rec(c.w, c.d, true), ei = el.getAttribute("data-e"), i = +el.getAttribute("data-i");
    if (!r.date && ev.type === "input") r.date = todayStr();
    var e = ei != null ? (r.ex[ei] = r.ex[ei] || {}) : null;
    if (f === "r" || f === "w") { (e[f] = e[f] || [])[i] = el.value.trim(); if (f === "r") autoDone(c, ei, e, el); }
    else if (f === "note") e.note = el.value;
    else if (f === "done") { e.done = el.checked; el.closest(".ex").classList.toggle("isdone", el.checked); if (!r.date) r.date = todayStr(); }
    else if (f === "warm") r.warm[i] = el.checked;
    else if (f === "cool") r.cool = el.checked;
    else if (f === "chres") r.ch.res = el.value;
    else if (f === "chdone") { r.ch.done = el.checked; if (el.checked) { toast("⭐ Bonus sticker!"); } }
    else if (f === "notes") r.notes = el.value;
    save();
  }
  function autoDone(c, ei, e, el) {
    var ex = sess(c.w, c.d).exercises[ei], all = true;
    for (var k = 0; k < ex.sets; k++) if (!((e.r || [])[k] || "").trim()) all = false;
    if (all && !e.done) { e.done = true; var card = el.closest(".ex"); card.classList.add("isdone"); card.querySelector("[data-f=done]").checked = true; }
  }
  function refreshSend() {
    var w = viewWeek, parts = weekParts(w), all = parts.join("\n\n"), pre = document.getElementById("summary");
    if (pre) pre.textContent = all;
    var a0 = document.getElementById("mail0");
    if (a0 && document.querySelectorAll("[id^=mail]").length === parts.length) parts.forEach(function (p, i) { document.getElementById("mail" + i).setAttribute("href", mailto(w, p, i, parts.length)); });
    else if (a0) { var y = scrollY, fe = document.activeElement && document.activeElement.getAttribute("data-f"); app.innerHTML = send(w); scrollTo(0, y); if (fe) { var t = app.querySelector("[data-f=" + fe + "]"); t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
  }
  document.addEventListener("input", function (ev) { if (ev.target.type !== "checkbox") onField(ev); });
  document.addEventListener("change", function (ev) { var t = ev.target; if (t.id === "importFile" && t.files && t.files[0]) { var fr = new FileReader(); fr.onload = function () { doImport(fr.result); }; fr.readAsText(t.files[0]); return; } if (t.type === "checkbox" || t.id === "startDate") onField(ev); });
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-act]"); if (!b) return;
    var a = b.getAttribute("data-act"), c = ctx();
    if (a === "wk") { viewWeek = +b.getAttribute("data-w"); location.hash = "#/week/" + viewWeek; }
    else if (a === "feel" && c) { var r = rec(c.w, c.d, true); r.feel = r.feel === b.getAttribute("data-v") ? "" : b.getAttribute("data-v"); if (!r.date) r.date = todayStr(); save(); b.parentNode.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-v") === r.feel); }); }
    else if (a === "finish" && c) finish(c.w, c.d);
    else if (a === "closemodal") { var m = b.closest(".modal"); if (m) m.remove(); }
    else if (a === "copy") copyText(weekParts(viewWeek).join("\n\n"));
    else if (a === "export") {
      var blob = new Blob([JSON.stringify(backupObj(), null, 1)], { type: "application/json" }), u = URL.createObjectURL(blob), l = document.createElement("a");
      l.href = u; l.download = "strength-backup-" + KID + "-" + todayStr() + ".json"; document.body.appendChild(l); l.click(); setTimeout(function () { URL.revokeObjectURL(u); l.remove(); }, 1000); toast("Backup downloaded 💾");
    }
    else if (a === "copybackup") copyText(JSON.stringify(backupObj()));
    else if (a === "importtext") doImport(document.getElementById("importText").value);
    else if (a === "reset") { if (confirm("Erase ALL of " + P.name + "'s workout log on this phone? (Download a backup first!)")) { localStorage.removeItem(KEY); S = load(); toast("Erased"); location.hash = "#/home"; render(); } }
  });
  window.addEventListener("hashchange", render);
  try { localStorage.setItem("kidStrength:lastKid", KID); } catch (e) {}
  render();
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !window.SINGLE_FILE) {
    navigator.serviceWorker.register(window.SW_PATH || "../sw.js", { scope: window.SW_SCOPE || "../" }).catch(function () {});
  }
  window.__tracker = { weekParts: weekParts, mailto: mailto, state: function () { return S; } };
})();
