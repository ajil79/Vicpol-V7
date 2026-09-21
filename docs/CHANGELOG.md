# Changelog

Newest first. Dates are the commit dates on `main`.

## Unreleased

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
