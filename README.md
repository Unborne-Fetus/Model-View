# Model View

**Model View** is a free, local-first 3D model viewer, quality checker and GLB converter for creators. It is an independent general-purpose application built from the browser and model-loading technology of GFPAK-OPEN.

**Website (after GitHub Pages is enabled):** https://unborne-fetus.github.io/Model-View/

## What it does

- Preview standard 3D model files: **GLB, glTF, FBX, OBJ, DAE, STL, PLY and 3DS**
- Import individual files, entire folders and ZIP packages (include dependent .mtl, textures and .bin files)
- Orbit, pan, zoom, frame the model, show a grid/axes, toggle wireframe and auto-rotate
- Play detected animations and inspect mesh, vertex, triangle, material, texture and bone counts
- Generate a **downloadable JSON quality report**, checking for missing normals/UVs, invalid positions, empty scenes and large triangle budgets
- Preview supported source image textures, export actual GLB geometry and materials, and save PNG viewport captures
- Operate **entirely in the browser**; user assets are not uploaded to an application server

The tool intentionally does not claim to repair all models or guarantee visually perfect exports. Some formats, shader features, compressed textures, proprietary engines and skeletal animation variants cannot be preserved by open-source loaders. Only files for which you have appropriate rights should be imported or redistributed.

## Quick start

Requirements for local development: Node.js 22+, npm.

```bash
npm ci
npm test
npm run dev
```

Open the Vite URL shown in the terminal. To make a deployable site:

```bash
npm run build
```

The build output is `dist-web/`. The app is deployed using the `Deploy Model View Web` workflow and uses the GitHub Pages base path `/Model-View/`. Enable **GitHub Actions** as the Pages deployment source in repository settings. A deployed site is not confirmed until the workflow succeeds.

## What was reused from GFPAK-OPEN

Existing browser loaders in `web/src/model.js`, the Three.js viewport, GLB exporter, ZIP project support, quality-aware texture handling, and tests.

The general-purpose homepage is now `web/index.html` and `web/src/model-view-main.js`. The independent quality inspector is `web/src/model-audit.js` with dedicated tests. Generic HTML/UI styles live in `web/src/model-view.css`.

**Optional legacy tools:** `web/legacy.html` preserves the original game-format archive explorer, specialized mesh/texture decoders and desktop Blender-assisted converter. These tools remain in the repository to avoid losing working features, but they are not the default commercial product. The legacy Python implementation retains the internal package name `gfpak_open` so its imports and regression tests continue to work. See [archived documentation](docs/LEGACY_GFPAK.md) for its existing format support and limitations.

To build the Windows portable asset tools, run `run.bat` on Windows. That version opens the **new general Model View studio** by default, with optional legacy tools accessible from the top navigation. The web app works without Windows, Python, Blender, or a game file.

## Privacy and safety

Processing runs on the user's device. The site does not contain a login system, payment API, or advertisements. External font hosting is used for styling; model dependencies are resolved from user-provided files and should not be fetched automatically from arbitrary remote URLs. The legacy desktop features may download their advertised optional third-party tool dependencies when explicitly configured.

Some code is compatible with proprietary formats and may be subject to third-party licenses. Commercialization requires reviewing imported source, dependency licenses, artwork, and rights before placing ads or collecting payments. **No copyrighted models are included as demo assets.** The built-in demo is generated from primitive geometry.

## Verification

- `npm test` tests parsers and the model-audit library.
- `npx playwright test` runs Model View smoke tests.
- Desktop's Python tests can be run separately via `python -m unittest discover -s tests -v`.

Please open issues in this repository for bugs, unsupported formats, and reproducible conversion problems.

## Project relationship

`Model-View` is independent of `GFPAK-OPEN`. Changes in this repository do not update GFPAK-OPEN. The starting copy was hash-verified against GFPAK-OPEN, and later changes deliberately diverge.
