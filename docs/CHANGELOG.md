# Changelog

Newest first. Dates are the commit dates on `main`.

## Unreleased

- **Verified the two image-only handbook slides the user supplied (impound durations, drugs
  classification).** The impound schedule in all three places it lives (`core.js`, `interactions.js`,
  the Traffic Warrant `<select>`) matches the slide row for row. The drug thresholds (20 processed /
  50 unprocessed) were already right. One real error fixed: the Credit Card Fraud charge notes in
  `charges.js` said 0–100 and 100–500 cards; the handbook's tiers are up to 199, 200–499 and 500+.
  Added the slide's exact in-game item names (weed seed, poppy seed, raw cocaine, bag of
  meth/opium/…, portable methlab, acetone, lithium battery, counterfeit credit card) to the item
  catalogue so the OCR pockets matcher recognises them — previously a pockets line reading
  "COCAINE" (unprocessed) substring-matched "Cocaine Bags" (processed). The drugs topic now lists
  which items count as processed, unprocessed and implements.
- **Handbook: full knowledge audit against the two source PDFs, plus a sanity pass.** Every topic
  and guide scenario was re-read against the BBRP General Duties Handbook (2025) and the Victoria
  Police Handbook (2024 Edition). Nothing already in the app was wrong. Added the rules the source
  has that the app didn't: **no searches for traffic violations** (illegal search, officer liable),
  pursuit priority order (Highway → CIRT → PORT → GD) and the official GD vehicle list by class,
  the GD ban on stationary radar plus ANPR/radar controls, the full RBT/RDT procedure (which
  offences trigger it, rear-seat test, second test at the station lab), the Code 4 plate-scan step
  (`PAGEUP` twice) and the source's Code 4 radio wording, "reason for the pursuit" in pursuit comms,
  the New Life "auto-carded" and police-crash RP rules, radio units (minutes/kilometres), and the
  Short → Medium → Long progression a permanent FPO requires. Resolved one internal contradiction:
  the Recruit Helper counted a verbal name on bodycam as a confirmed ID while the Guide said "never a
  verbal name" — per the user, a verbal name is not confirmation, so both pages now agree. Also
  verified: every handbook jump link resolves to a real topic/report/tab, and all new numbers match
  the source text one-for-one. The caution wording was checked against the current handbook and
  deliberately kept as the in-city version.
