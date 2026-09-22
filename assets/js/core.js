/* Core metadata, helpers, state, preset helpers, report visibility config. */

  // Global error reporter. Startup failures used to die silently, leaving the
  // UI half-wired with no clue on devices without a console (mobile). Surface
  // the first few uncaught errors in a small dismissible banner instead.
  window.addEventListener('error', (ev) => {
    try {
      let banner = document.getElementById('vicpolErrorBanner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'vicpolErrorBanner';
        banner.setAttribute('role', 'alert');
        banner.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#5c1a1a;color:#ffd7d7;font:12px/1.5 system-ui,Arial,sans-serif;padding:10px 40px 10px 14px;border-top:2px solid #a33';
        const close = document.createElement('button');
        close.textContent = '✕';
        close.setAttribute('aria-label', 'Dismiss error banner');
        close.style.cssText = 'position:absolute;top:6px;right:8px;background:none;border:none;color:#ffd7d7;font-size:14px;cursor:pointer;padding:4px';
        close.addEventListener('click', () => banner.remove());
        banner.appendChild(close);
        const msgs = document.createElement('div');
        msgs.id = 'vicpolErrorBannerMsgs';
        banner.appendChild(msgs);
        (document.body || document.documentElement).appendChild(banner);
      }
      const msgs = document.getElementById('vicpolErrorBannerMsgs');
      if (msgs && msgs.childElementCount < 3) {
        const where = ev.filename ? ev.filename.split('/').pop() + (ev.lineno ? ':' + ev.lineno : '') : '';
        const line = document.createElement('div');
        line.textContent = '⚠ Something failed to load' + (where ? ' (' + where + ')' : '') + ': ' + (ev.message || 'unknown error') + ' — try a hard refresh.';
        msgs.appendChild(line);
      }
    } catch (e) {}
  });

  const APP_META = {
    name: "VicPol Tool",
    version: "v7",
    fullName: "VicPol Tool v7",
    pageTitle: "VicPol Tool v7",
    reportSubtitle: "Arrest Reports, Warrants, Traffic, Field Contacts, Search & Seizure, Traffic History & Vehicle Inspection",
    utilitySubtitle: "Traffic history lookup remains available while you work.",
    ocrSubtitle: "OCR — licence, LEAP, MELROADS, fingerprint and weapons scanning."
  };
  const APP_TITLE = APP_META.pageTitle;
  const STORAGE_SCHEMA_VERSION = 1;
  const AUTOSAVE_KEY = "vicpol_report_autosave";
  const DRAFTS_KEY = "vicpol_report_drafts";
  const OCR_ASSET_BASE = "assets/vendor/tesseract";
  const OCR_LANG_BASE = "assets/vendor/tessdata";

  // ============================================================================
  // Offline-first note:
  // Charges and PINs are local and fully searchable offline.
  // OCR is configured to load local vendor assets from this deployed site.
  // ============================================================================

  async function ensureTesseract() {
    if (window.Tesseract && typeof window.Tesseract.recognize === "function") return true;
    if (ensureTesseract._loading) return ensureTesseract._loading;
    ensureTesseract._loading = new Promise((resolve) => {
      const existing = document.getElementById("tesseract-script-loader");
      if (existing && window.Tesseract && typeof window.Tesseract.recognize === "function") {
        resolve(true);
        return;
      }
      const s = existing || document.createElement("script");
      s.id = "tesseract-script-loader";
      s.src = `${OCR_ASSET_BASE}/tesseract.min.js`;
      s.async = true;
      s.crossOrigin = "anonymous";
      const timeout = setTimeout(() => {
        ensureTesseract._loading = null;
        resolve(false);
        if (typeof toast === "function") toast("OCR assets are missing from this deployment", "warn");
      }, 10000);
      s.onload = () => {
        clearTimeout(timeout);
        resolve(!!(window.Tesseract && typeof window.Tesseract.recognize === "function"));
        if (typeof updateOcrAvailability === 'function') updateOcrAvailability();
      };
      s.onerror = () => {
        clearTimeout(timeout);
        ensureTesseract._loading = null;
        resolve(false);
        if (typeof toast === "function") toast("OCR assets are missing from this deployment", "warn");
        if (typeof updateOcrAvailability === 'function') updateOcrAvailability();
      };
      if (!existing) document.head.appendChild(s);
    });
    return ensureTesseract._loading;
  }

  // ============================================================================
  // CHARGES AND PINS DATABASES (Refreshed from uploaded BBRP MelPol Charges, Fines & Templates 2025 workbook)
  // ============================================================================
  
// ============================================================================
// Charges and PINs databases are loaded from external files to keep the main app smaller.
// ============================================================================
const CHARGES = Array.isArray(window.CHARGES) ? window.CHARGES : [];
const PINS = Array.isArray(window.PINS) ? window.PINS : [];



  // ============================================================================
  // OPTIMIZED VERSION with Complete Feature Set
  // - Debounced preview rendering
  // - Throttled autosave  
  // - Consolidated event listeners
  // - Legacy warrant boilerplate
  // - Traffic warrant boilerplate
  // - All original features preserved
  // ============================================================================

  // Utilities
  function debounce(fn, ms) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function throttle(fn, ms) {
    let lastRan;
    let trailTimer;
    return function(...args) {
      const ctx = this;
      if (!lastRan || Date.now() - lastRan >= ms) {
        clearTimeout(trailTimer);
        fn.apply(ctx, args);
        lastRan = Date.now();
      } else {
        // Schedule a trailing-edge call so the very last change always fires
        clearTimeout(trailTimer);
        trailTimer = setTimeout(() => {
          fn.apply(ctx, args);
          lastRan = Date.now();
        }, ms - (Date.now() - lastRan));
      }
    };
  }

  function deepClone(obj) {
    try { return (typeof structuredClone === "function") ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)); }
    catch(e) { return JSON.parse(JSON.stringify(obj)); }
  }

  function norm(v) {
    return (v || "").toString().trim();
  }

  function setIfPresent(target, key, value, overwrite = false) {
    if (!target) return false;
    const clean = norm(value);
    if (!clean) return false;
    if (overwrite || !norm(target?.[key])) {
      target[key] = clean;
      return true;
    }
    return false;
  }

  function getLinkedReportSeed(context = "generic") {
    const sw = state.vicpolWarrant || {};
    const offender = state.offender || {};

    return {
      name: norm(offender.name) || norm(sw.warrantName) || norm(sw.owner),
      dob: norm(offender.dob),
      sex: norm(offender.sex),
      address: norm(offender.address),
      phone: norm(offender.phone),
      rego: norm(sw.rego),
      model: norm(sw.model),
      location: norm(state.prelimLocation),
      time: norm(state.prelimTime),
      date: norm(state.prelimDate),
      enteredBy: norm(state.enteredBy),
      reportDateTime: norm(state.reportDateTime)
    };
  }

  function composeDateTime(dateValue = "", timeValue = "") {
    const datePart = norm(dateValue);
    const timePart = norm(timeValue);
    if (datePart && timePart) return `${datePart} ${timePart}`;
    return datePart || timePart || "";
  }

  function getHeaderDateTime(fallbackDate = "", fallbackTime = "") {
    return norm(state.reportDateTime) || composeDateTime(fallbackDate, fallbackTime) || "NIL";
  }

  function getHeaderEnteredBy() {
    return norm(state.enteredBy) || [norm(state.sigRank), norm(state.sigName)].filter(Boolean).join(" ") || "NIL";
  }

  function getHeaderUnit() {
    return norm(state.enteredUnit) || norm(state.sigDivision) || "";
  }

  function updateSharedWarrantCardMeta() {
    const title = document.getElementById('sharedWarrantCardTitle');
    const hint = document.getElementById('sharedWarrantCardHint');
    if (!title || !hint) return;
    const type = sanitizeVicPolReportType(state.reportType);
    if (["vicpol_arrest", "vicpol_warrant"].includes(type)) {
      title.textContent = 'VicPol Subject & Vehicle Details';
      hint.innerHTML = '<span>🔗</span><span>Shared subject and vehicle fields for VicPol warrant-style paperwork. This card supports VicPol warrant outputs only.</span>';
      return;
    }
    if (type === 'traffic_warrant') {
      title.textContent = 'Vehicle Details';
      hint.innerHTML = '<span>🔗</span><span>Vehicle details used to support traffic warrant paperwork on the VicPol side.</span>';
      return;
    }
    title.textContent = 'Subject / Vehicle Details';
    hint.innerHTML = '<span>🔗</span><span>Shared subject and vehicle fields used where warrant-linked details are needed on the VicPol side.</span>';
  }
