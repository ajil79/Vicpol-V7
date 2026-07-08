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

    var radioRows = (typeof GUIDE_COPY !== "undefined" ? GUIDE_COPY : [])
      .map(function (c) {
        return '<div class="guide-radio-item" data-radio-item="' + c.id + '">' +
          '<button class="guide-radio-toggle" type="button" data-guide-read="' + c.id + '" ' +
            'aria-expanded="false" aria-controls="radioBody-' + c.id + '">' +
            '<span class="guide-radio-label">' + (c.icon ? c.icon + " " : "") + c.label + "</span>" +
            '<span class="guide-radio-chev" aria-hidden="true">▼</span>' +
          "</button>" +
          '<div class="guide-radio-body" id="radioBody-' + c.id + '" role="region">' +
            '<div class="guide-radio-body-inner">' +
              '<div class="guide-radio-text"></div>' +
              '<div class="guide-radio-actions">' +
                '<button class="btn" type="button" data-guide-read-copy="' + c.id + '">📋 Copy</button>' +
              "</div>" +
            "</div>" +
          "</div>" +
        "</div>";
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
        '<div class="muted" style="margin-bottom:10px">Tap one to open the script here for reading out loud — tap again to close. Copy button inside each. Fill in the [BRACKETS].</div>' +
        '<div class="guide-radio-list">' + radioRows + "</div>" +
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

    // Fill each accordion body with the raw script via textContent so the \n
    // line breaks are preserved (CSS white-space:pre-wrap) without HTML escaping.
    (typeof GUIDE_COPY !== "undefined" ? GUIDE_COPY : []).forEach(function (c) {
      var el = host.querySelector('[data-radio-item="' + c.id + '"] .guide-radio-text');
      if (el) el.textContent = c.text;
    });
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

  // ── Inline accordion for radio calls ──────────────────────────────────
  // Tapping a radio-call button expands its script inline right underneath it
  // (big + readable for reading aloud); tap again to collapse. Single-open.
  function setRadioOpen(item, open) {
    item.classList.toggle("open", open);
    var tog = item.querySelector(".guide-radio-toggle");
    if (tog) tog.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function toggleRadioItem(id, forceOpen) {
    var host = root();
    if (!host) return null;
    var target = host.querySelector('[data-radio-item="' + id + '"]');
    if (!target) return null;
    var willOpen = (typeof forceOpen === "boolean") ? forceOpen : !target.classList.contains("open");
    // Single-open: close any other expanded row first.
    host.querySelectorAll(".guide-radio-item.open").forEach(function (it) {
      if (it !== target) setRadioOpen(it, false);
    });
    setRadioOpen(target, willOpen);
    return target;
  }

  // Used by the explainer card's jump buttons: open the matching row and scroll to it.
  function openRadioItem(id, scroll) {
    var target = toggleRadioItem(id, true);
    if (target && scroll) target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handleClick(e) {
    var t = e.target;
    // Scenario picker
    var pick = t.closest ? t.closest("#guideScenarioBtns button[data-scenario]") : null;
    if (pick) { selectScenario(pick.dataset.scenario); return; }
    // Radio-call accordion: a row toggle expands/collapses in place; the same
    // data attribute on an explainer jump button opens that row and scrolls to it.
    var read = t.closest ? t.closest("[data-guide-read]") : null;
    if (read) {
      var rid = read.dataset.guideRead;
      if (read.classList.contains("guide-radio-toggle")) toggleRadioItem(rid);
      else openRadioItem(rid, true);
      return;
    }
    // Copy the script from inside an open accordion row
    var readCopy = t.closest ? t.closest("[data-guide-read-copy]") : null;
    if (readCopy) { copyById(readCopy.dataset.guideReadCopy, readCopy); return; }
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
