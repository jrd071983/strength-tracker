/* Adult Fitness Tracker - vanilla JS, no network, data saved in localStorage on this phone. Strength + cardio logging. */
(function () {
  "use strict";
  var PID = window.PERSON || "maureen";
  var P = (window.PLANS || {})[PID];
  var app = document.getElementById("app");
  if (!P) { app.innerHTML = "<p style='padding:20px'>Plan data missing.</p>"; return; }
  var KEY = "fitTracker:v1:" + PID, NW = P.weeks.length, ND = P.weeks[0].sessions.length, TOTAL = NW * ND;
  var FEEL = ["EASY", "OK", "HARD"], MACHINES = ["Bike", "Treadmill", "Other"];
  var S = load(), viewWeek = null;

  function load() { try { var s = JSON.parse(localStorage.getItem(KEY) || "{}"); if (s && typeof s === "object") { s.sessions = s.sessions || {}; s.weekNotes = s.weekNotes || {}; return s; } } catch (e) {} return { sessions: {}, weekNotes: {} }; }
  var saveTimer;
  function save(quiet) {
    S.updatedAt = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(S)); localStorage.setItem("kidStrength:lastKid", PID); } catch (e) { toast("Could not save - storage full?"); }
    if (!quiet) { var el = document.getElementById("saved"); if (el) { el.textContent = "Saved"; clearTimeout(saveTimer); saveTimer = setTimeout(function () { el.textContent = ""; }, 1200); } }
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function sk(w, d) { return "w" + w + "d" + d; }
  function rec(w, d, create) { var k = sk(w, d); if (!S.sessions[k] && create) S.sessions[k] = { warm: {}, ex: {}, feel: "", notes: "" }; return S.sessions[k]; }
  function week(w) { return P.weeks[w - 1]; }
  function sess(w, d) { return week(w).sessions[d - 1]; }
  function todayStr() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function parseDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function fmtShort(d) { return (d.getMonth() + 1) + "/" + d.getDate(); }
  function currentWeek() {
    var st = parseDate(S.startDate);
    if (st) { var n = new Date(); n.setHours(0, 0, 0, 0); return Math.min(NW, Math.max(1, Math.floor((n - st) / 864e5 / 7) + 1)); }
    for (var w = 1; w <= NW; w++) for (var d = 1; d <= ND; d++) { var r = rec(w, d); if (!r || !r.finished) return w; }
    return NW;
  }
  function weekDates(w) { var st = parseDate(S.startDate); if (!st) return ""; var a = new Date(st); a.setDate(a.getDate() + (w - 1) * 7); var b = new Date(a); b.setDate(b.getDate() + 6); return fmtShort(a) + " - " + fmtShort(b); }
  function doneCount() { var n = 0; for (var k in S.sessions) if (S.sessions[k] && S.sessions[k].finished) n++; return n; }
  function weekDone(w) { var n = 0; for (var d = 1; d <= ND; d++) { var r = rec(w, d); if (r && r.finished) n++; } return n; }
  function badges(wk) {
    var h = "<span class='badge'>" + esc(wk.phase.split(" - ")[0]) + "</span>";
    if (wk.deload) h += "<span class='badge deload'>Deload - lighter week</span>";
    if (wk.retest) h += "<span class='badge retest'>Retest week</span>";
    if (wk.baseline) h += "<span class='badge base'>Baseline week</span>";
    return h;
  }
  function tag(s) { return s.type === "Cardio" ? "<span class='tag cardio' aria-hidden='true'>&#x1F6B4;</span>" : "<span class='tag'>" + esc(s.type.slice(-1)) + "</span>"; }
  function sessSummary(s) {
    var st = s.exercises.filter(function (e) { return e.kind !== "cardio"; }), cd = s.exercises.filter(function (e) { return e.kind === "cardio"; });
    if (!st.length) return cd.map(function (e) { return e.reps + " · " + e.name.replace(/^(BASELINE TEST|RETEST): /, "test: "); }).join(", ");
    return st.length + " exercises" + (cd.length ? " + " + cd[0].reps + " cardio finisher" : "");
  }
  // Visible target line, e.g. "Target: 15 lb × 10-12" + detail ("2 sets · handle + 5 lb plate each end") + 2.5 lb plate note.
  function targetText(ex) {
    if (ex.kind === "cardio") return "Target: " + ex.reps + " · " + ex.target;
    var m = /^(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)? lb\*?(?: (?:total|each(?: hand)?|bar))?\*?)/.exec(ex.target || "");
    var reps = String(ex.reps).replace(/\s*sec\b/, " s");
    return "Target: " + (m ? m[1] : ex.target) + " × " + reps;
  }
  function targetHtml(ex) {
    var t = targetText(ex), detail = ex.kind === "cardio" ? "" : ex.sets + (ex.sets === 1 ? " set" : " sets");
    var m = /^(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)? lb\*?(?: (?:total|each(?: hand)?|bar))?\*?)\s*(.*)$/.exec(ex.target || "");
    if (m && m[2]) detail += " · " + m[2].replace(/^\((.*)\)$/, "$1");
    var h = "<div class='target' data-target>" + esc(t) + "</div>" + (detail ? "<div class='load'>" + esc(detail) + "</div>" : "");
    if (/\*/.test(ex.target || "")) h += "<div class='starnote'>* needs 2.5 lb plates - without them, stay at the last weight and add 1-2 reps</div>";
    return h;
  }
  function isTime(reps) { return /sec/i.test(reps); }
  function header(title, sub, back) {
    return "<header class='top'><div class='wrap'><div class='row'>" + (back ? "<a class='iconbtn' href='" + back + "' aria-label='Back'>&#8249;</a>" : "") +
      "<h1>" + title + "</h1>" + (back ? "" : "<a class='iconbtn' href='#/rules' aria-label='Plan guide and safety'>?</a>") + "</div>" +
      (sub ? "<div class='sub'>" + sub + "</div>" : "") + "</div></header>";
  }

  /* ---------------- HOME ---------------- */
  function home(w) {
    w = w || viewWeek || currentWeek(); viewWeek = w;
    var wk = week(w), cw = currentWeek(), done = doneCount();
    var h = header(esc(P.name) + "'s Training", "12-week return-to-fitness plan &middot; " + done + " of " + TOTAL + " sessions done");
    h += "<main class='wrap'><div class='card'><div class='weekpick'><button data-act='wk' data-w='" + (w - 1) + "' " + (w <= 1 ? "disabled" : "") + " aria-label='Previous week'>&#8249;</button>" +
      "<div class='lbl'><span class='muted'>WEEK</span><b id='weeknum'>" + w + " <span class='muted' style='font-size:16px'>of " + NW + "</span></b>" +
      (S.startDate ? "<span class='muted small'>" + weekDates(w) + (w === cw ? " &middot; this week" : "") + "</span>" : "") + "</div>" +
      "<button data-act='wk' data-w='" + (w + 1) + "' " + (w >= NW ? "disabled" : "") + " aria-label='Next week'>&#8250;</button></div>" +
      "<div style='text-align:center;margin-top:8px'>" + badges(wk) + "</div>" +
      (w !== cw ? "<button class='btn ghost' data-act='wk' data-w='" + cw + "'>Go to " + (S.startDate ? "this" : "next") + " week (" + cw + ")</button>" : "") + "</div>";
    if (wk.deload) h += "<div class='sessnote'>Deload week: lighter on purpose - fewer sets, lighter weights, shorter cardio. Let your body catch up.</div>";
    if (wk.retest) h += "<div class='sessnote'>Retest week: light sessions plus the same tests as week 1. See how far you've come - no max lifts.</div>";
    wk.sessions.forEach(function (s) {
      var r = rec(w, s.dayIndex), started = r && (r.date || Object.keys(r.ex || {}).length);
      h += "<a class='sess " + (r && r.finished ? "done" : "") + "' href='#/s/" + w + "/" + s.dayIndex + "'>" + tag(s) +
        "<span class='t'><b>" + esc(s.day) + " &middot; " + esc(s.type) + "</b><span class='muted small'>" + esc(sessSummary(s)) + "</span></span>" +
        "<span class='st'>" + (r && r.finished ? "Done" : started ? "Started" : "&#8250;") + "</span></a>";
    });
    h += "<p class='muted small' style='margin:4px 2px'>Do them in order, any days you like. Leave at least one rest day between strength days when possible.</p>";
    h += "<a class='btn alt' href='#/send/" + w + "'>Send week " + w + " to " + esc(P.coachName) + "</a>";
    h += "<div class='card'><h2>Progress</h2><div class='bar'><i style='width:" + Math.round(done / TOTAL * 100) + "%'></i></div><div class='muted small'>" + done + " / " + TOTAL + " sessions &middot; this week " + weekDone(w) + " / " + ND + "</div></div>";
    h += "<div class='card'><h2>Start date</h2><div class='muted small'>First day of week 1. The app then opens on the right week automatically.</div>" +
      "<input class='txt' type='date' id='startDate' value='" + esc(S.startDate || "") + "' style='margin-top:8px'></div>";
    h += "<div class='grid2'><a class='btn ghost' href='#/rules'>Plan &amp; safety</a><a class='btn ghost' href='#/backup'>Backup</a></div>";
    if (!window.SINGLE_FILE) h += "<a class='btn ghost' href='../index.html?pick=1'>Switch person</a>";
    h += "<p class='muted small' style='text-align:center'>Stop for pain. Good form first; finish sets with 2-3 reps in the tank.</p></main>";
    return h;
  }

  /* ---------------- SESSION ---------------- */
  function strengthBoxes(ei, ex, e) {
    var reps = e.r || [], wts = e.w || [], unit = isTime(ex.reps) ? "sec" : "reps", h = "<div class='sets'>";
    var ll = ex.load === "hole" ? "hole #" : "lb";
    h += ex.load === "none" ? "<div class='set one hdr'><span></span><label>" + unit + "</label></div>" : "<div class='set hdr'><span></span><label>" + (ex.load === "hole" ? "bar hole #" : "weight (lb)") + "</label><label>" + unit + "</label></div>";
    for (var i = 0; i < ex.sets; i++) {
      var rp = "<input data-f='r' data-e='" + ei + "' data-i='" + i + "' inputmode='numeric' autocomplete='off' placeholder='" + unit + "' value='" + esc(reps[i] || "") + "' aria-label='Set " + (i + 1) + " " + unit + "'>";
      if (ex.load === "none") { h += "<div class='set one'><label>SET " + (i + 1) + "</label>" + rp + "</div>"; continue; }
      var wt = "<input data-f='w' data-e='" + ei + "' data-i='" + i + "' inputmode='decimal' autocomplete='off' placeholder='" + (ex.weight != null ? ex.weight : ll) + "' value='" + esc(wts[i] || "") + "' aria-label='Set " + (i + 1) + " " + (ex.load === "hole" ? "bar hole number" : "weight in pounds") + "'>";
      h += "<div class='set'><label>SET " + (i + 1) + "</label>" + wt + rp + "</div>";
    }
    return h + "</div>";
  }
  function cardioBoxes(ei, ex, e) {
    var opt = "<option value=''>Choose…</option>" + MACHINES.map(function (m) { return "<option" + (e.mach === m ? " selected" : "") + ">" + m + "</option>"; }).join("");
    var eff = "<option value=''>–</option>"; for (var k = 1; k <= 10; k++) eff += "<option" + (String(e.eff) === String(k) ? " selected" : "") + ">" + k + "</option>";
    return "<div class='cardio'><div><label for='min" + ei + "'>Minutes</label><input id='min" + ei + "' data-f='min' data-e='" + ei + "' inputmode='decimal' autocomplete='off' placeholder='min' value='" + esc(e.min || "") + "'></div>" +
      "<div><label for='mach" + ei + "'>Machine</label><select id='mach" + ei + "' data-f='mach' data-e='" + ei + "'>" + opt + "</select></div>" +
      "<div class='wide'><label for='set" + ei + "'>Speed / incline or resistance" + (ex.test ? " + distance" : "") + "</label><input id='set" + ei + "' data-f='set' data-e='" + ei + "' autocomplete='off' placeholder='e.g. 3.0 mph 4% or level 5' value='" + esc(e.set || "") + "'></div>" +
      "<div class='wide'><label for='eff" + ei + "'>Effort (1-10)  ·  zone 2 ≈ 3-5, can talk in sentences</label><select id='eff" + ei + "' data-f='eff' data-e='" + ei + "'>" + eff + "</select></div></div>";
  }
  function session(w, d) {
    var s = sess(w, d), wk = week(w), r = rec(w, d) || {};
    var h = header(esc(s.day) + " &middot; " + esc(s.type), "Week " + w + " &middot; Session " + s.num + " of " + TOTAL, "#/week/" + w);
    h += "<main class='wrap'><div>" + badges(wk) + "</div>";
    h += "<div class='card'><h2>Warm-up (5 min)</h2>" + P.warmup.map(function (it, i) {
      return "<label class='check'><input type='checkbox' data-f='warm' data-i='" + i + "' " + (r.warm && r.warm[i] ? "checked" : "") + "><span><b>" + esc(it.label) + "</b><br><span class='small'>" + esc(it.text) + "</span></span></label>";
    }).join("") + "</div>";
    s.exercises.forEach(function (ex, ei) {
      var e = (r.ex && r.ex[ei]) || {}, g = ex.guide != null ? P.guide[ex.guide] : null, cardio = ex.kind === "cardio";
      h += "<section class='card ex " + (e.done ? "isdone " : "") + (ex.test ? "test" : "") + "' id='ex" + ei + "'><div class='head'><span class='num'>" + (ei + 1) + "</span><div style='flex:1'><h3>" + esc(ex.name) + "</h3>" +
        targetHtml(ex) + "</div></div>" +
        "<details class='howto'><summary>How to / tips</summary><div class='body'>" + (g ? "<p style='margin-top:0'>" + esc(g.how) + "</p>" : "") + "<p class='muted' style='margin-bottom:0'>" + esc(ex.cue) + "</p></div></details>" +
        (cardio ? cardioBoxes(ei, ex, e) : strengthBoxes(ei, ex, e)) +
        "<input class='txt' data-f='note' data-e='" + ei + "' placeholder='Notes (how it felt, adjustments…)' value='" + esc(e.note || "") + "' style='margin-top:8px'>" +
        "<label class='donebox'><input type='checkbox' data-f='done' data-e='" + ei + "' " + (e.done ? "checked" : "") + "> Done</label></section>";
    });
    if (P.cooldown.length) h += "<div class='card'><h2>Cool-down</h2>" + P.cooldown.map(function (it) { return "<label class='check'><input type='checkbox' data-f='cool' " + (r.cool ? "checked" : "") + "><span><b>" + esc(it.label) + "</b><br><span class='small'>" + esc(it.text) + "</span></span></label>"; }).join("") + "</div>";
    h += "<div class='card'><h2>How did it feel overall?</h2><div class='feel'>" + FEEL.map(function (f) { return "<button data-act='feel' data-v='" + f + "' class='" + (r.feel === f ? "on" : "") + "'>" + f + "</button>"; }).join("") + "</div>" +
      "<p class='muted small' style='margin:8px 0 0'>EASY = 4+ reps left &middot; OK = 2-3 left (the target) &middot; HARD = 0-1 left or form got shaky</p>" +
      "<h2 style='margin-top:14px'>Notes</h2><textarea data-f='notes' placeholder='Energy, sleep, anything too easy or too hard, anything that hurt'>" + esc(r.notes || "") + "</textarea></div>";
    h += "<div class='saved' id='saved'></div><button class='btn green' data-act='finish'>" + (r.finished ? "Finished ✓" : "Finish session") + "</button>";
    var nx = d < ND ? [w, d + 1] : (w < NW ? [w + 1, 1] : null);
    h += "<div class='grid2'><a class='btn ghost' href='#/week/" + w + "'>Week " + w + "</a>" + (nx ? "<a class='btn ghost' href='#/s/" + nx[0] + "/" + nx[1] + "'>Next session &#8250;</a>" : "<a class='btn ghost' href='#/send/" + NW + "'>Send</a>") + "</div></main>";
    return h;
  }

  /* ---------------- SUMMARY / SEND ---------------- */
  function fmtStrength(ex, e) {
    var out = [];
    for (var i = 0; i < ex.sets; i++) {
      var rp = ((e.r || [])[i] || "").trim(), wt = ((e.w || [])[i] || "").trim();
      if (!rp && !wt) continue;
      var u = isTime(ex.reps) ? "s" : "";
      if (ex.load === "hole") out.push((wt ? "hole " + wt + " x " : "") + (rp || "?"));
      else if (wt) out.push(wt + (/^[\d.]+$/.test(wt) ? "lb" : "") + " x " + (rp || "?") + u);
      else out.push(rp + u);
    }
    return out.join(", ");
  }
  function fmtCardio(e) {
    var b = [];
    if ((e.min || "").trim()) b.push(e.min.trim() + " min");
    if (e.mach) b.push(e.mach);
    if ((e.set || "").trim()) b.push(e.set.trim());
    if (e.eff) b.push("effort " + e.eff + "/10");
    return b.join(", ");
  }
  function sessionBlock(w, d) {
    var s = sess(w, d), r = rec(w, d), L = [], head = s.day + " " + s.type;
    if (!r || (!r.finished && !r.date && !Object.keys(r.ex || {}).length && !(r.notes || "").trim())) return head + ": not done yet";
    var bits = [head]; if (r.date) bits.push(fmtShort(parseDate(r.date)));
    bits.push(r.finished ? "FINISHED" : "partly done"); if (r.feel) bits.push("felt " + r.feel);
    L.push(bits.join(" | "));
    s.exercises.forEach(function (ex, ei) {
      var e = (r.ex || {})[ei] || {}, cardio = ex.kind === "cardio", got = cardio ? fmtCardio(e) : fmtStrength(ex, e);
      var nm = ex.name.replace(/^Cardio finisher:.*/, "Cardio finisher").replace(/\s*\((bar in rack|seated|core|low row cable|shoulders on bench)\)/, "");
      var line = "- " + nm + " (" + (cardio ? ex.reps : ex.sets + "x" + ex.reps) + "): " + (got || (e.done ? "done" : "-"));
      if ((e.note || "").trim()) line += " [" + e.note.trim() + "]";
      L.push(line);
    });
    if ((r.notes || "").trim()) L.push("  Notes: " + r.notes.trim());
    return L.join("\n");
  }
  function weekHeader(w, part, of) {
    return P.name + " - Week " + w + " of " + NW + " (" + week(w).phase + ")" + (of > 1 ? " - part " + part + "/" + of : "") + "\n" +
      (S.startDate ? "Dates: " + weekDates(w) + "\n" : "") + "Sessions finished: " + weekDone(w) + "/" + ND;
  }
  function weekParts(w) {
    var LIMIT = 1800, blocks = [];
    for (var d = 1; d <= ND; d++) blocks.push(sessionBlock(w, d));
    var wn = (S.weekNotes[w] || "").trim(); if (wn) blocks.push("Week notes: " + wn);
    var foot = "(sent from " + P.name + "'s tracker app)";
    var full = weekHeader(w, 1, 1) + "\n\n" + blocks.join("\n\n") + "\n\n" + foot;
    if (full.length <= LIMIT) return [full];
    var parts = [], cur = [], room = LIMIT - 130;
    blocks.forEach(function (b) {
      while (b.length > room) { if (cur.length) { parts.push(cur); cur = []; } parts.push([b.slice(0, room)]); b = "(cont.) " + b.slice(room); }
      if ((cur.join("\n\n") + "\n\n" + b).length > room && cur.length) { parts.push(cur); cur = []; }
      cur.push(b);
    });
    if (cur.length) parts.push(cur);
    return parts.map(function (p, i) { return weekHeader(w, i + 1, parts.length) + "\n\n" + p.join("\n\n") + (i === parts.length - 1 ? "\n\n" + foot : ""); });
  }
  function subject(w, i, n) { return P.name + " Week " + w + " results" + (n > 1 ? " (part " + (i + 1) + " of " + n + ")" : ""); }
  function mailto(w, body, i, n) { return "mailto:" + P.coachEmail + "?subject=" + encodeURIComponent(subject(w, i, n)) + "&body=" + encodeURIComponent(body); }
  function send(w) {
    var parts = weekParts(w), all = parts.join("\n\n");
    var h = header("Send week " + w + " to " + esc(P.coachName), "Goes to " + esc(P.coachName) + ": " + esc(P.coachEmail), "#/week/" + w);
    h += "<main class='wrap'><div class='card'><div class='weekpick'><a class='iconbtn' style='background:var(--soft);color:var(--ink)' href='#/send/" + Math.max(1, w - 1) + "' aria-label='Previous week'>&#8249;</a><div class='lbl'><b>Week " + w + "</b></div><a class='iconbtn' style='background:var(--soft);color:var(--ink)' href='#/send/" + Math.min(NW, w + 1) + "' aria-label='Next week'>&#8250;</a></div></div>";
    h += "<div class='card'><h2>Notes for the week (optional)</h2><textarea data-f='weeknote' data-w='" + w + "' placeholder='Energy, sleep, missed days, what felt too easy or too hard, anything that hurt'>" + esc(S.weekNotes[w] || "") + "</textarea><div class='saved' id='saved'></div></div>";
    parts.forEach(function (p, i) { h += "<a class='btn' id='mail" + i + "' href='" + esc(mailto(w, p, i, parts.length)) + "'>Email " + (parts.length > 1 ? "part " + (i + 1) + " of " + parts.length : "week " + w + " to " + esc(P.coachName)) + "</a>"; });
    h += "<button class='btn ghost' data-act='copy'>Copy results</button>";
    h += "<p class='muted small'>Opens your mail app with everything filled in - just press Send. If nothing opens, tap <b>Copy results</b> and paste into an email to <b>" + esc(P.coachEmail) + "</b> with subject <b>" + esc(subject(w, 0, 1)) + "</b>." + (parts.length > 1 ? " It's long, so it's split into " + parts.length + " emails." : "") + "</p>";
    h += "<div class='card'><h2>Preview</h2><div class='muted small'>" + all.length + " characters</div><pre class='summary' id='summary'>" + esc(all) + "</pre></div></main>";
    return h;
  }

  /* ---------------- PLAN & SAFETY ---------------- */
  function rules() {
    var h = header("Plan &amp; safety", esc(P.title), "#/week/" + (viewWeek || currentWeek()));
    h += "<main class='wrap rules'><div class='card'><p style='margin:0'>" + esc(P.intro) + "</p></div>";
    var order = P.sections.slice().sort(function (a, b) { return (/SAFETY/.test(b.title) ? 1 : 0) - (/SAFETY/.test(a.title) ? 1 : 0); });
    order.forEach(function (sec) {
      var safe = /SAFETY/.test(sec.title);
      h += "<details class='" + (safe ? "safety" : "") + "' " + (safe || /SCHEDULE/.test(sec.title) ? "open" : "") + "><summary>" + esc(sec.title) + "</summary>";
      sec.items.forEach(function (it) { h += "<div class='item'><b>" + esc(it.label) + "</b>" + esc(it.text).replace(/\n/g, "<br>") + "</div>"; });
      h += "</details>";
    });
    h += "<details><summary>Exercise guide</summary>" + P.guide.map(function (g) { return "<div class='item'><b>" + esc(g.name) + " <span class='badge'>" + esc(g.day) + "</span></b>" + esc(g.how) + "</div>"; }).join("") + "</details>";
    return h + "</main>";
  }

  /* ---------------- BACKUP ---------------- */
  function backup() {
    var h = header("Backup", "Save or move your log", "#/week/" + (viewWeek || currentWeek()));
    h += "<main class='wrap'><div class='card'><h2>Save a backup</h2><p class='muted small'>Everything saves on this phone automatically. Download a backup now and then (and before switching phones).</p>" +
      "<button class='btn' data-act='export'>Download backup file</button><button class='btn ghost' data-act='copybackup'>Copy backup as text</button></div>" +
      "<div class='card'><h2>Restore</h2><p class='muted small'>Pick a backup file, or paste backup text.</p><input type='file' id='importFile' accept='application/json,.json,text/plain'>" +
      "<textarea id='importText' placeholder='…or paste backup text here' style='margin-top:10px'></textarea><button class='btn ghost' data-act='importtext'>Restore from text</button></div>" +
      "<div class='card'><button class='btn ghost' data-act='reset' style='color:var(--hard)'>Erase " + esc(P.name) + "'s log on this phone</button></div></main>";
    return h;
  }
  function backupObj() { var people = {}; people[PID] = S; return { app: "fitness-tracker", version: 1, exportedAt: new Date().toISOString(), people: people }; }
  function doImport(text) {
    var o; try { o = JSON.parse(text); } catch (e) { toast("That isn't a backup file"); return; }
    var d = o && o.people && o.people[PID] ? o.people[PID] : (o && o.sessions ? o : null);
    if (!d || typeof d !== "object" || !d.sessions) { toast("No " + P.name + " data in that backup"); return; }
    if (!confirm("Restore this backup?\nIt replaces the current log on this phone.")) return;
    localStorage.setItem(KEY, JSON.stringify(d)); S = load(); toast("Backup restored"); location.hash = "#/home"; render();
  }

  /* ---------------- helpers ---------------- */
  function toast(msg) { var t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 2200); }
  function copyText(text) {
    function fb() { var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta); toast(ok ? "Copied - paste it into an email" : "Select the preview text and copy it"); }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast("Copied - paste it into an email"); }, fb); else fb();
  }
  function finish(w, d) {
    var r = rec(w, d, true); r.finished = true; r.finishedAt = r.finishedAt || new Date().toISOString(); r.date = r.date || todayStr(); save();
    var btn = document.querySelector("[data-act=finish]"); if (btn) btn.textContent = "Finished ✓";
    toast(d === ND ? "Week " + w + " complete - send it to " + P.coachName + "!" : "Session saved. Nice work!");
  }

  /* ---------------- router & events ---------------- */
  function route() { return (location.hash || "#/home").slice(2).split("/"); }
  function render() {
    var p = route(), w = Math.min(NW, Math.max(1, parseInt(p[1], 10) || 0)) || null, html;
    if (p[0] === "s" && w && +p[2] >= 1 && +p[2] <= ND) { viewWeek = w; html = session(w, +p[2]); document.title = P.name + " · Week " + w + " Day " + p[2]; }
    else if (p[0] === "send") { w = w || viewWeek || currentWeek(); viewWeek = w; html = send(w); document.title = P.name + " · Send week " + w; }
    else if (p[0] === "rules") { html = rules(); document.title = P.name + " · Plan & safety"; }
    else if (p[0] === "backup") { html = backup(); document.title = P.name + " · Backup"; }
    else { html = home(p[0] === "week" ? w : null); document.title = P.name + "'s Training Tracker"; }
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
    if (!r.date) r.date = todayStr();
    var e = ei != null ? (r.ex[ei] = r.ex[ei] || {}) : null;
    if (f === "r" || f === "w") { (e[f] = e[f] || [])[i] = el.value.trim(); if (f === "r") autoDone(c, ei, e, el); }
    else if (f === "min" || f === "mach" || f === "set" || f === "eff") { e[f] = el.value; if (f === "min" && el.value.trim()) markDone(e, el); }
    else if (f === "note") e.note = el.value;
    else if (f === "done") { e.done = el.checked; el.closest(".ex").classList.toggle("isdone", el.checked); }
    else if (f === "warm") r.warm[i] = el.checked;
    else if (f === "cool") r.cool = el.checked;
    else if (f === "notes") r.notes = el.value;
    save();
  }
  function markDone(e, el) { if (e.done) return; e.done = true; var card = el.closest(".ex"); card.classList.add("isdone"); card.querySelector("[data-f=done]").checked = true; }
  function autoDone(c, ei, e, el) {
    var ex = sess(c.w, c.d).exercises[ei];
    for (var k = 0; k < ex.sets; k++) if (!((e.r || [])[k] || "").trim()) return;
    markDone(e, el);
  }
  function refreshSend() {
    var w = viewWeek, parts = weekParts(w), pre = document.getElementById("summary");
    if (pre) pre.textContent = parts.join("\n\n");
    var a0 = document.getElementById("mail0");
    if (a0 && document.querySelectorAll("[id^=mail]").length === parts.length) parts.forEach(function (p, i) { document.getElementById("mail" + i).setAttribute("href", mailto(w, p, i, parts.length)); });
    else if (a0) { var y = scrollY; app.innerHTML = send(w); scrollTo(0, y); var t = app.querySelector("[data-f=weeknote]"); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
  }
  document.addEventListener("input", function (ev) { var t = ev.target; if (t.type !== "checkbox" && t.tagName !== "SELECT") onField(ev); });
  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (t.id === "importFile" && t.files && t.files[0]) { var fr = new FileReader(); fr.onload = function () { doImport(fr.result); }; fr.readAsText(t.files[0]); return; }
    if (t.type === "checkbox" || t.id === "startDate" || t.tagName === "SELECT") onField(ev);
  });
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-act]"); if (!b) return;
    var a = b.getAttribute("data-act"), c = ctx();
    if (a === "wk") { viewWeek = +b.getAttribute("data-w"); location.hash = "#/week/" + viewWeek; }
    else if (a === "feel" && c) { var r = rec(c.w, c.d, true); r.feel = r.feel === b.getAttribute("data-v") ? "" : b.getAttribute("data-v"); if (!r.date) r.date = todayStr(); save(); b.parentNode.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-v") === r.feel); }); }
    else if (a === "finish" && c) finish(c.w, c.d);
    else if (a === "copy") copyText(weekParts(viewWeek).join("\n\n"));
    else if (a === "export") {
      var blob = new Blob([JSON.stringify(backupObj(), null, 1)], { type: "application/json" }), u = URL.createObjectURL(blob), l = document.createElement("a");
      l.href = u; l.download = "fitness-backup-" + PID + "-" + todayStr() + ".json"; document.body.appendChild(l); l.click(); setTimeout(function () { URL.revokeObjectURL(u); l.remove(); }, 1000); toast("Backup downloaded");
    }
    else if (a === "copybackup") copyText(JSON.stringify(backupObj()));
    else if (a === "importtext") doImport(document.getElementById("importText").value);
    else if (a === "reset") { if (confirm("Erase ALL of " + P.name + "'s workout log on this phone? (Download a backup first!)")) { localStorage.removeItem(KEY); S = load(); toast("Erased"); location.hash = "#/home"; render(); } }
  });
  window.addEventListener("hashchange", render);
  try { localStorage.setItem("kidStrength:lastKid", PID); } catch (e) {}
  render();
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !window.SINGLE_FILE) {
    // Pick up new versions promptly: check for an updated service worker on every load, and reload once when a new one takes over.
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register("../sw.js", { scope: "../" }).then(function (reg) { try { reg.update(); } catch (e) {} }).catch(function () {});
  }
  window.__tracker = { weekParts: weekParts, mailto: mailto, state: function () { return S; } };
})();
