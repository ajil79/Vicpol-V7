# VicPol Tool v7

A single-page, **offline-capable** web app for BBRP Melbourne Police roleplay — arrest reports, warrants, traffic paperwork, an OCR intake, a searchable handbook reference, and (new in v7) a recruit-focused **Day-to-Day Guide** and **Recruit Mode**.

No build step, no framework, no bundler — vanilla HTML/CSS/JS. Everything runs in the browser and all data stays in `localStorage`; nothing is sent to a server.

## What's in v7

- **🧭 Day-to-Day Guide** — scenario walkthroughs (start of shift, traffic stops, a driver who fled, making an arrest, searches, impounds, welfare checks, Code 15s) with copy-and-paste radio calls and buttons that jump straight into the right report type.
- **🎓 Recruit Mode** — a toggle in the header that overlays plain-English hints on the report form and shows a live required-fields checklist so recruits don't miss anything before copying.
- **Recruit Helper** — the searchable handbook reference, expanded with conduct, procedure and career topics from the 2024/2025 handbooks.
- Everything from v6: Report Tool (arrest, warrants, traffic, field contact, search & seizure, vehicle inspection), Traffic History analyser, and OCR Intake.

## Run locally

```bash
npm run dev        # serves at http://localhost:3000 via `npx serve`
```

Or just open `index.html` directly in a browser — no server needed. (OCR needs the bundled assets under `assets/vendor/`, which are served fine either way.)

## Deploy

Static site — import the repo into Vercel with **no build settings**. `vercel.json` sets the security headers. Every push to the default branch auto-deploys.

## Layout

| Path | Purpose |
|------|---------|
| `index.html` | Page shell: header, nav tabs, and all `.tool-page` sections |
| `assets/css/app.css` | All styles (dark mode default; `body.light-mode` for light) |
| `assets/js/core.js` | App metadata, state, storage, report-type visibility, preview render |
| `assets/js/reports.js` | Report generators + validation |
| `assets/js/ui-data.js` | Form wiring, report-type hints, validation panel |
| `assets/js/interactions.js` | Page navigation, header buttons, recruit-mode toggle |
| `assets/js/ocr.js` | OCR intake (Tesseract, bundled offline) |
| `assets/js/recruit-helper.js` | Renders the Recruit Helper handbook accordion |
| `assets/js/guide.js` | Renders the Day-to-Day Guide (new in v7) |
| `assets/data/*.js` | Static datasets — charges, pins, items, recruit handbook, guide scenarios |
| `assets/vendor/` | Bundled Tesseract OCR engine + language data |

See `CLAUDE.md` for a deeper map of the code for anyone (or any agent) editing it.
