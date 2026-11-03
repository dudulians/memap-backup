# Aurora UX tests and the phone preview

Playwright checks written while building the Aurora screens (Oct–Nov 2026).
They drive the dev server in headless Chrome with demo data and print JSON;
a failure shows up as a thrown error (TimeoutError, TypeError) in the output.

Setup: the dev server on http://localhost:8080 (`npm run dev` in the repo
root) and Google Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`.
Run everything from `marketing/tools` (playwright-core is installed there);
screenshots and work files go to `marketing/tools/aurora-tests/work/`
(not committed).

```bash
cd marketing/tools && mkdir -p aurora-tests/work && bash aurora-tests/run-suite.sh
```

One test: `node --input-type=module < aurora-tests/test-r12.mjs`.
Don't edit `src/` while the suite runs: hot reload makes tests flaky.

What they cover, roughly: r12 the picker drum on Today; r13 the globe and
day/night; r14 the You sheet and the default otter; r15 the globe look and
treasures; r16 the flat map's bridges; r17 the spacer crash on different
phone heights; r18 the globe's tap and rubber band; the others are older
rounds (path steps, decks, islands, questions, the bubble game).

## Phone preview (the claude.ai artifact link)

From the repo root:

```bash
npx vite build --base ./ --outDir marketing/tools/aurora-tests/work/phone-preview-map --emptyOutDir
cd marketing/tools && node --input-type=module < aurora-tests/make-phone-preview.mjs
node --input-type=module < aurora-tests/test-preview2.mjs
```

`make-phone-preview.mjs` wraps the build into `memap-preview.html` with demo
data and writes the file list to `phone-preview-map-files.json`; publish the
page with the new `assets/index-*` and `assets/web-*` files to the existing
artifact URL (see VERSIONS.md).
