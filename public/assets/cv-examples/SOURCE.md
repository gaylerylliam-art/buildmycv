# Native CV examples

These PNGs are captured from the existing builder's LiveCVPreview component,
not generated illustrations. They use synthetic sample details and only the
categories, colors, and layouts registered in src/data/categories.js.

The homepage metadata is in src/data/homeCvExamples.js. The header and gallery
reuse these same images. Only the surrounding builder UI and paper shadow are
removed for the capture; the CV markup and compiled styles are preserved.

To refresh after changing the CV renderer, build the project and start a local
preview at port 5174. Run node scripts/generate-home-cv-examples.mjs, then build
again to include the refreshed images. PREVIEW_URL and BROWSER_PATH can override
the local preview URL and browser executable. External requests are blocked.