function enforceVicpolWarrantIdStatus(showToast = false) {
  const wantsConfirmed = norm(state.vicpolWarrant?.idStatus) === "CONFIRMED";
  const basis = norm(state.vicpolWarrant?.idBasis);
  const warnNode = el.swIdStatusWarn;
  if (wantsConfirmed && !basis) {
    state.vicpolWarrant.idStatus = "UNCONFIRMED";
    if (el.swIdStatus) el.swIdStatus.value = "UNCONFIRMED";
    if (warnNode) {
      warnNode.style.display = "block";
      warnNode.textContent = "ID confirmed warrants are only for when the person actually showed ID. Add the confirmation basis first, otherwise this stays ID unconfirmed.";
    }
    if (showToast) toast("Add an ID confirmation basis before setting ID confirmed", "warn");
    return false;
  }
  if (warnNode) {
    if (basis) {
      warnNode.style.display = "block";
      warnNode.textContent = `ID confirmation basis recorded: ${basis}`;
    } else {
      warnNode.style.display = "none";
      warnNode.textContent = "";
    }
  }
  return true;
}


  function syncReportSubjectInto(targetKey, options = {}) {
    const { overwrite = false, includePerson = true, includePrelim = false, showToast = true } = options;
    const seed = getLinkedReportSeed();
    const target = targetKey === 'fieldContact' ? state.fieldContact : state.searchSeizure;
    let changed = false;

    if (includePerson) {
      changed = setIfPresent(target, 'name', seed.name, overwrite) || changed;
      changed = setIfPresent(target, 'dob', seed.dob, overwrite) || changed;
      changed = setIfPresent(target, 'phone', seed.phone, overwrite) || changed;
    }
    if (includePrelim) {
      changed = setIfPresent(target, 'time', seed.time, overwrite) || changed;
      changed = setIfPresent(target, 'date', seed.date, overwrite) || changed;
      changed = setIfPresent(target, 'location', seed.location, overwrite) || changed;
    }

    if (targetKey === 'fieldContact') {
      if (el.fcName) el.fcName.value = target.name || '';
      if (el.fcDOB) el.fcDOB.value = target.dob || '';
      if (el.fcPhone) el.fcPhone.value = target.phone || '';
      if (el.fcTime) el.fcTime.value = target.time || '';
      if (el.fcDate) el.fcDate.value = target.date || '';
      if (el.fcLocation) el.fcLocation.value = target.location || '';
    } else {
      if (el.ssName) el.ssName.value = target.name || '';
      if (el.ssDOB) el.ssDOB.value = target.dob || '';
      if (el.ssPhone) el.ssPhone.value = target.phone || '';
      if (el.ssTime) el.ssTime.value = target.time || '';
      if (el.ssDate) el.ssDate.value = target.date || '';
      if (el.ssLocation) el.ssLocation.value = target.location || '';
    }

    debouncedRenderPreview();
    throttledAutosave();
    if (showToast) {
      const label = targetKey === 'fieldContact' ? 'Field Contact' : 'Search & Seizure';
      toast(changed ? `${label} linked details updated` : `No linked details available for ${label}`, changed ? 'ok' : 'warn');
    }
  }


  function ensureLines(text) {
    return (text || "").toString().replace(/\r/g, "").trim();
  }

  function dedupeLines(text) {
    const lines = ensureLines(text).split("\n").map(l => l.trim()).filter(Boolean);
    return [...new Set(lines)].join("\n");
  }

  function getLines(text) {
    return ensureLines(text).split("\n").map(l => l.trim()).filter(Boolean);
  }

  function normalizeGeneratedReport(text) {
    return String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map(line => line.replace(/[ \t]+$/g, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\n+$/g, "")
      .trim();
  }

  function escapeHtml(str) {
    const s = String(str || "");
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function deepMerge(defaults, saved) {
    const out = { ...defaults };
    for (const key of Object.keys(saved)) {
      if (
        saved[key] !== null &&
        typeof saved[key] === 'object' &&
        !Array.isArray(saved[key]) &&
        defaults[key] !== null &&
        typeof defaults[key] === 'object' &&
        !Array.isArray(defaults[key])
      ) {
        // Recursively merge nested objects so new fields added to defaults
        // in future versions are not lost when loading old saved states.
        out[key] = deepMerge(defaults[key], saved[key]);
      } else {
        out[key] = saved[key];
      }
    }
    return out;
  }

  function packStoredValue(payload) {
    return JSON.stringify({ schema: STORAGE_SCHEMA_VERSION, payload });
  }

  function unpackStoredValue(raw, fallback) {
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'payload')) {
      // Newer schema than this build understands: still hand back the payload
      // (deepMerge against INITIAL_STATE tolerates unknown fields) but say so.
      if (typeof parsed.schema === 'number' && parsed.schema > STORAGE_SCHEMA_VERSION) {
        console.warn('[vicpol] stored value uses schema ' + parsed.schema + ' (this build: ' + STORAGE_SCHEMA_VERSION + ')');
      }
      return parsed.payload;
    }
    return parsed;
  }

  function readStoredJson(key, fallback) {
    try {
      return unpackStoredValue(localStorage.getItem(key), fallback);
    } catch (_) {
      return fallback;
    }
  }

  function writeStoredJson(key, payload) {
    return safeLocalStorageSet(key, packStoredValue(payload));
  }

    // ============================================================================
  // CHARGE & PIN SELECTION LOGIC
  // ============================================================================
  let selectedChargesSet = new Set();

  const ENTRY_UI_ALIASES = {
    "Owner Fail to provide details of driver of their motor vehicle": "Owner failed to provide driver details for their motor vehicle",
    "Not reverse vehicle safely": "Did not reverse the vehicle safely",
    "use/ Allow Use Of Horn/Warning Device Unnecessarily": "Used or allowed a horn or warning device unnecessarily",
    "Carry Handcuff Key Without Legal Authority": "Carried a handcuff key without legal authority"
  };

  function getEntryUiAlias(name) {
    return ENTRY_UI_ALIASES[name] || "";
  }

  // ── Charge / PIN search: ranked, word-order-free, typo-tolerant ──
  const normSearchText = (str) => String(str || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

  // Shorthand officers actually type → words that appear in the charge/PIN names.
  const SEARCH_SHORTHAND = [
    [/\bb and e\b/g, 'breaking entering'],
    [/\b(dui|dwi|drink(ing)? driv(e|ing)|drunk driv(e|ing)|pca)\b/g, 'bac'],
    [/\bdrug driv(e|ing)\b/g, 'drug detected'],
    [/\badw\b/g, 'assault deadly weapon'],
    [/\bfpo\b/g, 'firearm prohibition'],
    [/\bgta\b/g, 'theft motor vehicle'],
    [/\bccw\b/g, 'concealed'],
    [/\bspeeding\b/g, 'speed'],
    [/\bseatbelt\b/g, 'seat belt'],
    [/\bjay ?walk(ing)?\b/g, 'j walking'],
    [/\bhit ?n ?run\b/g, 'hit run'],
    [/\blicen[cs]ed\b/g, 'licensed'],
    [/\blicen[cs]e\b/g, 'license'],
    [/\b(ems|ambo|ambulance|paramedics?)\b/g, 'emergency'],
    [/\bcops?\b/g, 'police'],
    [/\brego\b/g, 'registered']
  ];
  const SEARCH_STOPWORDS = new Set(['and', 'or', 'of', 'the', 'a', 'an', 'to', 'in', 'on', 'for', 'with', 'by', 'at']);

  // Optimal-string-alignment distance (handles swapped letters: "assualt"),
  // bailing out once it can no longer come in under `max`.
  function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur.push(v);
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }

  const _searchIndexCache = new WeakMap();
  function getEntrySearchIndex(entry) {
    let idx = _searchIndexCache.get(entry);
    if (!idx) {
      const name = normSearchText(entry?.name);
      const other = normSearchText([getEntryUiAlias(entry?.name || ''), entry?.notes, entry?.cat].filter(Boolean).join(' '));
      const aliasWords = normSearchText(getEntryUiAlias(entry?.name || '')).split(' ').filter(Boolean);
      idx = {
        name,
        other,
        nameWords: name.split(' ').filter(Boolean),
        otherWords: other.split(' ').filter(Boolean),
        fuzzyWords: [...new Set(name.split(' ').concat(aliasWords).filter(w => w.length >= 3))]
      };
      _searchIndexCache.set(entry, idx);
    }
    return idx;
  }

  function parseSearchQuery(raw) {
    let q = normSearchText(raw);
    SEARCH_SHORTHAND.forEach(([re, to]) => { q = q.replace(re, to); });
    let tokens = q.split(' ').filter(Boolean);
    const content = tokens.filter(t => !SEARCH_STOPWORDS.has(t));
    if (content.length) tokens = content;
    return { phrase: tokens.join(' '), tokens: [...new Set(tokens)] };
  }

  // Score one query token against one entry. 0 = no match.
  function scoreSearchToken(t, idx) {
    let best = 0, fix = '';
    // 1–2 letters (the first keystrokes): only the start of a real word in the
    // name counts, otherwise "a" matches nearly every charge via "a"/"and".
    const short = t.length <= 2;
    for (const w of idx.nameWords) {
      if (short && SEARCH_STOPWORDS.has(w)) continue;
      if (w === t) return { score: 10, fix: '' };
      if (w.startsWith(t)) best = Math.max(best, 8);
    }
    if (best) return { score: best, fix: '' };
    if (short) return { score: 0, fix: '' };
    if (idx.name.includes(t)) return { score: 6, fix: '' };
    for (const w of idx.otherWords) if (w.startsWith(t)) return { score: 4, fix: '' };
    if (t.length >= 3 && idx.other.includes(t)) return { score: 2, fix: '' };
    // Autocorrect: typo-tolerant against name words, also against the start of a
    // longer word so a half-typed misspelling ("asual") still finds "assault".
    if (t.length >= 4) {
      const max = t.length >= 7 ? 2 : 1;
      let bestD = max + 1;
      for (const w of idx.fuzzyWords) {
        const d = Math.min(
          editDistance(t, w, max),
          w.length > t.length ? editDistance(t, w.slice(0, t.length), max) : max + 1,
          w.length > t.length + 1 ? editDistance(t, w.slice(0, t.length + 1), max) : max + 1
        );
        if (d < bestD) { bestD = d; fix = w; }
      }
      if (bestD <= max) return { score: 1, fix };
    }
    return { score: 0, fix: '' };
  }

  // Returns { results, corrections, parsed } — results ranked best-first.
  function searchEntries(list, rawQuery) {
    const parsed = parseSearchQuery(rawQuery);
    if (!parsed.tokens.length) return { results: list.slice(), corrections: [], parsed };
    const exactHit = new Set();
    const scored = [];
    list.forEach((entry, order) => {
      const idx = getEntrySearchIndex(entry);
      let total = 0;
      const fixes = {};
      for (const t of parsed.tokens) {
        const r = scoreSearchToken(t, idx);
        if (!r.score) return;
        total += r.score;
        if (r.fix) fixes[t] = r.fix; else exactHit.add(t);
      }
      if (idx.name.startsWith(parsed.phrase)) total += 6;
      else if (parsed.phrase.length >= 3 && idx.name.includes(parsed.phrase)) total += 3;
      scored.push({ entry, total, order, fixes });
    });
    scored.sort((a, b) => b.total - a.total || a.order - b.order);
    // Only call it a correction when nothing matched the token as typed.
    const corrections = [];
    parsed.tokens.forEach(t => {
      if (exactHit.has(t)) return;
      const top = scored.find(s => s.fixes[t]);
      if (top) corrections.push({ from: t, to: top.fixes[t] });
    });
    return { results: scored.map(s => s.entry), corrections, parsed };
  }

  // "Did you mean" row above a charge/PIN list; clicking it applies the fix.
  function renderSearchCorrectionHint(listEl, inputEl, corrections) {
    if (!corrections.length || !listEl || !inputEl) return;
    const fixed = corrections.reduce((q, c) => q.replace(new RegExp('\\b' + c.from + '\\b', 'gi'), c.to), normSearchText(inputEl.value));
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search-autocorrect';
    btn.innerHTML = 'Did you mean <strong>' + escapeHtml(fixed) + '</strong>? Showing those matches';
    btn.addEventListener('click', () => {
      inputEl.value = fixed;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.focus();
    });
    listEl.appendChild(btn);
  }

  let selectedPinsSet = new Set();

  function initChargeFilters() {
    const chargeCats = [...new Set(CHARGES.map(c => c.cat))].sort();
    const pinCats = [...new Set(PINS.map(p => p.cat))].sort();
    
    if (el.chargeFilter) {
      chargeCats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        el.chargeFilter.appendChild(opt);
      });
    }
    
    if (el.pinFilter) {
      pinCats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        el.pinFilter.appendChild(opt);
      });
    }
  }

  // Handbook rule: max 3 charges and 3 PINs without VicPol leadership approval.
  function updateApprovalWarn(warnId, count, noun) {
    const warnEl = document.getElementById(warnId);
    if (!warnEl) return;
    const over = count > 3;
    warnEl.style.display = over ? "flex" : "none";
    const textEl = warnEl.querySelector("span");
    if (over && textEl) textEl.textContent = "⚠ " + count + " " + noun + " selected — more than 3 requires VicPol leadership approval";
  }

  function renderSelectedCharges() {
    if (!el.selectedCharges) return;
    el.selectedCharges.innerHTML = "";

    // Update count badge
    const countEl = document.getElementById("chargeCount");
    if (countEl) countEl.textContent = selectedChargesSet.size > 0 ? `(${selectedChargesSet.size} selected)` : "";

    updateApprovalWarn("chargeApprovalWarn", selectedChargesSet.size, "charges");

    if (selectedChargesSet.size === 0) {
      el.selectedCharges.innerHTML = '<div class="muted" style="padding:4px">No charges selected</div>';
      calculateBailAmount(); // Update bail when no charges
      updateChargeFineTotal(); // Hide running fine total when no charges remain
      return;
    }

    selectedChargesSet.forEach(chargeName => {
      const tag = document.createElement('span');
      tag.style.cssText = "display:inline-flex; gap:8px; align-items:center; padding:6px 10px; border-radius:999px; border:1px solid var(--border); background:rgba(0,0,0,0.3); font-size:11px; font-weight:800";

      const label = document.createElement('span');
      const chargeAlias = getEntryUiAlias(chargeName);
      if (chargeAlias) {
        label.innerHTML = '<div>' + escapeHtml(chargeName) + '</div><div style="font-size:10px;color:var(--muted);font-weight:700;margin-top:2px">Plain English: ' + escapeHtml(chargeAlias) + '</div>';
        label.title = 'Stored/exported as: ' + chargeName;
      } else {
        label.textContent = chargeName;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '×';
      btn.setAttribute('aria-label', 'Remove charge');
      btn.dataset.charge = chargeName;
      btn.style.cssText = "border:none; background:transparent; color:rgba(255,255,255,0.85); cursor:pointer; font-weight:900; padding:0 2px; line-height:1";

      tag.appendChild(label);
      tag.appendChild(btn);
      el.selectedCharges.appendChild(tag);
    });

    calculateBailAmount(); // Update bail when charges change
    updateChargeFineTotal(); // Update running fine total
  }

  function updateChargeFineTotal() {
    const totalEl = document.getElementById("chargeFineTotal");
    const amountEl = document.getElementById("chargeFineAmount");
    if (!totalEl || !amountEl) return;
    if (selectedChargesSet.size === 0) {
      totalEl.style.display = "none";
      return;
    }
    let minTotal = 0, maxTotal = 0;
    selectedChargesSet.forEach(chargeName => {
      const charge = CHARGES.find(c => c.name === chargeName);
      if (charge && charge.cost) {
        const costStr = charge.cost.replace(/,/g, '');
        const range = costStr.match(/(\d+)\s*-\s*(\d+)/);
        if (range) {
          minTotal += parseInt(range[1]);
          maxTotal += parseInt(range[2]);
        } else {
          const single = costStr.match(/(\d+)/);
          if (single) { minTotal += parseInt(single[1]); maxTotal += parseInt(single[1]); }
        }
      }
    });
    totalEl.style.display = "flex";
    if (minTotal === maxTotal) {
      amountEl.textContent = '$' + maxTotal.toLocaleString();
    } else {
      amountEl.textContent = '$' + minTotal.toLocaleString() + ' – $' + maxTotal.toLocaleString();
    }
  }

  function renderSelectedPins() {
    if (!el.selectedPins) return;
    el.selectedPins.innerHTML = "";

    // Update count badge with demerit points total
    const countEl = document.getElementById("pinCount");
    if (countEl) {
      if (selectedPinsSet.size > 0) {
        let totalPts = 0;
        selectedPinsSet.forEach(pinName => {
          const pin = PINS.find(p => p.name === pinName);
          if (pin && pin.points) {
            const m = pin.points.match(/(\d+)\s*pts?/i);
            if (m) totalPts += parseInt(m[1]);
          }
        });
        countEl.textContent = `(${selectedPinsSet.size} selected, ${totalPts} pts)`;
      } else {
        countEl.textContent = "";
      }
    }

    updateApprovalWarn("pinApprovalWarn", selectedPinsSet.size, "PINs");

    if (selectedPinsSet.size === 0) {
      el.selectedPins.innerHTML = '<div class="muted" style="padding:4px">No PINs selected</div>';
      return;
    }

    selectedPinsSet.forEach(pinName => {
      const tag = document.createElement('span');
      tag.style.cssText = "display:inline-flex; gap:8px; align-items:center; padding:6px 10px; border-radius:999px; border:1px solid var(--border); background:rgba(0,0,0,0.3); font-size:11px; font-weight:800";

      const label = document.createElement('span');
      const pinAlias = getEntryUiAlias(pinName);
      if (pinAlias) {
        label.innerHTML = '<div>' + escapeHtml(pinName) + '</div><div style="font-size:10px;color:var(--muted);font-weight:700;margin-top:2px">Plain English: ' + escapeHtml(pinAlias) + '</div>';
        label.title = 'Stored/exported as: ' + pinName;
      } else {
        label.textContent = pinName;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '×';
      btn.setAttribute('aria-label', 'Remove PIN');
      btn.dataset.pin = pinName;
      btn.style.cssText = "border:none; background:transparent; color:rgba(255,255,255,0.85); cursor:pointer; font-weight:900; padding:0 2px; line-height:1";

      tag.appendChild(label);
      tag.appendChild(btn);
      el.selectedPins.appendChild(tag);
    });
  }

  function calculateBailAmount() {
    // Only relevant in bail_conditions mode
    if (state.reportType !== 'bail_conditions') return 0;
    let baseTotal = 0;
    
    // Calculate from selected charges
    selectedChargesSet.forEach(chargeName => {
      const charge = CHARGES.find(c => c.name === chargeName);
      if (charge && charge.cost) {
        const costStr = charge.cost.replace(/,/g, '');
        const match = costStr.match(/(\d+)\s*-\s*(\d+)/);
        if (match) {
          baseTotal += parseInt(match[2]);
        } else {
          const singleMatch = costStr.match(/(\d+)/);
          if (singleMatch) {
            baseTotal += parseInt(singleMatch[1]);
          }
        }
      }
    });
    
    // Parse LEAP Criminal History for unpaid charges
    const leapHistory = document.getElementById('bcLeapHistory');
    let leapTotal = 0;
    if (leapHistory && leapHistory.value) {
      const lines = leapHistory.value.split('\n');
      lines.forEach(line => {
        // Match pattern: Date    P?    Amount    Offence
        // Looking for "N" in P? column and dollar amount
        const match = line.match(/(\d{2}\/\d{2}\/\d{4})\s+N\s+\$?([\d,]+)/);
        if (match) {
          const amount = parseInt(match[2].replace(/,/g, ''));
          if (!isNaN(amount)) {
            leapTotal += amount;
          }
        }
      });
    }
    
    let total = baseTotal + leapTotal;
    
    // Apply multipliers
    const orgMember = document.getElementById('bcOrgMember')?.checked;
    const violence = document.getElementById('bcViolence')?.checked;
    const fpo = document.getElementById('bcFPO')?.checked;
    
    let multiplier = 1;
    if (orgMember) multiplier *= 1.5;
    if (violence) multiplier *= 1.25;
    if (fpo) multiplier *= 1.25;
    
    total = Math.round(total * multiplier);
    
    // Update display
    const calculatedBail = document.getElementById('calculatedBail');
    if (calculatedBail) {
      calculatedBail.textContent = '$' + total.toLocaleString();
    }
    
    // Update breakdown
    const breakdown = document.getElementById('bailBreakdown');
    if (breakdown) {
      let parts = [];
      if (baseTotal > 0) parts.push(`Current charges: $${baseTotal.toLocaleString()}`);
      if (leapTotal > 0) parts.push(`Unpaid LEAP charges: $${leapTotal.toLocaleString()}`);
      if (multiplier > 1) {
        const multipliers = [];
        if (orgMember) multipliers.push('Violent org (×1.5)');
        if (violence) multipliers.push('Violence flag (×1.25)');
        if (fpo) multipliers.push('FPO (×1.25)');
        parts.push(`Multipliers: ${multipliers.join(', ')}`);
      }
      breakdown.textContent = parts.length > 0 ? parts.join(' + ') : 'Select charges or paste LEAP history to calculate';
    }
    
    return total;
  }

  function useBailAmount() {
    const total = calculateBailAmount();
    const bcBailAmount = document.getElementById('bcBailAmount');
    if (bcBailAmount) {
      bcBailAmount.value = '$' + total.toLocaleString();
      state.bailConditions.bailAmount = bcBailAmount.value;
      debouncedRenderPreview();
      throttledAutosave();
    }
  }

  window.useBailAmount = useBailAmount;

  // ============================================================================
  // SENTENCE SUGGESTION
  // ============================================================================
  // Charge names that trigger attempted murder EMS rules
  const ATTEMPTED_MURDER_EMS_CHARGES = [
    "Attempted Murder on Emergency Services",
    "Attempted Murder on Public Officer"
  ];

  function updateSentenceSuggestion() {
    const textEl = document.getElementById("sentenceSuggestionText");
    if (!textEl) return;

    if (selectedChargesSet.size === 0) {
      textEl.innerHTML = '<span style="color:var(--muted);font-size:13px">No charges selected</span>';
      return;
    }

    let hasIndictable = false;
    let hasComServ = false;
    let hasAttemptedMurderEMS = false;
    const chargeDetails = [];

    selectedChargesSet.forEach(chargeName => {
      const charge = CHARGES.find(c => c.name === chargeName);
      if (!charge) return;
      const isIndictable = charge.sentenceType === "Indictable" || charge.sentenceType === "NI/I";
      if (isIndictable) hasIndictable = true;
      else hasComServ = true;
      if (ATTEMPTED_MURDER_EMS_CHARGES.includes(chargeName)) hasAttemptedMurderEMS = true;
      chargeDetails.push({ name: chargeName, type: charge.sentenceType });
    });

    let html = "";
    let suggestionText = "";

    if (hasIndictable) {
      // ── Standard indictable range ──────────────────────────────────────
      const isEMS = hasAttemptedMurderEMS;
      const minWeeks = isEMS ? 80 : 40;
      const maxWeeks = isEMS ? 90 : 90;
      suggestionText = minWeeks + "-" + maxWeeks + " Weeks MRC";

      const rangeColor = isEMS ? "rgba(255,80,80,0.9)" : "rgba(100,200,255,0.9)";
      const warningHtml = isEMS
        ? '<div style="margin-top:6px;padding:6px 10px;background:rgba(255,40,40,0.12);border:1px solid rgba(255,80,80,0.3);border-radius:6px;font-size:11px;color:rgba(255,160,160,0.95)">⚠ Attempted Murder (EMS/AV/CFA) — minimum 80 weeks without leadership approval</div>'
        : "";

      html = '<div style="font-size:18px;font-weight:900;color:' + rangeColor + ';margin-bottom:2px">🔒 ' + suggestionText + '</div>'
        + '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Standard officer discretion — no approval needed</div>'
        + warningHtml
        + '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">'
        + '<div style="font-size:10px;font-weight:900;color:var(--muted);letter-spacing:0.08em;margin-bottom:6px">WITH LEADERSHIP APPROVAL</div>'
        + '<div style="display:grid;gap:4px">'
        + _tierRow("A/LSC+", "Up to 110 weeks", "rgba(255,180,50,0.8)")
        + _tierRow("SGT+",   "Up to 150 weeks", "rgba(255,120,30,0.8)")
        + _tierRow("SGT+ (Attempted Murder AV/CFA with FPO)", "Up to 250 weeks", "rgba(255,60,60,0.8)")
        + _tierRow("Magistrate", "Up to 450 weeks (900 weeks for FPO breach)", "rgba(200,60,255,0.8)")
        + "</div></div>";
    } else if (hasComServ) {
      // ── Community service ──────────────────────────────────────────────
      suggestionText = "6-18 Actions Community Service";
      html = '<div style="font-size:18px;font-weight:900;color:rgba(100,220,140,0.9);margin-bottom:2px">🔒 ' + suggestionText + '</div>'
        + '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Standard officer discretion — no approval needed. Max 8 actions per charge.</div>'
        + '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">'
        + '<div style="font-size:10px;font-weight:900;color:var(--muted);letter-spacing:0.08em;margin-bottom:6px">WITH LEADERSHIP APPROVAL</div>'
        + '<div style="display:grid;gap:4px">'
        + _tierRow("Any leadership", "Up to 60 actions", "rgba(255,180,50,0.8)")
        + "</div></div>";
    }

    const chargeListHtml = '<div style="margin-top:8px;font-size:11px;color:var(--muted)">'
      + chargeDetails.map(c => '<span style="margin-right:8px">▸ ' + escapeHtml(c.name) + ' <span style="opacity:0.6">(' + escapeHtml(c.type) + ')</span></span>').join("")
      + "</div>";

    textEl.innerHTML = html + chargeListHtml;

  }

  function _tierRow(label, value, color) {
    return '<div style="display:flex;align-items:baseline;gap:8px;padding:3px 6px;background:rgba(255,255,255,0.03);border-radius:4px">'
      + '<span style="font-size:11px;font-weight:900;color:' + color + ';min-width:120px;flex-shrink:0">' + label + '</span>'
      + '<span style="font-size:11px;color:rgba(255,255,255,0.7)">' + value + '</span>'
      + '</div>';
  }

  // ============================================================================
  // v47.2: SMART NARRATIVE PROMPTS
  // ============================================================================
  // Maps charge name patterns to contextual writing reminders
  const NARRATIVE_HINT_RULES = [
    {
      match: /evade|fail.*stop|pursuit/i, topic: "code4-flee",
      hints: [
        "Pursuit duration (approx. start/end times)",
        "Route taken / direction of travel",
        "How the pursuit ended (voluntary stop, crash, boxed in, vehicle breakdown, abandoned)",
        "Speeds reached and zones driven through",
        "Any vehicle swaps or dangerous driving observed",
        "Was a pursuit authorisation obtained? From whom?"
      ]
    },
    {
      match: /murder|manslaughter|attempt.*murder|shots?\s*fired|discharge/i, topic: "use-of-force",
      hints: [
        "Weapon type, serial number, and ammo count for every weapon",
        "Who discharged their weapon and how many rounds",
        "GSR test result (positive/negative) for suspect and officers",
        "Exact threat that justified use of lethal force — state BEFORE the response",
        "Victims: names, injuries sustained, medical response",
        "Scene preservation — who secured the scene, when"
      ]
    },
    {
      match: /assault|injur|violence|battery|wound/i, topic: "use-of-force",
      hints: [
        "Force justification — what threat did the suspect pose?",
        "Injuries sustained by all parties (suspect, officers, victims)",
        "Was MAS/AV called? Did they attend? Who rendered first aid?",
        "Victim details: name, injuries, statement taken?",
        "Photographs of injuries taken?"
      ]
    },
    {
      match: /robbery|armed|steal|theft|burglary|break.*enter/i, topic: "search-seizure",
      hints: [
        "Property stolen / recovered — descriptions and values",
        "Victim(s) details and statements",
        "Weapon used during offence (if applicable)",
        "CCTV footage secured from scene?",
        "How suspect was identified (witness, CCTV, plates, forensics)"
      ]
    },
    {
      match: /drug|narcotic|substance|possess.*controlled|manufacture|traffic.*drug/i, topic: "drugs",
      hints: [
        "Type and quantity of substance found",
        "NIK kit test result (positive/negative) and substance identified",
        "Location where substance was found (on person, in vehicle, in premises)",
        "Packaging — consistent with personal use or supply/trafficking?",
        "Cash or paraphernalia found alongside?"
      ]
    },
    {
      match: /weapon|firearm|pistol|rifle|knife|prohibited|carry.*weapon|possess.*weapon/i, topic: "charges-pins",
      hints: [
        "Weapon type, make/model, and serial number",
        "Ammunition type and count",
        "Where was the weapon located (on person, in vehicle, at premises)?",
        "Does the suspect hold a valid weapons licence?",
        "Photo of weapon taken and logged as evidence?"
      ]
    },
    {
      match: /speed|dangerous.*driv|reckless.*driv|DUI|drink.*driv|impaired|exceed.*limit/i, topic: "rbt-rdt",
      hints: [
        "Speed recorded vs. speed limit of the zone",
        "Method of speed detection (radar, lidar, pacing, estimated)",
        "Road and weather conditions at the time",
        "Breath/drug test result if applicable",
        "Was the driver's licence suspended on the spot?"
      ]
    },
    {
      match: /resist|obstruct|hinder|fail.*comply|refuse.*direction/i, topic: "arrest-caution",
      hints: [
        "What lawful direction was given and by whom?",
        "How did the suspect resist or obstruct? (verbal, physical, passive)",
        "Was reasonable force used to effect arrest? Describe.",
        "Any injuries to officers during the arrest?"
      ]
    },
    {
      match: /kidnap|hostage|false.*imprison|deprivation.*liberty/i, topic: "use-of-force",
      hints: [
        "Victim(s) — names, how they were taken, duration held",
        "Demands made by suspect (if any)",
        "How were victims released or recovered?",
        "Any injuries or threats made to victims?",
        "Negotiation details if applicable"
      ]
    },
    {
      match: /bail|breach.*bail/i, topic: "",
      hints: [
        "Original bail conditions that were breached",
        "Specifics of the breach — what the suspect did",
        "Original case reference / court date"
      ]
    },
    {
      match: /fail.*stop|evade|pursuit|anpr|vehicle.*offence/i, topic: "code4-flee",
      hints: [
        "Was the stop initiated by ANPR, officer observation, or LEAP intelligence?",
        "Vehicle details — rego, make, model, and colour from VICROADS or observation",
        "Reason police attempted the stop or interception",
        "Did the vehicle fail to stop, flee, or continue driving? Note direction and circumstances",
        "Public safety considerations that affected the interception decision",
        "How the follow-up was handled — report, warrant, traffic history, or later identification"
      ]
    }
  ];

  function updateNarrativeHints() {
    const panel = document.getElementById("narrativeHints");
    const list = document.getElementById("narrativeHintsList");
    if (!panel || !list) return;

    if (selectedChargesSet.size === 0) {
      panel.classList.remove("show");
      return;
    }

    const allCharges = Array.from(selectedChargesSet).join(" | ");
    const matchedHints = [];
    const seenHints = new Set();
    let guideTopic = "";

    NARRATIVE_HINT_RULES.forEach(rule => {
      if (rule.match.test(allCharges)) {
        if (!guideTopic && rule.topic) guideTopic = rule.topic;
        rule.hints.forEach(h => {
          if (!seenHints.has(h)) {
            seenHints.add(h);
            matchedHints.push(h);
          }
        });
      }
    });

    // Always show universal reminders for arrest-type reports
    const type = state.reportType;
    if (["arrest","vicpol_arrest"].includes(type) && matchedHints.length === 0) {
      guideTopic = "arrest-caution";
      matchedHints.push(
        "How was the suspect identified? (licence, MDT, fingerprints, verbal)",
        "Was caution read? Did suspect acknowledge?",
        "Where was the suspect processed and sentenced?"
      );
    }

    if (matchedHints.length === 0) {
      panel.classList.remove("show");
      return;
    }

    const guideBtn = document.getElementById("narrativeGuideBtn");
    if (guideBtn) {
      guideBtn.dataset.guideTopic = guideTopic;
      guideBtn.style.display = guideTopic ? "" : "none";
    }
    list.innerHTML = matchedHints.map(h => '<div class="nh-item">' + escapeHtml(h) + '</div>').join("");
    panel.classList.add("show");
  }

  function toggleCharge(chargeName) {
    if (selectedChargesSet.has(chargeName)) {
      selectedChargesSet.delete(chargeName);
    } else {
      selectedChargesSet.add(chargeName);
    }
    renderSelectedCharges();
    renderChargeList();
    updateSentenceSuggestion();
    updateNarrativeHints();
    state.chargesList = Array.from(selectedChargesSet).join('\n');
    debouncedRenderPreview();
    throttledAutosave();
  }

  function togglePin(pinName) {
    if (selectedPinsSet.has(pinName)) {
      selectedPinsSet.delete(pinName);
    } else {
      selectedPinsSet.add(pinName);
    }
    renderSelectedPins();
    renderPinList();
    state.pinsList = Array.from(selectedPinsSet).join('\n');
    updateLicenseWarning(); // Check for license suspension
    debouncedRenderPreview();
    throttledAutosave();
  }

  function renderChargeList() {
    if (!el.chargeList) return;
    
    const category = el.chargeFilter?.value || 'all';
    
    let filtered = CHARGES;
    if (category !== 'all') filtered = filtered.filter(c => c.cat === category);
    const search = searchEntries(filtered, el.chargeSearch?.value || '');
    filtered = search.results;
    
    el.chargeList.innerHTML = "";
    if (filtered.length === 0) {
      el.chargeList.innerHTML = '<div class="muted" style="padding:8px">No matching charges</div>';
      return;
    }
    renderSearchCorrectionHint(el.chargeList, el.chargeSearch, search.corrections);
    
    filtered.forEach(charge => {
      const item = document.createElement('div');
      item.setAttribute('data-charge-name', charge.name);
      item.style.cssText = "display:grid; grid-template-columns:auto 1fr; gap:10px; align-items:start; padding:8px; background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:8px; cursor:pointer; transition:all 0.15s";
      item.onmouseenter = () => item.style.background = "rgba(0,0,0,0.35)";
      item.onmouseleave = () => item.style.background = "rgba(0,0,0,0.2)";
      item.onclick = () => toggleCharge(charge.name);
      
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selectedChargesSet.has(charge.name);
      cb.style.marginTop = '2px';
      cb.onclick = (e) => e.stopPropagation();
      cb.onchange = () => toggleCharge(charge.name);
      
      const content = document.createElement('div');
      const chargeAlias = getEntryUiAlias(charge.name);
      const indPill = /indictable|NI\/I/i.test(charge.sentenceType || "") ? ' <span class="pill-ind">IND</span>' : '';
      content.innerHTML = '<div style="font-weight:900; font-size:12px; margin-bottom:4px">' + escapeHtml(charge.name) + indPill + '</div>' +
        (chargeAlias ? '<div style="font-size:11px; color:var(--muted); margin-bottom:4px">Plain English: ' + escapeHtml(chargeAlias) + '</div>' : '') +
        '<div style="font-size:11px; color:var(--muted)">' + escapeHtml(charge.cat) + ' | ' + escapeHtml(charge.cost) + ' | ' + escapeHtml(charge.sentenceType) + ' | ' + escapeHtml(charge.liability) + '</div>' +
        (charge.notes ? '<div style="font-size:11px; color:var(--muted); margin-top:4px">' + escapeHtml(charge.notes) + '</div>' : '');
      
      item.appendChild(cb);
      item.appendChild(content);
      el.chargeList.appendChild(item);
    });
  }

  function renderPinList() {
    if (!el.pinList) return;
    
    const category = el.pinFilter?.value || 'all';
    
    let filtered = PINS;
    if (category !== 'all') filtered = filtered.filter(p => p.cat === category);
    const search = searchEntries(filtered, el.pinSearch?.value || '');
    filtered = search.results;
    
    el.pinList.innerHTML = "";
    if (filtered.length === 0) {
      el.pinList.innerHTML = '<div class="muted" style="padding:8px">No matching PINs</div>';
      return;
    }
    renderSearchCorrectionHint(el.pinList, el.pinSearch, search.corrections);
    
    filtered.forEach(pin => {
      const item = document.createElement('div');
      item.setAttribute('data-pin-name', pin.name);
      item.style.cssText = "display:grid; grid-template-columns:auto 1fr; gap:10px; align-items:start; padding:8px; background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:8px; cursor:pointer; transition:all 0.15s";
      item.onmouseenter = () => item.style.background = "rgba(0,0,0,0.35)";
      item.onmouseleave = () => item.style.background = "rgba(0,0,0,0.2)";
      item.onclick = () => togglePin(pin.name);
      
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selectedPinsSet.has(pin.name);
      cb.style.marginTop = '2px';
      cb.onclick = (e) => e.stopPropagation();
      cb.onchange = () => togglePin(pin.name);
      
      const content = document.createElement('div');
      const pinAlias = getEntryUiAlias(pin.name);
      const ptsMatch = String(pin.points || "").match(/(\d+)\s*pts?/i);
      const ptsPill = ptsMatch && parseInt(ptsMatch[1]) > 0 ? ' <span class="pill-pts">' + ptsMatch[1] + ' pts</span>' : '';
      content.innerHTML = '<div style="font-weight:900; font-size:12px; margin-bottom:4px">' + escapeHtml(pin.name) + ptsPill + '</div>' +
        (pinAlias ? '<div style="font-size:11px; color:var(--muted); margin-bottom:4px">Plain English: ' + escapeHtml(pinAlias) + '</div>' : '') +
        '<div style="font-size:11px; color:var(--muted)">' + escapeHtml(pin.cat) + ' | $' + escapeHtml(pin.cost) + ' | ' + escapeHtml(pin.points) + ' | ' + escapeHtml(pin.liability) + '</div>';
      
      item.appendChild(cb);
      item.appendChild(content);
      el.pinList.appendChild(item);
    });
  }

  window.toggleCharge = toggleCharge;
  window.togglePin = togglePin;
  window.searchEntries = searchEntries;

  // State
  const INITIAL_STATE = {
    reportType: "arrest",
    enteredBy: "",
    reportDateTime: "",
    enteredUnit: "",
    offender: { name: "", dob: "", sex: "", address: "", phone: "" },
    currentDemeritPoints: 0,
    licenseStatus: "",
    licenseClass: "",
    ocrWeaponsOnly: false,
    ocrText: "",
    trafficWarrant: {
      rego: "", model: "", colour: "", registered: "", regoExpires: "",
      stolen: "NO", suspended: "NO", owner: "", location: "", time: "", date: "",
      speed: "", reason: "", actions: "", legNotes: "", suspHours: "", impoundNum: "", impoundDays: "",
      fineAmount: "", approvedBy: "", demeritPoints: "", failedIntercept: false
    },
    vicpolWarrant: {
      idStatus: "UNCONFIRMED", idBasis: "", warrantName: "", time: "", date: "", location: "",
      details: "", paste: "", rego: "", model: "", colour: "", registered: "",
      regoExpires: "", stolen: "NO", suspended: "NO", owner: "", instruction: "", approvedBy: "",
      sigRank: "Senior Constable", sigName: ""
    },
    bailConditions: {
      bailAmount: "", date: "", time: "", orgMember: false, violence: false, fpo: false, leapHistory: "",
      judge: "", sentenceWeeks: ""
    },
    fieldContact: {
      name: "", dob: "", phone: "", time: "", date: "", location: "",
      reason: "", summary: "", notes: ""
    },
    searchSeizure: {
      name: "", dob: "", phone: "", time: "", date: "", location: "",
      authority: "", reason: "", summary: "", notes: ""
    },
    vehicleInspection: {
      vehicleType: "", rego: "", make: "", colour: "", driver: "", location: "", notes: "", checklistState: {}
    },
    itemsList: "",
    officersList: "",
    chargesList: "",
    pinsList: "",
    sentence: "",
    sentenceApproval: "",
    victims: "",
    evidenceLocker: "",
    prelim: "",
    prelimTime: "",
    prelimDate: "",
    prelimLocation: "",
    summary: "",
    evidence: "",
    interviewQs: "",
    sigName: "",
    sigRank: "",
    sigDivision: "",
    officerCallsigns: {},
    savedCallsigns: [],
    excludedSections: [],
    // Auto-link shared details: canonical store for facts that recur across report
    // sections (subject / when-where / vehicle). Fanned out to every linked field so a
    // recruit can enter info once. `autoLinkShared` is the global on/off toggle.
    autoLinkShared: true,
    linkedShared: {
      name: "", dob: "", phone: "",
      time: "", date: "", location: "",
      rego: "", model: "", colour: "", owner: "",
      registered: "", regoExpires: "", stolen: "", suspended: ""
    }
  };

  let state = deepClone(INITIAL_STATE);
  let evidenceItems = [];

  const TW_IMPOUND_SCHEDULE = [
    { n:1,  dur:"12 Hours",      fine:6500 },
    { n:2,  dur:"24 Hours",      fine:13000 },
    { n:3,  dur:"48 Hours",      fine:19500 },
    { n:4,  dur:"7 Days",        fine:26000 },
    { n:5,  dur:"10 Days",       fine:39000 },
    { n:6,  dur:"14 Days",       fine:52000 },
    { n:7,  dur:"18 Days",       fine:65000 },
    { n:8,  dur:"24 Days",       fine:78000 },
    { n:9,  dur:"28 Days",       fine:91000 },
    { n:10, dur:"35 Days",       fine:104000 },
    { n:11, dur:"40 Days",       fine:117000 },
    { n:12, dur:"VEHICLE CRUSH", fine:null },
  ];

  function getTrafficImpoundSchedule(num) {
    return TW_IMPOUND_SCHEDULE.find(s => s.n === Number(num)) || null;
  }

  function applyTrafficImpoundSelection(selectedNum, options = {}) {
    const { updateState = true } = options;
    const rawValue = String(selectedNum || '').trim();
    const num = parseInt(rawValue, 10);
    const sched = getTrafficImpoundSchedule(num);
    const twImpoundNum = document.getElementById("twImpoundNum");
    const twImpoundInfo = document.getElementById("twImpoundInfo");
    const daysField = document.getElementById("twImpoundDays");
    const fineField = document.getElementById("twFineAmount");

    if (twImpoundNum) twImpoundNum.value = rawValue;
    if (updateState) state.trafficWarrant.impoundNum = rawValue;

    if (sched) {
      if (daysField) daysField.value = sched.dur;
      if (fineField) fineField.value = sched.fine ? sched.fine.toLocaleString() : "N/A";
      if (updateState) {
        state.trafficWarrant.impoundDays = sched.dur;
        state.trafficWarrant.fineAmount = sched.fine ? String(sched.fine) : "";
      }
      const crush = sched.dur === "VEHICLE CRUSH";
      if (twImpoundInfo) {
        twImpoundInfo.style.color = crush ? "rgba(255,100,100,0.95)" : "var(--ok)";
        twImpoundInfo.textContent = crush
          ? "⚠ VEHICLE CRUSH, SGT+ approval required"
          : `${sched.dur} / $${sched.fine.toLocaleString()} , ${num <= 5 ? "LSC+" : "SGT+"} approval`;
      }
      return;
    }

    if (twImpoundInfo) {
      twImpoundInfo.style.color = "var(--muted)";
      twImpoundInfo.textContent = "Select an offence number";
    }

    if (updateState) {
      if (daysField) daysField.value = "";
      if (fineField) fineField.value = "";
      state.trafficWarrant.impoundDays = "";
      state.trafficWarrant.fineAmount = "";
    }
  }

  function setPreviewStickyOffset() {
    const nav = document.getElementById('toolNav');
    const navHeight = nav ? Math.ceil(nav.getBoundingClientRect().height) : 44;
    const offset = Math.max(64, navHeight + 20);
    document.documentElement.style.setProperty('--preview-sticky-top', `${offset}px`);
  }

  
  function updateToolChrome(page) {
    const currentPage = page || 'report';
    document.body.classList.toggle('tool-nonreport', currentPage !== 'report');
    const badge = document.getElementById('reportBadge');
    const subtitle = document.getElementById('appSubtitle');
    if (currentPage === 'report') {
      if (badge) {
        badge.textContent = REPORT_TYPE_LABEL[state.reportType] || state.reportType.toUpperCase();
        badge.dataset.context = '';
      }
      if (subtitle) subtitle.textContent = `${APP_META.fullName} - ${APP_META.reportSubtitle}`;
    } else if (currentPage === 'ocr') {
      if (badge) { badge.textContent = 'OCR INTAKE'; badge.dataset.context = 'ocr'; }
      if (subtitle) subtitle.textContent = `${APP_META.fullName} - ${APP_META.ocrSubtitle}`;
    } else if (currentPage === 'recruit') {
      if (badge) { badge.textContent = 'RECRUIT HELPER'; badge.dataset.context = 'recruit'; }
      if (subtitle) subtitle.textContent = `${APP_META.fullName} - Recruit Helper & Handbook`;
    } else if (currentPage === 'guide') {
      if (badge) { badge.textContent = 'DAY-TO-DAY GUIDE'; badge.dataset.context = 'guide'; }
      if (subtitle) subtitle.textContent = `${APP_META.fullName} - Day-to-Day Guide for recruits`;
    } else {
      if (badge) {
        badge.textContent = 'TRAFFIC HISTORY';
        badge.dataset.context = 'traffic';
      }
      if (subtitle) subtitle.textContent = `${APP_META.fullName} - ${APP_META.utilitySubtitle}`;
    }
    setPreviewStickyOffset();
  }

  window.addEventListener('resize', setPreviewStickyOffset);

  // ============================================================================
  // UTILITY HELPERS
  // ============================================================================

  // Field format validation
  const VALIDATORS = {
    dob(v) {
      if (!v) return null;
      const s = v.trim();
      if (!s) return null;
      // Allow DD/MM/YYYY or DD/MM/YY
      if (!/^\d{1,2}\/\d{1,2}\/(\d{4}|\d{2})$/.test(s)) return "Expected format: DD/MM/YYYY";
      const parts = s.split("/");
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      if (month < 1 || month > 12) return "Invalid month";
      if (day < 1 || day > 31) return "Invalid day";
      const d = new Date(year, month - 1, day);
      if (d > new Date()) return "DOB is in the future";
      if (year < 1900) return "Year seems too old";
      return null;
    },
    rego(v) {
      if (!v) return null;
      const s = v.trim();
      if (!s) return null;
      if (s.length < 2) return "Rego seems too short";
      return null;
    },
    time(v) {
      if (!v) return null;
      const s = v.trim();
      if (!s) return null;
      // Accept various formats: 20:04, 2004, 20:04 HRS, 8:04 PM, etc.
      if (!/\d{1,2}[:.h]?\s*\d{2}\s*(hrs?|hours?|pm|am|aedt|aest)?/i.test(s) && !/^\d{3,4}\s*(hrs?)?$/i.test(s) && !/approx/i.test(s)) {
        return "Check time format (e.g. 20:04 HRS)";
      }
      return null;
    }
  };

  function showFieldError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const errEl = document.getElementById(errorId);
    if (!input) return;
    if (message) {
      input.classList.add("field-error");
      if (errEl) { errEl.textContent = message; errEl.classList.add("show"); }
    } else {
      input.classList.remove("field-error");
      if (errEl) { errEl.classList.remove("show"); }
    }
  }

  // Vehicle field sync helper — eliminates duplication
  function syncVehicleFields(source, targetStateObj, elPrefix) {
    const stateMap = { rego:"rego", model:"model", colour:"colour", registered:"registered", stolen:"stolen", suspended:"suspended", owner:"owner", expires:"regoExpires" };
    for (const [srcKey, stateKey] of Object.entries(stateMap)) {
      if (source[srcKey]) {
        targetStateObj[stateKey] = source[srcKey];
        const domId = elPrefix + stateKey.charAt(0).toUpperCase() + stateKey.slice(1);
        const domEl = el[domId] || document.getElementById(domId);
        if (domEl) domEl.value = source[srcKey];
      }
    }
  }

  // Storage quota check
  function checkStorageQuota() {
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("vicpol_")) {
          total += (localStorage.getItem(key) || "").length;
        }
      }
      const pct = Math.round((total / (5 * 1024 * 1024)) * 100);
      const quotaEl = document.getElementById("storageQuota");
      if (quotaEl) {
        if (pct > 70) {
          quotaEl.textContent = `⚠ Storage: ${pct}% used (${(total/1024).toFixed(0)}KB / 5MB). Consider deleting old drafts.`;
          quotaEl.style.display = "block";
        } else {
          quotaEl.textContent = `Storage: ${pct}% used (${(total/1024).toFixed(0)}KB / 5MB)`;
          quotaEl.style.display = "block";
        }
      }
      return { total, pct };
    } catch(e) { return { total: 0, pct: 0 }; }
  }

  // Safe localStorage write with quota error handling
  function safeLocalStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch(e) {
      if (e.name === "QuotaExceededError" || e.code === 22) {
        toast("⚠ Storage full — delete old drafts to save new data", "warn");
        return false;
      }
      console.warn("localStorage write failed:", e);
      return false;
    }
  }

  // Auto-link preference is a per-device setting, not draft content. Re-apply it
  // (and mirror it onto the header checkbox) whenever `state` is rebuilt from
  // INITIAL_STATE or a saved draft/backup, so the toggle, storage and state can't
  // drift apart until the next reload.
  const AUTOLINK_PREF_KEY = "vicpol_autolink_shared";
  function applyAutoLinkPref() {
    try {
      const s = localStorage.getItem(AUTOLINK_PREF_KEY);
      if (s !== null) state.autoLinkShared = (s === "1");
    } catch (e) {}
    const toggle = document.getElementById("autoLinkSharedToggle");
    if (toggle) toggle.checked = state.autoLinkShared !== false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKUP EXPORT / IMPORT (hand-over between browsers, devices and officers)
  // ═══════════════════════════════════════════════════════════════════════════
  // Everything the app persists lives under localStorage keys prefixed
  // `vicpol_`. A backup is a JSON envelope holding those raw values, so an
  // officer can move drafts, templates, officer/person lists, callsigns and
  // signatures to another browser — or hand a starter pack to a recruit.
  const BACKUP_SKIP_KEYS = new Set([
    "vicpol_report_undo_state", "vicpol_report_undo_charges", "vicpol_report_undo_pins",
    "vicpol_active_tab"
  ]);

  function listVicpolStorageKeys() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("vicpol_") && !BACKUP_SKIP_KEYS.has(k)) keys.push(k);
      }
    } catch (e) {}
    return keys.sort();
  }

  function buildBackupEnvelope() {
    const data = {};
    for (const k of listVicpolStorageKeys()) {
      try { data[k] = localStorage.getItem(k); } catch (e) {}
    }
    return {
      app: APP_META.fullName,
      kind: "vicpol-backup",
      schema: STORAGE_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data
    };
  }

  function backupFileName() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return "vicpol-backup-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes()) + ".json";
  }

  function downloadTextFile(name, text, mime) {
    const blob = new Blob([text], { type: mime || "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
  }

  function exportBackup() {
    const env = buildBackupEnvelope();
    const n = Object.keys(env.data).length;
    if (!n) { toast("Nothing to back up yet", "warn"); return; }
    downloadTextFile(backupFileName(), JSON.stringify(env, null, 2));
    toast("Backup exported (" + n + " item" + (n === 1 ? "" : "s") + ")", "ok");
  }

  // Parse a raw stored string, remembering whether it used the {schema,payload}
  // wrapper so the merged result can be written back in the same shape.
  function parseStoredRaw(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.prototype.hasOwnProperty.call(parsed, "payload")) {
        return { packed: true, value: parsed.payload };
      }
      return { packed: false, value: parsed };
    } catch (e) {
      return { packed: false, value: raw, plain: true };
    }
  }
  function serializeStored(parsed, value) {
    if (parsed.plain) return String(value);
    return parsed.packed ? packStoredValue(value) : JSON.stringify(value);
  }
  function recordKey(item) {
    if (item && typeof item === "object") {
      const k = item.name || item.full || item.id;
      if (k != null) return String(k).trim().toUpperCase();
    }
    return JSON.stringify(item);
  }

  // Merge one incoming stored value into the local one. Objects keyed by name
  // (drafts, presets) are unioned with the local entry winning on conflict;
  // arrays (officers, persons, pools) are unioned by record key; anything else
  // keeps the local value. Returns the raw string to store, or null to skip.
  function mergeStoredValue(localRaw, incomingRaw) {
    if (localRaw == null) return incomingRaw;
    const a = parseStoredRaw(localRaw);
    const b = parseStoredRaw(incomingRaw);
    if (Array.isArray(a.value) && Array.isArray(b.value)) {
      const seen = new Set(a.value.map(recordKey));
      const merged = a.value.slice();
      for (const item of b.value) { const k = recordKey(item); if (!seen.has(k)) { seen.add(k); merged.push(item); } }
      return merged.length === a.value.length ? null : serializeStored(a, merged);
    }
    const isObj = v => v && typeof v === "object" && !Array.isArray(v);
    if (isObj(a.value) && isObj(b.value)) {
      const merged = { ...b.value, ...a.value };
      return Object.keys(merged).length === Object.keys(a.value).length ? null : serializeStored(a, merged);
    }
    return null;
  }

  function validateBackupEnvelope(env) {
    if (!env || typeof env !== "object") return "Not a VicPol backup file.";
    if (env.kind !== "vicpol-backup" || !env.data || typeof env.data !== "object") return "Not a VicPol backup file.";
    const keys = Object.keys(env.data);
    if (!keys.length) return "Backup file is empty.";
    if (keys.some(k => !k.startsWith("vicpol_"))) return "Backup contains unexpected keys.";
    if (Object.values(env.data).some(v => typeof v !== "string")) return "Backup values are malformed.";
    return "";
  }

  // Apply a parsed envelope. replace=true overwrites every key in the file;
  // otherwise values are merged as above. Returns counts for the toast.
  function applyBackupEnvelope(env, opts) {
    const replace = !!(opts && opts.replace);
    const summary = { written: 0, merged: 0, skipped: 0, failed: 0 };
    for (const [k, incoming] of Object.entries(env.data)) {
      if (BACKUP_SKIP_KEYS.has(k)) { summary.skipped++; continue; }
      let localRaw = null;
      try { localRaw = localStorage.getItem(k); } catch (e) {}
      let toWrite;
      if (replace || localRaw == null) toWrite = incoming;
      else toWrite = mergeStoredValue(localRaw, incoming);
      if (toWrite == null) { summary.skipped++; continue; }
      if (safeLocalStorageSet(k, toWrite)) { if (localRaw == null || replace) summary.written++; else summary.merged++; }
      else summary.failed++;
    }
    return summary;
  }

  function importBackupFromText(text, opts) {
    let env;
    try { env = JSON.parse(text); } catch (e) { toast("Could not read that file — not valid JSON", "err"); return null; }
    const problem = validateBackupEnvelope(env);
    if (problem) { toast(problem, "err"); return null; }
    if (typeof env.schema === "number" && env.schema > STORAGE_SCHEMA_VERSION &&
        !confirm("This backup was made by a newer version of the tool. Import anyway?")) return null;
    const replace = !!(opts && opts.replace);
    const n = Object.keys(env.data).length;
    const when = env.exportedAt ? new Date(env.exportedAt).toLocaleString() : "unknown date";
    const msg = replace
      ? "Replace your saved data with this backup (" + n + " items, exported " + when + ")?\n\nDrafts, templates, officers and signatures on this device will be overwritten. The page will reload."
      : "Merge this backup (" + n + " items, exported " + when + ") into your saved data?\n\nExisting entries with the same name are kept; new ones are added. The page will reload.";
    if (!confirm(msg)) return null;
    const summary = applyBackupEnvelope(env, { replace });
    if (summary.failed) toast("Import incomplete — storage is full", "err");
    else toast("Backup imported: " + summary.written + " added, " + summary.merged + " merged", "ok");
    return summary;
  }

  function importBackupFromFile(file, opts) {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => toast("Could not read that file", "err");
    reader.onload = () => {
      const summary = importBackupFromText(String(reader.result || ""), opts);
      // Every module caches state at startup; a reload is the one reliable way
      // to make them all pick up the imported data.
      if (summary && !summary.failed) setTimeout(() => location.reload(), 900);
    };
    reader.readAsText(file);
  }

  // ============================================================================
  // TEMPLATE/PRESET SYSTEM
  // ============================================================================
  const PRESET_KEY = "vicpol_report_presets";
  function loadPresets() { try { return JSON.parse(localStorage.getItem(PRESET_KEY) || "{}"); } catch(e) { return {}; } }
  function savePresets(obj) { safeLocalStorageSet(PRESET_KEY, JSON.stringify(obj)); }

  function renderPresetList() {
    const listEl = document.getElementById("presetList");
    if (!listEl) return;
    const presets = loadPresets();
    const names = Object.keys(presets);
    const lastUsed = localStorage.getItem("vicpol_report_last_preset") || "";
    if (!names.length) {
      listEl.innerHTML = '<div style="font-size:12px;color:var(--muted)">No saved templates yet</div>';
      return;
    }
    listEl.innerHTML = names.map(name => {
      const p = presets[name];
      const isActive = name === lastUsed;
      const borderColor = isActive ? 'rgba(100,255,150,0.35)' : 'var(--border)';
      const bgColor = isActive ? 'rgba(100,255,150,0.06)' : 'rgba(255,255,255,0.04)';
      const badge = isActive ? '<span style="font-size:9px;font-weight:900;color:rgba(100,255,150,0.9);background:rgba(100,255,150,0.12);padding:1px 6px;border-radius:4px;margin-left:6px">ACTIVE</span>' : '';
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:' + bgColor + ';border-radius:8px;border:1px solid ' + borderColor + '">' +
        '<div style="min-width:0;overflow:hidden">' +
          '<div style="font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(name) + badge + '</div>' +
          '<div style="font-size:10px;color:var(--muted)">' + escapeHtml([p.callsign, p.sigName].filter(Boolean).join(' — ') || 'Empty') + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0">' +
          '<button class="btn preset-list-btn" data-preset-action="load" data-preset-name="' + encodeURIComponent(name) + '" style="font-size:10px;padding:4px 8px">Load</button>' +
          '<button class="btn preset-list-btn" data-preset-action="delete" data-preset-name="' + encodeURIComponent(name) + '" style="font-size:10px;padding:4px 8px;color:rgba(255,150,150,0.9)">Del</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // Focus trap utility for accessible modals
  let _focusTrapCleanup = null;
  let _focusTrapPrevFocus = null;
  function trapFocus(container) {
    _focusTrapPrevFocus = document.activeElement;
    const focusable = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    function handler(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    container.addEventListener('keydown', handler);
    _focusTrapCleanup = () => container.removeEventListener('keydown', handler);
    requestAnimationFrame(() => { if (first) first.focus(); });
  }
  function releaseFocusTrap() {
    if (_focusTrapCleanup) { _focusTrapCleanup(); _focusTrapCleanup = null; }
    if (_focusTrapPrevFocus && typeof _focusTrapPrevFocus.focus === 'function') {
      _focusTrapPrevFocus.focus();
      _focusTrapPrevFocus = null;
    }
  }

  function openPresetModal() {
    document.body.style.overflow = 'hidden';
    const overlay = document.getElementById("presetModalOverlay");
    if (!overlay) return;
    // Auto-load last-used preset into modal fields
    const lastUsed = localStorage.getItem("vicpol_report_last_preset") || "";
    if (lastUsed) {
      const presets = loadPresets();
      const p = presets[lastUsed];
      if (p) {
        const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v || ""; };
        set("tplCallsign", p.callsign);
        set("tplUnit", p.unit);
        set("tplSigName", p.sigName);
        set("tplSigRank", p.sigRank);
        set("tplSigDivision", p.sigDivision);
      }
    }
    renderPresetList();
    checkStorageQuota();
    overlay.classList.add("open");
    trapFocus(overlay.querySelector('.preset-modal') || overlay);
  }

  function closePresetModal() {
    document.body.style.overflow = '';
    const overlay = document.getElementById("presetModalOverlay");
    if (overlay) overlay.classList.remove("open");
    releaseFocusTrap();
  }

  window.loadPresetIntoModal = function(name) {
    const presets = loadPresets();
    const p = presets[name];
    if (!p) return;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v || ""; };
    set("tplCallsign", p.callsign);
    set("tplUnit", p.unit);
    set("tplSigName", p.sigName);
    set("tplSigRank", p.sigRank);
    set("tplSigDivision", p.sigDivision);
    safeLocalStorageSet("vicpol_report_last_preset", name);
    renderPresetList();
    toast("Template loaded: " + name, "ok");
  };

  window.deletePreset = function(name) {
    if (!confirm("Delete template: " + name + "?")) return;
    const presets = loadPresets();
    delete presets[name];
    savePresets(presets);
    // Clear last-used if we just deleted it
    if (localStorage.getItem("vicpol_report_last_preset") === name) {
      try { localStorage.removeItem("vicpol_report_last_preset"); } catch(e) {}
    }
    renderPresetList();
    toast("Template deleted", "ok");
  };

  function saveCurrentPreset() {
    const name = prompt("Template name:");
    if (!name) return;
    const presets = loadPresets();
    const existed = name in presets;
    presets[name] = {
      callsign: (document.getElementById("tplCallsign")?.value || "").trim(),
      unit: (document.getElementById("tplUnit")?.value || "").trim(),
      sigName: (document.getElementById("tplSigName")?.value || "").trim(),
      sigRank: (document.getElementById("tplSigRank")?.value || "").trim(),
      sigDivision: (document.getElementById("tplSigDivision")?.value || "").trim()
    };
    savePresets(presets);
    safeLocalStorageSet("vicpol_report_last_preset", name);
    renderPresetList();
    toast((existed ? "Template updated: " : "Template saved: ") + name, "ok");
  }

  function applyPresetToForm() {
    const g = (id) => (document.getElementById(id)?.value || "").trim();
    const callsign = g("tplCallsign");
    const unit = g("tplUnit");
    const sigName = g("tplSigName");
    const sigRank = g("tplSigRank");
    const sigDivision = g("tplSigDivision");

    if (callsign && el.enteredBy) { el.enteredBy.value = callsign; state.enteredBy = callsign; }
    if (unit && el.enteredUnit) { el.enteredUnit.value = unit; state.enteredUnit = unit; }
    if (sigName && el.sigName) { el.sigName.value = sigName; state.sigName = sigName; }
    if (sigRank && el.sigRank) { el.sigRank.value = sigRank; state.sigRank = sigRank; }
    if (sigDivision && el.sigDivision) { el.sigDivision.value = sigDivision; state.sigDivision = sigDivision; }

    debouncedRenderPreview();
    throttledAutosave();
    closePresetModal();
    toast("Template applied to form", "ok");
  }

  // Elements
  const el = {
    reportType: document.getElementById("reportType"),
    enteredBy: document.getElementById("enteredBy"),
    reportDateTime: document.getElementById("reportDateTime"),
    enteredUnit: document.getElementById("enteredUnit"),
    offenderName: document.getElementById("offenderName"),
    offenderDOB: document.getElementById("offenderDOB"),
    offenderSex: document.getElementById("offenderSex"),
    offenderAddress: document.getElementById("offenderAddress"),
    offenderPhone: document.getElementById("offenderPhone"),
    
    // OCR
    pasteZone: document.getElementById("pasteZone"),
    imgFile: document.getElementById("imgFile"),
    ocrStatus: document.getElementById("ocrLabStatus"), // unified — uses advanced OCR status bar
    ocrText: document.getElementById("ocrText"),
    ocrWeaponsOnly: document.getElementById("ocrWeaponsOnly"),
    clearOcrBtn: document.getElementById("clearOcrBtn"),
    
    chargeSearch: document.getElementById("chargeSearch"),
    chargeFilter: document.getElementById("chargeFilter"),
    chargeList: document.getElementById("chargeList"),
    selectedCharges: document.getElementById("selectedCharges"),
    clearChargesBtn: document.getElementById("clearChargesBtn"),
    pinSearch: document.getElementById("pinSearch"),
    pinFilter: document.getElementById("pinFilter"),
    pinList: document.getElementById("pinList"),
    selectedPins: document.getElementById("selectedPins"),
    clearPinsBtn: document.getElementById("clearPinsBtn"),
    
        // Cards
    offenderCard: document.getElementById("offenderCard"),
    trafficWarrantCard: document.getElementById("trafficWarrantCard"),
    vicpolWarrantCard: document.getElementById("vicpolWarrantCard"),
    fieldContactCard: document.getElementById("fieldContactCard"),
    searchSeizureCard: document.getElementById("searchSeizureCard"),
    vehicleInspectionCard: document.getElementById("vehicleInspectionCard"),
    chargesCard: document.getElementById("chargesCard"),
    pinsCard: document.getElementById("pinsCard"),
    itemsCard: document.getElementById("itemsCard"),
    officersCard: document.getElementById("officersCard"),
    narrativeCard: document.getElementById("narrativeCard"),
    interviewCard: document.getElementById("interviewCard"),
    sentenceCard: document.getElementById("sentenceCard"),
    
    // Traffic Warrant
    twRego: document.getElementById("twRego"),
    twModel: document.getElementById("twModel"),
    twColour: document.getElementById("twColour"),
    twRegistered: document.getElementById("twRegistered"),
    twRegoExpires: document.getElementById("twRegoExpires"),
    twStolen: document.getElementById("twStolen"),
    twSuspended: document.getElementById("twSuspended"),
    twOwner: document.getElementById("twOwner"),
    twLocation: document.getElementById("twLocation"),
    twTime: document.getElementById("twTime"),
    twDate: document.getElementById("twDate"),
    twSpeed: document.getElementById("twSpeed"),
    twSuspHours: document.getElementById("twSuspHours"),
    twImpoundDays: document.getElementById("twImpoundDays"),
    twFineAmount: document.getElementById("twFineAmount"),
    twApprovedBy: document.getElementById("twApprovedBy"),
    twReason: document.getElementById("twReason"),
    twActions: document.getElementById("twActions"),
    twLegNotes: document.getElementById("twLegNotes"),
    
    // Shared warrant fields
    swIdStatus: document.getElementById("swIdStatus"),
    swIdBasis: document.getElementById("swIdBasis"),
    swIdStatusWarn: document.getElementById("swIdStatusWarn"),
    swWarrantName: document.getElementById("swWarrantName"),
    swPaste: document.getElementById("swPaste"),
    swRego: document.getElementById("swRego"),
    swModel: document.getElementById("swModel"),
    swColour: document.getElementById("swColour"),
    swRegistered: document.getElementById("swRegistered"),
    swRegoExpires: document.getElementById("swRegoExpires"),
    swStolen: document.getElementById("swStolen"),
    swSuspended: document.getElementById("swSuspended"),
    swOwner: document.getElementById("swOwner"),
    swInstruction: document.getElementById("swInstruction"),
    // Bail Conditions
    bcBailAmount: document.getElementById("bcBailAmount"),
    bcDate: document.getElementById("bcDate"),
    bcTime: document.getElementById("bcTime"),
    bcLeapHistory: document.getElementById("bcLeapHistory"),
    bcJudge: document.getElementById("bcJudge"),
    bcSentenceWeeks: document.getElementById("bcSentenceWeeks"),
    bailConditionsCard: document.getElementById("bailConditionsCard"),
    
    // Field Contact
    fcName: document.getElementById("fcName"),
    fcDOB: document.getElementById("fcDOB"),
    fcPhone: document.getElementById("fcPhone"),
    fcTime: document.getElementById("fcTime"),
    fcDate: document.getElementById("fcDate"),
    fcLocation: document.getElementById("fcLocation"),
    fcReason: document.getElementById("fcReason"),
    fcSummary: document.getElementById("fcSummary"),
    fcNotes: document.getElementById("fcNotes"),
    
    // Search & Seizure
    ssName: document.getElementById("ssName"),
    ssDOB: document.getElementById("ssDOB"),
    ssPhone: document.getElementById("ssPhone"),
    ssTime: document.getElementById("ssTime"),
    ssDate: document.getElementById("ssDate"),
    ssLocation: document.getElementById("ssLocation"),
    ssAuthority: document.getElementById("ssAuthority"),
    ssReason: document.getElementById("ssReason"),
    ssSummary: document.getElementById("ssSummary"),
    ssNotes: document.getElementById("ssNotes"),
    
    // Items & Officers
    itemText: document.getElementById("itemText"),
    addItemBtn: document.getElementById("addItemBtn"),
    itemsList: document.getElementById("itemsList"),
    officerText: document.getElementById("officerText"),
    addOfficerBtn: document.getElementById("addOfficerBtn"),
    officersList: document.getElementById("officersList"),
    vpOfficerCallsign: document.getElementById("vpOfficerCallsign"),
    vpOfficerRank: document.getElementById("vpOfficerRank"),
    vpOfficerName: document.getElementById("vpOfficerName"),
    vpAddOfficerBtn: document.getElementById("vpAddOfficerBtn"),
    newCallsignInput: document.getElementById("newCallsignInput"),
    addCallsignBtn: document.getElementById("addCallsignBtn"),
    
    // Charges & PINs
    
    // Narrative
    prelim: null, // retired — kept for autosave compat
    prelimTime: document.getElementById("prelimTime"),
    prelimDate: document.getElementById("prelimDate"),
    prelimLocation: document.getElementById("prelimLocation"),
    summary: document.getElementById("summary"),
    evidence: document.getElementById("evidence"),
    interviewQs: document.getElementById("interviewQs"),
    
    // Sentence & Sig
    sentence: document.getElementById("sentence"),
    sentenceApproval: document.getElementById("sentenceApproval"),
    victims: document.getElementById("victims"),
    evidenceLocker: document.getElementById("evidenceLocker"),
    sigName: document.getElementById("sigName"),
    sigRank: document.getElementById("sigRank"),
    sigDivision: document.getElementById("sigDivision"),
    
    // UI
    preview: document.getElementById("preview"),
    licenseWarning: document.getElementById("licenseWarning"),
    licenseWarningText: document.getElementById("licenseWarningText"),
    copyBtn: document.getElementById("copyBtn"),

    saveDraftBtn: document.getElementById("saveDraftBtn"),
    clearBtn: document.getElementById("clearBtn"),
    validateBtn: document.getElementById("validateBtn"),
    fillQuestionsBtn: document.getElementById("fillQuestionsBtn"),
    draftsList: document.getElementById("draftsList"),
    toast: document.getElementById("toast")
  };

  // Toast
  let _toastTimer;
  let _toastFadeTimer;
  function toast(msg, type) {
    if (!el.toast) return;
    clearTimeout(_toastTimer);
    clearTimeout(_toastFadeTimer);
    // Reset: force hide then re-show on next frame for reliable transition restart
    el.toast.classList.remove("show");
    el.toast.className = "toast";
    el.toast.textContent = msg;
    if (type === "ok") el.toast.classList.add("toast-ok");
    else if (type === "warn") el.toast.classList.add("toast-warn");
    else if (type === "err") el.toast.classList.add("toast-err");
    // Use rAF to ensure the browser has painted the hidden state before re-showing
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.toast.classList.add("show");
        _toastTimer = setTimeout(() => {
          el.toast.classList.remove("show");
          _toastFadeTimer = setTimeout(() => { el.toast.className = "toast"; }, 250);
        }, 3000);
      });
    });
  }

  // Update Licence Suspension Warning
  function updateLicenseWarning() {
    const warning = checkLicenseSuspension();
    
    if (!el.licenseWarning || !el.licenseWarningText) return;
    
    if (warning) {
      let html = warning.message + 
        `<br><br><strong>Current LEAP Demerit Points (last 7 days):</strong> ${warning.currentPoints}<br>` +
        `<strong>Points from Selected PINs:</strong> +${warning.newPoints}<br>` +
        `<strong>Total Points:</strong> ${warning.totalPoints}/12`;
      
      if (warning.type === "SUSPEND") {
        html += `<div style="margin-top:12px;padding:12px;background:rgba(255,50,50,0.2);border:1px solid rgba(255,80,80,0.5);border-radius:10px;font-weight:900">` +
          `🚨 <strong>MANDATORY SUSPENSION:</strong> Subject has accumulated ${warning.totalPoints} demerit points (12+ within 7 days). ` +
          `The licence must be suspended immediately per Road Safety Act. Process the licence suspension and issue notice to the subject.` +
          `</div>`;
        el.licenseWarning.style.borderColor = "#ff3333";
        el.licenseWarning.style.background = "rgba(255,50,50,0.15)";
      } else {
        html += `<div style="margin-top:12px;padding:10px;background:rgba(255,180,50,0.15);border:1px solid rgba(255,180,50,0.4);border-radius:10px;font-size:13px">` +
          `⚠️ <strong>Reminder:</strong> If a subject accumulates <strong>12 or more demerit points within 7 days</strong>, ` +
          `their licence must be suspended. Currently at <strong>${warning.totalPoints}/12</strong> — only <strong>${12 - warning.totalPoints}</strong> points away from mandatory suspension.` +
          `</div>`;
        el.licenseWarning.style.borderColor = "var(--warn)";
        el.licenseWarning.style.background = "rgba(255,150,0,0.1)";
      }
      
      el.licenseWarningText.innerHTML = html;
      el.licenseWarning.style.display = "block";
    } else {
      el.licenseWarning.style.display = "none";
    }
  }


  // Report Type Mapping
  const REPORT_TYPE_LABEL = {
    arrest: "ARREST REPORT",
    vicpol_arrest: "ARREST WARRANT",
    vicpol_warrant: "WARRANT FOR QUESTIONING",
    bail_conditions: "BAIL CONDITIONS",
    traffic_warrant: "TRAFFIC WARRANT",
    field_contact: "FIELD CONTACT REPORT",
    search_seizure: "SEARCH & SEIZURE",
    vehicle_inspection: "VEHICLE INSPECTION REPORT"
  };

  const VICPOL_ALLOWED_REPORT_TYPES = new Set([
    "arrest",
    "vicpol_arrest",
    "vicpol_warrant",
    "bail_conditions",
    "traffic_warrant",
    "field_contact",
    "search_seizure",
    "vehicle_inspection"
  ]);

  const VICPOL_REPORT_TYPE_FALLBACKS = {
    legacy_arrest: "vicpol_arrest",
    legacy_warrant: "vicpol_warrant",
  };

  function sanitizeVicPolReportType(type) {
    const mapped = VICPOL_REPORT_TYPE_FALLBACKS[type] || type;
    return VICPOL_ALLOWED_REPORT_TYPES.has(mapped) ? mapped : "arrest";
  }

  function sanitizeVicPolState(showToast = false) {
    const previous = state.reportType;
    const sanitized = sanitizeVicPolReportType(previous);
    if (sanitized !== previous) {
      state.reportType = sanitized;
      if (showToast) toast("Unsupported legacy mode was converted to a VicPol mode", "warn");
    }
    if (typeof el !== 'undefined' && el && el.reportType) {
      const hasOption = Array.from(el.reportType.options || []).some(opt => opt.value === state.reportType);
      if (hasOption) el.reportType.value = state.reportType;
    }
  }


