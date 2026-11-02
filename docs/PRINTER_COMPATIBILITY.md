# Model View printer compatibility (FDM)

Model View can now compare a model with a **selected printer's build envelope** before exporting a reference STL. This is not printer-driver functionality, and Model View **does not generate G-code** or install vendor slicer profiles. Always load the STL into a dedicated slicer configured for the actual printer before printing.

## Included printer choices

| Printer preset | X × Y × Z build area (mm) | Factory nozzle | Suggested slicer |
|---|---:|---:|---|
| Generic FDM | 220 × 220 × 250 (illustrative) | 0.4 mm | A slicer with the correct manufacturer profile |
| Creality Ender-3 V3 SE | 220 × 220 × 250 | 0.4 mm | Creality Print or Cura |
| Bambu Lab A1 | 256 × 256 × 256 | 0.4 mm | Bambu Studio |
| Original Prusa MK4S | 250 × 210 × 220 | 0.4 mm | PrusaSlicer |
| Custom FDM | User-defined dimensions | User-selected | Manufacturer-recommended slicer |

Sources (manufacturer specifications): [Creality comparison](https://www.creality.com/compare/compare-ender-3-v3-series), [Bambu Lab A1 specification PDF](https://store.bblcdn.com/8137fad1525a4454ac8a28502edbc919.pdf), [Original Prusa MK4S specifications](https://cdn.prusa3d.com/product/original-prusa-mk4s-3d-printer-5/). Actual printer modifications, nozzle sizes, bed exclusions, and installed firmware can change compatibility. The example layer-height ranges are reference hints, not official machine control configurations.

## Options

- Select the printer model or **Custom FDM** to enter build dimensions.
- Choose the actual installed nozzle size (0.1–2 mm) and filament diameter.
- Adjust the geometric bed margin in millimetres (applied to both sides of X and Y).
- Choose a model-unit conversion before geometric slicing.
- Preview real XY cross-sections at a selected layer height and enable optional basic vertical supports.
- Download an STL with those supports only after passing a simple build-envelope check.
- Download a JSON **print preflight report** recording printer choice, model dimensions, build volume, margin, and warnings. It is a Model View reference report, *not* a vendor-native machine profile.

## Important limits

The model fit check compares the axis-aligned model dimensions and support columns with the selected build volume. It does not guarantee printable geometry, safe motion, actual bed shape, toolhead clearance, first-layer adhesion, slicer support correctness, infill, or machine-specific temperatures. It also does not repair open or self-intersecting meshes.

If the model exceeds the selected printer profile's build volume, the page still permits inspection of the slices but disables the print STL download. Reduce or reorient your model in an appropriate modeling tool, or select a correctly dimensioned printer. The export is not an instruction file for a 3D printer.

## Deployment

The GitHub Actions production build always retains the generated site as a downloadable artifact. To publish through GitHub Pages, enable [Settings → Pages → Build and deployment → Source: GitHub Actions](https://github.com/Unborne-Fetus/Model-View/settings/pages) in the repository, then rerun [Deploy Model View Web](https://github.com/Unborne-Fetus/Model-View/actions/workflows/deploy-pages.yml). This repository-level GitHub setting requires repository-administrator action; the built-in workflow token cannot enable it.
