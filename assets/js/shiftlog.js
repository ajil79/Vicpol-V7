/* Shift Log (v7.1).
   A per-officer on/off-duty log so monthly hours can be handed to whoever
   compiles the department hours report, instead of being reconstructed by hand.
   Mounts into #shiftRoot the first time the tab opens (initShiftLog, called
   from showToolPage in interactions.js), then re-renders on every change.

   Storage: localStorage key vicpol_shift_log →
     { officer: { name, callsign }, shifts: [ { id, start, end, callsign, note } ] }
   start/end are ISO strings in local time; an open shift has end === null.
   Included automatically in the Templates-modal backup (vicpol_ prefix).

   Reused from the rest of the app: escapeHtml, safeLocalStorageSet, toast,
   copyToClipboard (all globals from core.js / reports.js), state.enteredBy for
   the default callsign.
*/

(function () {
  "use strict";

  var KEY = "vicpol_shift_log";
  var rendered = false;
  var tickTimer = null;
  var viewMonth = monthKey(new Date());

  // ── helpers ───────────────────────────────────────────────────────────────
  function esc(s) { return (typeof escapeHtml === "function") ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function monthKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function monthLabel(key) {
    var p = key.split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1, 1);
    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
  }
  function toLocalInput(d) { // yyyy-mm-ddThh:mm for <input type=datetime-local>
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function fmtDate(iso) { var d = new Date(iso); return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); }
  function fmtTime(iso) { var d = new Date(iso); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function hours(ms) { return Math.round((ms / 3600000) * 100) / 100; }
  function fmtHours(h) { return (Math.round(h * 10) / 10).toFixed(1) + " h"; }
  function fmtDuration(ms) {
    var m = Math.max(0, Math.round(ms / 60000));
    return Math.floor(m / 60) + "h " + pad(m % 60) + "m";
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function notify(msg, type) { if (typeof toast === "function") toast(msg, type || "ok"); }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var v = raw ? JSON.parse(raw) : null;
      if (v && typeof v === "object" && Array.isArray(v.shifts)) return v;
    } catch (e) {}
    return { officer: { name: "", callsign: "" }, shifts: [] };
  }
  function save(data) {
    var text = JSON.stringify(data);
    if (typeof safeLocalStorageSet === "function") return safeLocalStorageSet(KEY, text);
    try { localStorage.setItem(KEY, text); return true; } catch (e) { return false; }
  }
  function defaultCallsign(data) {
    if (data.officer && data.officer.callsign) return data.officer.callsign;
    try {
      var entered = (typeof state !== "undefined" && state && state.enteredBy) ? String(state.enteredBy) : "";
      var m = entered.match(/^\s*([A-Z0-9]{2,4}\s?\d{2,3}\s?[A-Z]?)/i);
      if (m) return m[1].trim().toUpperCase().replace(/\s+/g, " ");
    } catch (e) {}
    return "";
  }
  function openShift(data) { return data.shifts.find(function (s) { return !s.end; }) || null; }
  function shiftMs(s, now) { return new Date(s.end || now || Date.now()) - new Date(s.start); }

  function monthShifts(data, key) {
    return data.shifts
      .filter(function (s) { return s.end && monthKey(new Date(s.start)) === key; })
      .sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
  }
  function monthsAvailable(data) {
    var set = {};
    set[monthKey(new Date())] = true;
    set[viewMonth] = true;
    data.shifts.forEach(function (s) { set[monthKey(new Date(s.start))] = true; });
    return Object.keys(set).sort().reverse();
  }

  // ── summary text (what gets copied / exported) ───────────────────────────
  function monthSummaryText(data, key) {
    var list = monthShifts(data, key);
    var total = list.reduce(function (a, s) { return a + shiftMs(s); }, 0);
    var who = [data.officer.name, data.officer.callsign].filter(Boolean).join(" / ") || "Officer";
    var lines = [];
    lines.push(who + " — " + monthLabel(key) + " — " + fmtHours(hours(total)) + " (" + list.length + " shift" + (list.length === 1 ? "" : "s") + ")");
    list.forEach(function (s) {
      var d = new Date(s.start);
      lines.push(pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "  " + fmtTime(s.start) + "–" + fmtTime(s.end) + "  " + fmtDuration(shiftMs(s)) + (s.callsign ? "  " + s.callsign : "") + (s.note ? "  — " + s.note : ""));
    });
    return lines.join("\n");
  }
  function monthCsv(data, key) {
    var rows = [["date", "start", "end", "hours", "callsign", "note"]];
    monthShifts(data, key).forEach(function (s) {
      var d = new Date(s.start);
      rows.push([d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()), fmtTime(s.start), fmtTime(s.end), String(hours(shiftMs(s))), s.callsign || "", s.note || ""]);
    });
    return rows.map(function (r) { return r.map(function (c) { return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(","); }).join("\n");
  }

  // ── render ────────────────────────────────────────────────────────────────
  function root() { return document.getElementById("shiftRoot"); }

  function render() {
    var host = root();
    if (!host) return;
    var data = load();
    var open = openShift(data);
    var cs = defaultCallsign(data);
    var list = monthShifts(data, viewMonth);
    var total = list.reduce(function (a, s) { return a + shiftMs(s); }, 0);
    var longest = list.reduce(function (a, s) { return Math.max(a, shiftMs(s)); }, 0);
    var now = new Date();

    var html = "";

    // Officer + live shift card
    html += '<div class="card shift-card">' +
      '<h2>⏱ On duty</h2>' +
      '<div class="grid2">' +
        '<label><div class="lbl">Your name</div><input id="shiftOfficerName" data-shift-field="name" placeholder="e.g. SC Smith" value="' + esc(data.officer.name) + '" autocomplete="off"/></label>' +
        '<label><div class="lbl">Callsign</div><input id="shiftOfficerCallsign" data-shift-field="callsign" placeholder="e.g. MEL 205" value="' + esc(cs) + '" autocomplete="off"/></label>' +
      '</div>' +
      (open
        ? '<div class="shift-live"><div class="shift-live-label">ON DUTY SINCE ' + esc(fmtDate(open.start)) + ' ' + esc(fmtTime(open.start)) + (open.callsign ? ' · ' + esc(open.callsign) : '') + '</div>' +
          '<div class="shift-live-clock" id="shiftLiveClock" data-start="' + esc(open.start) + '">' + esc(fmtDuration(shiftMs(open, now))) + '</div>' +
          '<label><div class="lbl">Note (optional)</div><input id="shiftLiveNote" placeholder="e.g. GD patrol, K9 deployment" value="' + esc(open.note || "") + '" autocomplete="off"/></label>' +
          '<div class="shift-actions"><button class="btn shift-btn-end" data-shift-action="end" type="button">■ End shift</button>' +
          '<button class="btn" data-shift-action="discard" type="button" title="Forget this open shift without recording it">Discard</button></div></div>'
        : '<div class="shift-actions"><button class="btn shift-btn-start" data-shift-action="start" type="button">▶ Start shift now</button>' +
          '<span class="hint" style="margin:0"><span>💡</span><span>Press when you log on; press End when you log off. Forgot? Add the shift below.</span></span></div>') +
    '</div>';

    // Manual add card
    var defStart = new Date(now); defStart.setHours(now.getHours() - 2, 0, 0, 0);
    var defEnd = new Date(now); defEnd.setMinutes(0, 0, 0);
    html += '<div class="card shift-card">' +
      '<h2>＋ Add a past shift</h2>' +
      '<div class="grid3">' +
        '<label><div class="lbl">Start</div><input id="shiftAddStart" type="datetime-local" value="' + toLocalInput(defStart) + '"/></label>' +
        '<label><div class="lbl">End</div><input id="shiftAddEnd" type="datetime-local" value="' + toLocalInput(defEnd) + '"/></label>' +
        '<label><div class="lbl">Note (optional)</div><input id="shiftAddNote" placeholder="e.g. Court, training" autocomplete="off"/></label>' +
      '</div>' +
      '<div class="shift-actions"><button class="btn" data-shift-action="add" type="button">Add shift</button></div>' +
    '</div>';

    // Month card
    var monthOpts = monthsAvailable(data).map(function (k) {
      return '<option value="' + k + '"' + (k === viewMonth ? ' selected' : '') + '>' + esc(monthLabel(k)) + '</option>';
    }).join("");
    html += '<div class="card shift-card">' +
      '<div class="shift-month-head"><h2 style="margin:0">📅 Month</h2><select id="shiftMonth" aria-label="Month to show">' + monthOpts + '</select></div>' +
      '<div class="grid3 shift-stats">' +
        '<div class="shift-stat"><div class="shift-stat-lbl">TOTAL HOURS</div><div class="shift-stat-val">' + esc(fmtHours(hours(total))) + '</div></div>' +
        '<div class="shift-stat"><div class="shift-stat-lbl">SHIFTS</div><div class="shift-stat-val">' + list.length + '</div></div>' +
        '<div class="shift-stat"><div class="shift-stat-lbl">LONGEST</div><div class="shift-stat-val">' + esc(list.length ? fmtDuration(longest) : "—") + '</div></div>' +
      '</div>' +
      (list.length
        ? '<table class="rh-table shift-table"><thead><tr><th>Date</th><th>Time</th><th>Length</th><th>Callsign</th><th>Note</th><th></th></tr></thead><tbody>' +
          list.map(function (s) {
            return '<tr><td>' + esc(fmtDate(s.start)) + '</td><td>' + esc(fmtTime(s.start)) + '–' + esc(fmtTime(s.end)) + '</td><td>' + esc(fmtDuration(shiftMs(s))) + '</td><td>' + esc(s.callsign || "") + '</td><td>' + esc(s.note || "") + '</td>' +
              '<td><button class="btn shift-del" data-shift-action="delete" data-shift-id="' + esc(s.id) + '" type="button" aria-label="Delete shift" title="Delete">✕</button></td></tr>';
          }).join("") + '</tbody></table>'
        : '<div class="hint"><span>📭</span><span>No completed shifts in ' + esc(monthLabel(viewMonth)) + ' yet.</span></div>') +
      '<div class="shift-actions">' +
        '<button class="btn" data-shift-action="copy" type="button"' + (list.length ? '' : ' disabled') + '>📋 Copy month summary</button>' +
        '<button class="btn" data-shift-action="csv" type="button"' + (list.length ? '' : ' disabled') + '>⬇ Export CSV</button>' +
      '</div>' +
      '<div class="hint" style="margin-top:8px"><span>💡</span><span>Paste the summary to whoever compiles the monthly hours deck. The log is saved in this browser only — use <strong>⚙ Templates → Export backup</strong> to move it.</span></div>' +
    '</div>';

    host.innerHTML = html;
    startTick();
  }

  function startTick() {
    stopTick();
    var clock = document.getElementById("shiftLiveClock");
    if (!clock) return;
    tickTimer = setInterval(function () {
      var c = document.getElementById("shiftLiveClock");
      if (!c) { stopTick(); return; }
      c.textContent = fmtDuration(Date.now() - new Date(c.dataset.start));
    }, 30000);
  }
  function stopTick() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } }

  // ── actions ───────────────────────────────────────────────────────────────
  function readOfficer(data) {
    var n = document.getElementById("shiftOfficerName");
    var c = document.getElementById("shiftOfficerCallsign");
    data.officer = { name: n ? n.value.trim() : data.officer.name, callsign: c ? c.value.trim().toUpperCase() : data.officer.callsign };
  }

  function act(action, target) {
    var data = load();
    readOfficer(data);
    if (action === "start") {
      if (openShift(data)) { notify("A shift is already running", "warn"); return; }
      data.shifts.push({ id: uid(), start: new Date().toISOString(), end: null, callsign: data.officer.callsign, note: "" });
      if (!save(data)) return;
      notify("Shift started — " + fmtTime(new Date().toISOString()), "ok");
    } else if (action === "end") {
      var o = openShift(data);
      if (!o) return;
      var note = document.getElementById("shiftLiveNote");
      o.end = new Date().toISOString();
      o.note = note ? note.value.trim() : o.note;
      if (!o.callsign) o.callsign = data.officer.callsign;
      viewMonth = monthKey(new Date(o.start));
      if (!save(data)) return;
      notify("Shift logged: " + fmtDuration(shiftMs(o)), "ok");
    } else if (action === "discard") {
      var od = openShift(data);
      if (!od) return;
      if (!confirm("Discard the running shift without recording it?")) return;
      data.shifts = data.shifts.filter(function (s) { return s !== od; });
      if (!save(data)) return;
      notify("Open shift discarded", "warn");
    } else if (action === "add") {
      var sIn = document.getElementById("shiftAddStart"), eIn = document.getElementById("shiftAddEnd"), nIn = document.getElementById("shiftAddNote");
      var s = sIn && sIn.value ? new Date(sIn.value) : null, e = eIn && eIn.value ? new Date(eIn.value) : null;
      if (!s || !e || isNaN(s) || isNaN(e)) { notify("Enter both a start and an end time", "err"); return; }
      if (e <= s) { notify("End must be after start", "err"); return; }
      if (e - s > 24 * 3600000) { notify("A single shift can't be longer than 24 hours", "err"); return; }
      data.shifts.push({ id: uid(), start: s.toISOString(), end: e.toISOString(), callsign: data.officer.callsign, note: nIn ? nIn.value.trim() : "" });
      viewMonth = monthKey(s);
      if (!save(data)) return;
      notify("Shift added: " + fmtDuration(e - s), "ok");
    } else if (action === "delete") {
      var id = target && target.dataset.shiftId;
      var victim = data.shifts.find(function (x) { return x.id === id; });
      if (!victim) return;
      if (!confirm("Delete the shift on " + fmtDate(victim.start) + " (" + fmtDuration(shiftMs(victim)) + ")?")) return;
      data.shifts = data.shifts.filter(function (x) { return x.id !== id; });
      if (!save(data)) return;
      notify("Shift deleted", "ok");
    } else if (action === "copy") {
      var text = monthSummaryText(data, viewMonth);
      var done = function (ok) { notify(ok ? "Month summary copied" : "Copy failed", ok ? "ok" : "err"); };
      if (typeof copyToClipboard === "function") copyToClipboard(text).then(done);
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      save(data);
      return;
    } else if (action === "csv") {
      var csv = monthCsv(data, viewMonth);
      var name = "vicpol-hours-" + viewMonth + (data.officer.callsign ? "-" + data.officer.callsign.replace(/\s+/g, "") : "") + ".csv";
      if (typeof downloadTextFile === "function") downloadTextFile(name, csv, "text/csv");
      save(data);
      return;
    } else {
      return;
    }
    render();
  }

  function bind() {
    var host = root();
    if (!host || host.dataset.bound === "1") return;
    host.dataset.bound = "1";
    host.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-shift-action]");
      if (!btn || btn.disabled) return;
      act(btn.dataset.shiftAction, btn);
    });
    host.addEventListener("change", function (e) {
      if (e.target.id === "shiftMonth") { viewMonth = e.target.value; render(); return; }
      if (e.target.dataset.shiftField) { var d = load(); readOfficer(d); save(d); }
    });
  }

  function initShiftLog() {
    if (!rendered) { bind(); render(); rendered = true; }
    else render();
  }

  // Exposed for interactions.js (tab switch) and tests.
  window.initShiftLog = initShiftLog;
  window.renderShiftLog = render;
  window.shiftLogMonthSummary = function (key) { return monthSummaryText(load(), key || viewMonth); };
})();
