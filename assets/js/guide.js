/* Day-to-Day Guide renderer (v7).
   Builds the guide page from assets/data/guide.js into #guideRoot: golden rules,
   copy-and-paste radio calls, a quick reference, and a scenario picker whose jump
   buttons pre-select the matching report type (and warrant ID status) then switch
   to the Report Tool. Standalone — lazily rendered the first time the tab opens
   (see initDayToDayGuide, called from showToolPage in interactions.js).

   Cross-page links reused from the rest of the app:
   - window.showToolPage(page)      — tab switching
   - [data-guide-topic]             — handled globally by recruit-helper.js
*/

(function () {
  "use strict";

  var rendered = false;

  function root() { return document.getElementById("guideRoot"); }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  function flashCopied(btn) {
    if (!btn || btn.dataset.copyFlash === "1") return;
    var original = btn.innerHTML;
    btn.dataset.copyFlash = "1";
    btn.innerHTML = "✓ Copied";
    setTimeout(function () { btn.innerHTML = original; delete btn.dataset.copyFlash; }, 1200);
  }

  function renderGuide() {
    var host = root();
    if (!host || typeof GUIDE_SCENARIOS === "undefined") return;

    var rules = (typeof GUIDE_GOLDEN_RULES !== "undefined" ? GUIDE_GOLDEN_RULES : [])
      .map(function (r) { return "<li>" + r + "</li>"; }).join("");

    var copyBtns = (typeof GUIDE_COPY !== "undefined" ? GUIDE_COPY : [])
      .map(function (c) {
        return '<button class="btn guide-copy-btn" type="button" data-guide-read="' + c.id + '">' +
          (c.icon ? c.icon + " " : "") + c.label + "</button>";
      }).join("");

    var pickerBtns = GUIDE_SCENARIOS.map(function (s, i) {
      return '<button class="btn' + (i === 0 ? " guide-active" : "") + '" type="button" ' +
        'aria-pressed="' + (i === 0 ? "true" : "false") + '" data-scenario="' + s.id + '">' +
        (s.icon ? s.icon + " " : "") + s.label + "</button>";
    }).join("");

    var panels = GUIDE_SCENARIOS.map(function (s, i) {
      return '<div class="guide-scenario' + (i === 0 ? " active" : "") + '" data-scenario="' + s.id + '">' + s.html + "</div>";
    }).join("");

    host.innerHTML =
      // Golden rules
      '<div class="card" style="border-color:var(--accent-glow)">' +
        '<h2 style="margin:0 0 6px">The golden rules — read these first</h2>' +
        '<ul class="guide-steps" style="margin-top:0">' + rules + "</ul>" +
      "</div>" +
      // Copy snippets
      '<div class="card">' +
        '<h2 style="margin:0 0 4px">Radio calls &amp; the caution</h2>' +
        '<div class="muted" style="margin-bottom:10px">Tap one to open it big for reading out loud — there\'s a Copy button inside if you want to paste it. Fill in the [BRACKETS].</div>' +
        '<div class="guide-jump" style="margin-top:0">' + copyBtns + "</div>" +
      "</div>" +
      // Radio comms explainer
      '<div class="card">' +
        '<h2 style="margin:0 0 4px">Radio comms — how they work</h2>' +
        '<div class="muted" style="margin-bottom:12px">What the radio is for, staying professional, and running pursuit comms.</div>' +
        '<div class="guide-info">' + (typeof GUIDE_RADIO_HTML !== "undefined" ? GUIDE_RADIO_HTML : "") + "</div>" +
      "</div>" +
      // Scenario picker
      '<div class="card">' +
        '<h2 style="margin:0 0 4px">Pick your situation</h2>' +
        '<div class="muted" style="margin-bottom:12px">Choose a scenario on the left — the steps open on the right.</div>' +
        '<div class="guide-md">' +
          '<div class="guide-scenario-btns" id="guideScenarioBtns">' + pickerBtns + "</div>" +
          '<div class="guide-scenario-panels">' + panels + "</div>" +
        "</div>" +
      "</div>" +
      // Quick reference
      '<div class="card">' +
        '<h2 style="margin:0 0 10px">Quick reference</h2>' +
        (typeof GUIDE_QUICKREF_HTML !== "undefined" ? GUIDE_QUICKREF_HTML : "") +
      "</div>";
  }

  // Switch to the Report Tool with a report type (and optional warrant ID status)
  // pre-selected. Dispatches real change events so the existing bindings handle
  // state, persistence, card visibility and the preview.
  function jumpToReport(reportType, idStatus) {
    var sel = document.getElementById("reportType");
    if (sel && reportType) {
      sel.value = reportType;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (idStatus) {
      var sw = document.getElementById("swIdStatus");
      if (sw) { sw.value = idStatus; sw.dispatchEvent(new Event("change", { bubbles: true })); }
    }
    if (typeof window.showToolPage === "function") window.showToolPage("report");
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Arrest warrants need the ID basis recorded — point the recruit at it.
    if (idStatus === "CONFIRMED") {
      var basis = document.getElementById("swIdBasis");
      if (basis) { try { basis.focus(); } catch (e) {} }
    }
  }

  function selectScenario(id) {
    var host = root();
    if (!host) return;
    host.querySelectorAll("#guideScenarioBtns button[data-scenario]").forEach(function (b) {
      var on = b.dataset.scenario === id;
      b.classList.toggle("guide-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    host.querySelectorAll(".guide-scenario[data-scenario]").forEach(function (p) {
      p.classList.toggle("active", p.dataset.scenario === id);
    });
  }

  function getCopyEntry(id) {
    if (typeof GUIDE_COPY === "undefined") return null;
    return GUIDE_COPY.filter(function (c) { return c.id === id; })[0] || null;
  }

  function copyById(id, btn) {
    var entry = getCopyEntry(id);
    if (!entry) return;
    copyToClipboard(entry.text).then(function (ok) { if (ok) flashCopied(btn); });
  }

  // ── Read-aloud popup for radio calls ──────────────────────────────────
  // Tapping a radio-call button opens the script big and readable so it can be
  // read out loud on the spot; a Copy button inside keeps the old paste flow.
  var readModalEl = null, readModalTitle = null, readModalText = null, readModalCurrentId = null;

  function buildReadModal() {
    if (readModalEl) return;
    var overlay = document.createElement("div");
    overlay.className = "guide-modal-overlay";
    overlay.id = "guideReadModalOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "guideReadModalTitle");
    overlay.innerHTML =
      '<div class="guide-modal" role="document">' +
        '<h3 class="guide-modal-title" id="guideReadModalTitle"></h3>' +
        '<div class="guide-modal-hint">Read it out loud — fill in anything in [BRACKETS].</div>' +
        '<div class="guide-modal-text" tabindex="0"></div>' +
        '<div class="guide-modal-actions">' +
          '<button class="btn" type="button" data-read-copy>📋 Copy</button>' +
          '<button class="btn guide-modal-close" type="button" data-read-close>Close</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(overlay);
    readModalEl = overlay;
    readModalTitle = overlay.querySelector(".guide-modal-title");
    readModalText = overlay.querySelector(".guide-modal-text");

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) { closeReadModal(); return; }          // backdrop click
      var t = e.target;
      if (t.closest && t.closest("[data-read-close]")) { closeReadModal(); return; }
      var copyBtn = t.closest ? t.closest("[data-read-copy]") : null;
      if (copyBtn) {
        var entry = getCopyEntry(readModalCurrentId);
        if (entry) copyToClipboard(entry.text).then(function (ok) { if (ok) flashCopied(copyBtn); });
      }
    });
  }

  function onReadModalKeydown(e) {
    if (e.key === "Escape" || e.key === "Esc") { e.stopPropagation(); closeReadModal(); }
  }

  function openReadModal(id) {
    var entry = getCopyEntry(id);
    if (!entry) return;
    buildReadModal();
    readModalCurrentId = id;
    readModalTitle.innerHTML = (entry.icon ? entry.icon + " " : "") + entry.label;
    readModalText.textContent = entry.text; // pre-wrap keeps the \n line breaks
    document.body.style.overflow = "hidden";
    readModalEl.classList.add("open");
    document.addEventListener("keydown", onReadModalKeydown, true);
    if (typeof trapFocus === "function") trapFocus(readModalEl.querySelector(".guide-modal") || readModalEl);
  }

  function closeReadModal() {
    if (!readModalEl || !readModalEl.classList.contains("open")) return;
    readModalEl.classList.remove("open");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onReadModalKeydown, true);
    if (typeof releaseFocusTrap === "function") releaseFocusTrap();
    readModalCurrentId = null;
  }

  function handleClick(e) {
    var t = e.target;
    // Scenario picker
    var pick = t.closest ? t.closest("#guideScenarioBtns button[data-scenario]") : null;
    if (pick) { selectScenario(pick.dataset.scenario); return; }
    // Read-aloud popup (radio-call buttons)
    var read = t.closest ? t.closest("[data-guide-read]") : null;
    if (read) { openReadModal(read.dataset.guideRead); return; }
    // Copy snippet (inline scenario buttons)
    var copy = t.closest ? t.closest("[data-guide-copy]") : null;
    if (copy) { copyById(copy.dataset.guideCopy, copy); return; }
    // Jump into a report / other tab
    var jump = t.closest ? t.closest("[data-guide-jump]") : null;
    if (jump) {
      var dest = jump.dataset.guideJump;
      if (dest === "report") jumpToReport(jump.dataset.reportType, jump.dataset.idStatus);
      else if (typeof window.showToolPage === "function") window.showToolPage(dest);
      return;
    }
  }

  function handleKeydown(e) {
    if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
    var card = e.target.closest ? e.target.closest('.guide-branch[role="button"][data-guide-jump]') : null;
    if (!card) return;
    e.preventDefault();
    if (card.dataset.guideJump === "report") jumpToReport(card.dataset.reportType, card.dataset.idStatus);
  }

  function initDayToDayGuide() {
    if (rendered) return;
    if (!root()) return;
    rendered = true;
    renderGuide();
    var host = root();
    host.addEventListener("click", handleClick);
    host.addEventListener("keydown", handleKeydown);
  }

  if (typeof window !== "undefined") {
    window.initDayToDayGuide = initDayToDayGuide;
    window.renderDayToDayGuide = renderGuide;
  }
})();
