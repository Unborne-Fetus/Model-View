# Model View: browser compatibility and advertising preparation

## Browser compatibility test plan

The Playwright configuration runs the full regression suite in **Chromium**, plus an independent compatibility suite in **Firefox**, **WebKit**, **mobile Chrome** (Pixel 7 emulation), and **mobile Safari** (iPhone 13 emulation). Tests confirm:

- The home page loads without uncaught JavaScript errors.
- Import controls, status messages, and source selection work.
- Importing a synthetic OBJ either renders the mesh and report or explains when WebGL is unavailable.
- The mobile layout fits the device viewport without unwanted horizontal scrolling.
- Future advertising placeholders appear and do not load ad network scripts.
- The original Chromium tests also verify an OBJ in a ZIP, multiple OBJ files, OBJ with MTL, corrupted ZIP handling, GLB downloads, and JSON reports.

Run from the repository root:

```bash
npm ci
npx playwright install --with-deps chromium firefox webkit
npx playwright test
```

To focus only on the primary browser:
```bash
npx playwright test --project=chromium
```

A passing **WebKit Playwright test on Linux is not a substitute for an actual iPhone/Safari test**. Do manual checks on real devices for large file-picker uploads, downloads, GPU behavior, and animation performance. When WebGL or extensions are unavailable, the user should see an actionable message instead of a blank screen.

## Reserved advertising placements

Two responsive DOM placeholders live in `web/index.html`:

| Placement | Hook | Intended use |
| --- | --- | --- |
| Above workspace | `[data-ad-slot="leaderboard"]` | Responsive leaderboard ad |
| Below workspace | `[data-ad-slot="below-workspace"]` | Responsive footer or mobile ad |

Both currently display **FUTURE AD PLACEMENT — Advertising is not active**. The page includes **no advertising script**, does not request ad inventory, and does not claim a payment or advertising approval. Avoid placing overlays above interactive model controls. Keep labeled ad space separate from tool buttons and upload inputs.

Before enabling ads, review model-file processing privacy, legal rights to converted assets, the public-facing page content, actual traffic, platform policies, and payment-account eligibility. Obtain ad-network approval first; then implement provider-specific tags, consent requirements where applicable, and privacy disclosure. Ads are not guaranteed to generate revenue.

## Privacy and cost

The model viewer processes user files locally and does not upload them to a conversion server. Imported user assets should not be logged, sent to analytics or shared with an advertising partner. The optional legacy tools may have distinct behavior and should be reviewed independently before commercial publication.

Production static hosting need not run Python, databases, paid processing infrastructure, or file storage. Browser tests require CI resources; consider manual or release-triggered Windows executable builds to reduce recurring CI costs.