- **Handbook: cross-checked the Recruit Helper against the real source documents** (the BBRP
  General Duties Handbook 2025 and the BBRP Victoria Police Handbook 2024 Edition, both supplied
  by the user) and closed the gaps. Everything already in the app checked out accurate against the
  source (ranks, radio codes, FPO tiers, sentencing caps, licence classes, use-of-force
  motorcycle/taser guidance) — nothing was wrong, just missing. Added five new topics: **Melbourne
  Remand Centre & Prisoner Release** (including the rule that only a court order can release a
  prisoner, cross-linked from the Code 15 scenario since that's exactly when it matters), **Dangerous
  Articles** (knives/bats — lawful excuses, self-defence is not one), **Forensics & DNA Collection**,
  **Revoking Weapon Licences**, and **Bicycle Patrol & PSO Deployment**. Extended six existing
  topics with previously-missing detail: legal representation & friend/family call rules on arrest,
  FPO Non-Compliance as its own charge (plus the full 4 issuing reasons), Community Service activity
  caps, the 5-PIN leadership ceiling, credit-card fraud tiers and two missing pieces of legislation,
  the MDT warrant-copy-and-clear steps, the civilian-loadout return rule, and Use of Force's
  perimeter/visible-weapon guidance. Skipped two items (contacting an FTO, getting a Government ID)
  since the user confirmed those are covered in induction rather than needed here.
- **Handbook: the OCR Intake tool was completely undocumented.** Neither the Recruit Helper
  handbook nor the Day-to-Day Guide ever mentioned it, even though both already had working jump
  buttons wired up for it (`data-rh-page="ocr"`, `data-guide-jump="ocr"`) that no content used.
  Added a new "OCR Screenshot Intake" Quick Reference topic explaining how to load an image, pick
  a mode, and apply the extracted fields. Wired jump buttons/links into it from the three places an
  officer actually needs it: the "Fled Traffic Stop" handbook topic (softened the "paste the
  MELROADS excerpt" instruction to mention scanning it instead), and the Day-to-Day Guide's
  "Driver fled" and "Making an arrest" scenarios (both already told recruits to run a LEAP/MELROADS
  check by hand). Also caught and fixed `sw.js`'s `CACHE_VERSION` not having been bumped alongside
  the OCR fix below, despite `ocr.js` being a precached asset.
- **Fix: OCR startup showed a scary "failed to load" error banner even though it worked.**
  `createOCRWorker()` tried a 3-argument `createWorker("eng", 1, options)` call first; on this
  server's locked-down CSP, that variant internally attempts to fetch Tesseract's worker script
  from a CDN (`cdn.jsdelivr.net`), which is blocked and throws an uncaught error the app's global
  error handler surfaced as `⚠ Something failed to load … importScripts … failed to load`. The
  code already had a working fallback (the single-argument `createWorker(options)` form, which
  loads everything locally) but only tried it *after* the doomed CDN attempt had already thrown.
  Reordered so the reliable local-asset path runs first; the CDN-triggering attempt is now only a
  fallback. Verified with Playwright directly against the real app: OCR recognition still works
  identically (same text, same confidence) but with zero page errors instead of one.
- **Critical fix: OCR was blocked by the app's own Content Security Policy.** `script-src` had no
  `'wasm-unsafe-eval'`, which modern browsers require to run WebAssembly — and Tesseract.js's OCR
  engine is WASM. Found via a real end-to-end run: the OCR worker hung indefinitely (never resolved
  or rejected) with `WebAssembly.instantiate()` silently refused by CSP. Fixed in both the CSP
  `<meta>` tag and the `Content-Security-Policy` HTTP header. Verified afterwards: the worker now
  starts in ~1.1s and a real recognition run returns correct text at 96% confidence.
- **OCR overhaul, driven by real BlueBird RP screenshots the user supplied.** Found and fixed a
  genuine pre-existing data-corruption bug: the regex that recognises "NO" values in
  `normaliseBool` contained literal backspace control-character bytes instead of the text `NO|N0`
  (likely mangled by a prior copy/paste), so it silently matched nothing — every YES/NO flag
  field (wanted, bail, mental health, violence, weapon licences, vehicle registered/stolen/
  suspended — 14 fields in total) has been failing to recognise "NO" for as long as this code
  has existed. Also fixed: a field-label lookup could match a short label (`VIOLENCE`) *inside* a
  longer one that starts the same way (`VIOLENCE POLICE`), stealing its value; a label match could
  land inside a section-divider line (`--- OWNER DETAILS ---`) and capture the trailing dashes as
  a "value"; the licence-card address heuristic only recognised addresses containing a digit or a
  hardcoded GTA place name, missing this server's custom fictional locations; the `SEX` field
  didn't recognise "Male"/"Female" spelled out (only `M`/`F`/`X`); and the "Identification"
  name-confirmation hover-box (no "NAME:" label at all) wasn't read as a name source.
- **Upgraded the OCR language model from Tesseract's "fast" to its official "best" quality
  tier** (verified byte-identical to the previously-bundled file; new one downloaded fresh from
  the official tessdata_best repo). Bundle size grows accordingly (still lazily cached on first
  OCR use, never precached by the service worker).
- **Added automatic deskew**: a small rotation (a photographed/angled licence card) is now
  detected and corrected before any other preprocessing, using a row-projection-variance search
  with a confidence guard so icon-only/photo crops are never spuriously rotated.
- Verified end-to-end against the exact real CrimTrac/LEAP terminal, vehicle-search, licence-card
  and citizen-interaction screen text the user provided: 30 field-extraction checks, all passing.
  Deskew verified both geometrically (angle detection + visual correction) and via a full
  preprocess-then-recognise run showing higher OCR confidence than without it.
- **Offline support (PWA).** Added a service worker (`sw.js`) that precaches the app shell
  (HTML, CSS, JS, data, fonts) so the app works fully offline after the first load; the
  Tesseract OCR engine (not precached, ~6.6 MB) caches itself the first time OCR is actually
  used, so it too works offline afterwards. Added `manifest.webmanifest` (installable as a PWA)
  and a proper favicon (`assets/icon.svg`) — the app previously had neither.
- **Self-hosted fonts.** IBM Plex Sans/Mono are now bundled under `assets/vendor/fonts/`
  (latin subset only, 7 files, ~140 KB) instead of loaded from Google Fonts, removing the app's
  one remaining external network dependency. CSP (both the `<meta>` tag and, new, a real
  `Content-Security-Policy` HTTP header in `vercel.json`) no longer needs to allow
  `fonts.googleapis.com`/`fonts.gstatic.com`.
- **Accessibility: keyboard-navigable tabs and focus management.** The tool nav now follows the
  WAI-ARIA tabs pattern: roving `tabindex` (only the active tab is Tab-reachable), Left/Right/
  Home/End arrow-key navigation, and the current tab is reflected in the URL hash (deep-linkable,
  Back-button friendly) via `history.replaceState`. Clicking a tab moves focus into the shown
  page; arrow-key navigation keeps focus on the tab list. The skip link now focuses whichever
  page is actually active, not always the Report Tool, and its show/hide styling moved from
  inline `onfocus`/`onblur` handlers to a `.skip-link:focus` CSS rule. The two hand-rolled
  `role="button"` toggles (Professional Report Guidelines, Vehicle Defects Reference) now respond
  to Enter/Space, not just click.
- **Officer roster refreshed to August 2026 hours.** Six department moves (Jake Ramirez, Ryan
  Booth and Tony Pier to Leadership; Jonathan Cow-Kelly and Mitch Erdstein to Victoria Police;
  Sir Reginald to Special Constable), two renames (Stella O'Riley → Stella Hayes, promoted to
  Leadership; Anthony Vivian → Anthony Vivian-Robinson), and 13 new officers added. Harvey
  Decker and Emily Cumpson are confirmed departed and now flagged inactive — kept in the saved
  list, sorted last in autocomplete with an "Inactive" tag, never deleted. A new
  `migrateAugust2026Roster()` applies all of this to existing saved officer lists in place
  (renames don't leave a duplicate, callsigns are preserved), the same way the existing June
  migration does.
- Added a CI workflow (`.github/workflows/check.yml`) and `npm test`: syntax-checks every JS
  file, fails if an asset's `?v=` cache-bust is older than its last commit, and fails if a
  file over 5MB is added outside `assets/vendor/`.
- **Backup & hand-over**: the Templates modal can now export everything the browser remembers
  (drafts, templates, officer/person lists, callsigns, signatures) to a `.json` file and import
  it on another device. Import merges by default (your entries win on a name clash) or replaces
  everything when the checkbox is ticked. Stored values with a newer schema are now logged.
- Auto-link shared details: clearing a linked field no longer wipes the same field in every
  other section; Stolen/Suspended select defaults are no longer pinned as the shared value;
  the auto-link toggle keeps the user's setting after Clear All, load draft and restore
  backup; "Clear this section" no longer gets refilled on the next report-type switch; draft
  bookkeeping (`_charges`, `_pins`, `savedAt`) no longer leaks into the live form state.
- Removed two unreferenced 10.9 MB copies of the Tesseract `eng.traineddata.gz` language file
  (`assets/eng.traineddata.gz`, `assets/vendor/tesseract/tessdata/`). The app only ever loaded
  the 1.9 MB fast model at `assets/vendor/tessdata/`, so OCR is unchanged and the deploy is
  ~22 MB smaller.
- Moved the shared `_defectHistory` global out of the dead tail of `ocr.js` into `ui-data.js`,
  next to the code that uses it.
- Every `localStorage` write for officers, callsigns, signatures, undo snapshots and collapsed
  cards now goes through `safeLocalStorageSet`, so a full store shows the "storage full" toast
  instead of failing silently. Saving a draft now refreshes the storage meter and warns above 70%.
- Recruit Helper: Zoe Prime's directive attribution updated to Inspector.
- Replaced the stale `docs/REFACTOR_NOTES.txt` (v5-era) with this changelog.

## v7 (2026-07)

- **Auto-link shared details** across report sections (subject, when/where, vehicle) with a
  header toggle, plus a scene-processing SOP in the guide.
- Mobile/tablet layout fixes: no sideways scroll, single-row swipe tabs.
- Radio-call scripts shown inline as an accordion in the Day-to-Day Guide; radio-comms explainer.
- New **Day-to-Day Guide** tab (scenario walkthroughs) and **Recruit Mode** (field hints + live
  required-fields checklist).
- Static Vercel deploy with security headers.

## Earlier (v5 → v6)

- Inline CSS/JS moved out of `index.html` into `assets/css/app.css` and `assets/js/*.js`; the
  single `app.js` split into `core`, `reports`, `ocr`, `ui-data`, `interactions`.
- Datasets extracted to `assets/data/` (`charges`, `pins`, `items`).
- Report-type UI switch replaced by the `REPORT_CARD_VISIBILITY` config map.
- Tesseract OCR engine and language data bundled locally so OCR works offline.