// ═══════════════════════════════════════════════════════════════════════════
// Auto-link shared details — field groups
// Each group is one canonical fact (key) shared across several report sections.
// members = the DOM input id + the state path it maps to ("" path = DOM only,
// e.g. the Traffic-tab suspect name which has no state slot).
// Deliberately EXCLUDED: swWarrantName (warrant-name override — generator already
// falls back to offender name) and vicDriver (driver ≠ registered owner). Those
// stay independent on purpose.
// ═══════════════════════════════════════════════════════════════════════════
const LINK_GROUPS = [
  { key: "name",       members: [
    { id: "offenderName",    path: "offender.name" },
    { id: "fcName",          path: "fieldContact.name" },
    { id: "ssName",          path: "searchSeizure.name" },
    { id: "ttName",          path: "" }
  ]},
  { key: "dob",        members: [
    { id: "offenderDOB",     path: "offender.dob" },
    { id: "fcDOB",           path: "fieldContact.dob" },
    { id: "ssDOB",           path: "searchSeizure.dob" }
  ]},
  { key: "phone",      members: [
    { id: "offenderPhone",   path: "offender.phone" },
    { id: "fcPhone",         path: "fieldContact.phone" },
    { id: "ssPhone",         path: "searchSeizure.phone" }
  ]},
  { key: "time",       members: [
    { id: "prelimTime",      path: "prelimTime" },
    { id: "fcTime",          path: "fieldContact.time" },
    { id: "ssTime",          path: "searchSeizure.time" },
    { id: "twTime",          path: "trafficWarrant.time" }
  ]},
  { key: "date",       members: [
    { id: "prelimDate",      path: "prelimDate" },
    { id: "fcDate",          path: "fieldContact.date" },
    { id: "ssDate",          path: "searchSeizure.date" },
    { id: "twDate",          path: "trafficWarrant.date" }
  ]},
  { key: "location",   members: [
    { id: "prelimLocation",  path: "prelimLocation" },
    { id: "fcLocation",      path: "fieldContact.location" },
    { id: "ssLocation",      path: "searchSeizure.location" },
    { id: "twLocation",      path: "trafficWarrant.location" },
    { id: "vicLocation",     path: "vehicleInspection.location" }
  ]},
  { key: "rego",       members: [
    { id: "twRego",          path: "trafficWarrant.rego" },
    { id: "swRego",          path: "vicpolWarrant.rego" },
    { id: "vicRego",         path: "vehicleInspection.rego" }
  ]},
  { key: "model",      members: [
    { id: "twModel",         path: "trafficWarrant.model" },
    { id: "swModel",         path: "vicpolWarrant.model" },
    { id: "vicMake",         path: "vehicleInspection.make" }
  ]},
  { key: "colour",     members: [
    { id: "twColour",        path: "trafficWarrant.colour" },
    { id: "swColour",        path: "vicpolWarrant.colour" },
    { id: "vicColour",       path: "vehicleInspection.colour" }
  ]},
  { key: "owner",      members: [
    { id: "twOwner",         path: "trafficWarrant.owner" },
    { id: "swOwner",         path: "vicpolWarrant.owner" }
  ]},
  { key: "registered", members: [
    { id: "twRegistered",    path: "trafficWarrant.registered" },
    { id: "swRegistered",    path: "vicpolWarrant.registered" }
  ]},
  { key: "regoExpires", members: [
    { id: "twRegoExpires",   path: "trafficWarrant.regoExpires" },
    { id: "swRegoExpires",   path: "vicpolWarrant.regoExpires" }
  ]},
  { key: "stolen",     members: [
    { id: "twStolen",        path: "trafficWarrant.stolen" },
    { id: "swStolen",        path: "vicpolWarrant.stolen" }
  ]},
  { key: "suspended",  members: [
    { id: "twSuspended",     path: "trafficWarrant.suspended" },
    { id: "swSuspended",     path: "vicpolWarrant.suspended" }
  ]}
];

