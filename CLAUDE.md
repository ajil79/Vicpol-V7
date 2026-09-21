# VicPol Tool v7 — Claude Code Guide

## What this is
Static, offline-capable web app for BBRP Melbourne Police roleplay paperwork. No build step, no framework, no bundler — vanilla HTML/CSS/JS. `index.html` is the shell; everything else is plain `<script>` / `<link>` assets loaded in a fixed order (see the bottom of `index.html`).

## Running locally
```bash
npm run dev        # http://localhost:3000 (npx serve)
```
Or open `index.html` directly. Fully static — a `python3 -m http.server` also works.

## Architecture
- **CSS** — all in `assets/css/app.css`. Dark mode is default; light mode via `body.light-mode`. CSS variables live in `:root`.
- **HTML** — tabbed layout: `.tool-nav` buttons (`data-tool-page`) show/hide `.tool-page` sections. Page switching is `showToolPage()` in `interactions.js`.
- **JS** — split into modules loaded in dependency order (data before renderers):
  `charges → pins → core → reports → items → ocr → ui-data → recruit(data) → recruit-helper → guide(data) → guide → interactions`.

## Tabs / pages
| Nav `data-tool-page` | Section id | What it does |
|---|---|---|
| `guide` | `guidePage` | 🧭 Day-to-Day Guide — recruit scenario walkthroughs (v7) |
| `report` | `reportPage` | Report / warrant builder |
| `traffic` | `trafficPage` | LEAP/PIN traffic history analyser |
| `ocr` | `ocrPage` | Image OCR intake |
| `recruit` | `recruitPage` | 🎓 Recruit Helper handbook reference |

## Report types
Config lives in `assets/js/core.js`: `VICPOL_ALLOWED_REPORT_TYPES`, `REPORT_TYPE_LABEL`, and `REPORT_CARD_VISIBILITY` (which cards show per type). Generators are in `assets/js/reports.js` (`generateArrestReport`, `generateVicPolArrest`, `generateVicPolWarrant`, `generateTrafficWarrant`, `generateFieldContact`, `generateSearchSeizure`, `generateVehicleInspection`). `bail_conditions` is intentionally hidden (city has bail disabled).

## Key globals / patterns
- `debouncedRenderPreview()` — rebuilds the live preview; wired to every input.
- `showToolPage(page)` (`interactions.js`) — tab switching; `window.showToolPage` is exported.
- `openRecruitTopic(id)` / `[data-guide-topic]` — jump to a Recruit Helper topic from anywhere.
- `toast(msg, type)` — bottom notifications (`ok`/`warn`/`err`).
- `escapeHtml(str)` — use for any user text inserted into HTML.
- Report-type hints: `REPORT_TYPE_HINTS` in `assets/js/ui-data.js`.
- Validation: `validateDraft()` in `assets/js/reports.js`, panel wiring in `assets/js/ui-data.js`.

## v7 additions
- **Day-to-Day Guide**: data in `assets/data/guide.js` (`GUIDE_SCENARIOS`, `GUIDE_QUICKREF`, `GUIDE_GOLDEN_RULES`), renderer in `assets/js/guide.js` (mounts into `#guideRoot`, lazy-render + event delegation, mirrors `recruit-helper.js`). Scenario jump buttons use `data-guide-jump` (report type) and optional `data-id-status` to pre-fill the warrant ID status.
- **Recruit Mode**: header button `#recruitModeBtn`, persisted in `localStorage` key `vicpol_recruit_mode`, toggles `body.recruit-mode`. Field hints are `.recruit-hint` elements (hidden unless recruit mode). Live checklist reuses the validation output. Wiring in `interactions.js` + `ui-data.js`.

## Data persistence
`localStorage` only, key prefix `vicpol_`. **Do not rename the prefix** — it orphans existing users' saved drafts/templates. Keys include `vicpol_report_autosave`, `vicpol_report_drafts`, `vicpol_report_presets`, `vicpol_active_tab`, `vicpol_recruit_mode`.

## Editing tips
- Bump the `?v=YYYYMMDD` cache-bust query on changed assets in `index.html` (mobile browsers cache aggressively).
- JS sections use `// ═══` banner comments; CSS uses `/* ── Name ── */`. Grep those to jump around.
- App name/version is `APP_META` in `core.js`.