// Update UI based on report type
const REPORT_CARD_VISIBILITY = {
  arrest: ["chargesCard", "pinsCard", "itemsCard", "officersCard", "narrativeCard", "sentenceCard", "interviewCard"],
  vicpol_arrest: ["vicpolWarrantCard", "chargesCard", "pinsCard", "itemsCard", "officersCard", "narrativeCard", "sentenceCard", "interviewCard"],
  vicpol_warrant: ["vicpolWarrantCard", "chargesCard", "pinsCard", "itemsCard", "officersCard", "narrativeCard", "sentenceCard", "interviewCard"],
  bail_conditions: ["bailConditionsCard", "chargesCard", "pinsCard"],
  traffic_warrant: ["trafficWarrantCard", "chargesCard", "pinsCard", "itemsCard", "officersCard", "narrativeCard", "sentenceCard", "interviewCard"],
  field_contact: ["fieldContactCard", "officersCard", "interviewCard"],
  search_seizure: ["searchSeizureCard", "chargesCard", "itemsCard", "officersCard", "narrativeCard", "sentenceCard", "interviewCard"],
  vehicle_inspection: ["vehicleInspectionCard", "officersCard"]
};

function updateReportTypeUI() {
  sanitizeVicPolState(false);
  const type = state.reportType;

  const badge = document.getElementById("reportBadge");
  if (badge) badge.textContent = REPORT_TYPE_LABEL[type] || type.toUpperCase();
  updateSharedWarrantCardMeta();

  const sigDivisionWrap = document.getElementById("sigDivisionWrap");
  if (sigDivisionWrap) sigDivisionWrap.style.display = "block";

  const cards = [
    "trafficWarrantCard",
    "vicpolWarrantCard",
    "bailConditionsCard",
    "fieldContactCard",
    "searchSeizureCard",
    "vehicleInspectionCard",
    "chargesCard",
    "pinsCard",
    "itemsCard",
    "officersCard",
    "narrativeCard",
    "interviewCard",
    "sentenceCard"
  ];
  cards.forEach(key => {
    if (el[key]) el[key].style.display = "none";
  });
  if (el.licenseWarning) el.licenseWarning.style.display = "none";

  if (el.offenderCard) {
    const hideOffender = (type === "field_contact" || type === "search_seizure" || type === "vehicle_inspection");
    el.offenderCard.style.display = hideOffender ? "none" : "block";
  }

  const visibleCards = REPORT_CARD_VISIBILITY[type] || REPORT_CARD_VISIBILITY.arrest;
  visibleCards.forEach(key => {
    if (el[key]) el[key].style.display = "block";
  });

  // Auto-link: push canonical shared facts into the freshly-shown cards so a
  // recruit who entered the subject/vehicle once sees it pre-filled here too.
  if (typeof reconcileSharedLinks === "function") {
    try { reconcileSharedLinks(); } catch (e) {}
  }
}

// Preview Generation (DEBOUNCED)
  const debouncedRenderPreview = debounce(() => {
    const type = state.reportType;
    let output = "";

    if (type === "traffic_warrant") {
      output = generateTrafficWarrant();
    } else if (type === "vicpol_arrest") {
      output = generateVicPolArrest();
    } else if (type === "vicpol_warrant") {
      output = generateVicPolWarrant();
    } else if (type === "bail_conditions") {
      output = generateBailConditions();
    } else if (type === "field_contact") {
      output = generateFieldContact();
    } else if (type === "search_seizure") {
      output = generateSearchSeizure();
    } else if (type === "vehicle_inspection") {
      output = generateVehicleInspection();
    } else {
      output = generateArrestReport();
    }

    if (el.preview && !window._editPreviewMode) el.preview.textContent = normalizeGeneratedReport(output);
    updateCharCount();
    // Recruit Mode: keep the live required-fields checklist in step with the preview.
    if (typeof updateRecruitChecklist === "function") { try { updateRecruitChecklist(); } catch (e) {} }
  }, 200);
